package integration

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"golang.org/x/oauth2"
)

// formRecorder captures the token-endpoint form without racing the handler
// goroutine that serves it.
type formRecorder struct {
	mu   sync.Mutex
	form url.Values
}

func (f *formRecorder) set(v url.Values) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.form = v
}

func (f *formRecorder) get() url.Values {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.form
}

// withOAuthConfig installs a throwaway OAuth configuration and restores the
// previous one (including the callback channel) when the test ends.
func withOAuthConfig(t *testing.T) *oauth2.Config {
	t.Helper()
	prevConfig, prevChan, prevState := googleOauthConfig, authCodeChan, oauthStateToken
	cfg := &oauth2.Config{
		RedirectURL:  RedirectURL,
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		Scopes:       []string{"https://www.googleapis.com/auth/drive.file"},
		Endpoint:     oauth2.Endpoint{AuthURL: "https://accounts.example/auth", TokenURL: "https://accounts.example/token"},
	}
	googleOauthConfig = cfg
	t.Cleanup(func() {
		googleOauthConfig, authCodeChan, oauthStateToken = prevConfig, prevChan, prevState
	})
	return cfg
}

func TestInitOAuthConfigRequiresBothSecrets(t *testing.T) {
	prev := googleOauthConfig
	t.Cleanup(func() { googleOauthConfig = prev })

	googleOauthConfig = nil
	initOAuthConfig("", "secret")
	if googleOauthConfig != nil {
		t.Fatal("a partial client secret must not configure OAuth")
	}
	initOAuthConfig("id", "")
	if googleOauthConfig != nil {
		t.Fatal("a partial client secret must not configure OAuth")
	}

	initOAuthConfig("id", "secret")
	if googleOauthConfig == nil {
		t.Fatal("valid credentials must configure OAuth")
	}
	if googleOauthConfig.RedirectURL != RedirectURL {
		t.Fatalf("redirect URL mismatch: %q", googleOauthConfig.RedirectURL)
	}
	if len(googleOauthConfig.Scopes) != 1 || !strings.Contains(googleOauthConfig.Scopes[0], "drive.file") {
		t.Fatalf("unexpected scopes: %v", googleOauthConfig.Scopes)
	}
}

func TestOAuthConfigBuildsProviderURL(t *testing.T) {
	// pkg/secureconfig resolves its file location once at process start, so
	// InitGoogleSecrets (which persists secrets) must not be exercised here —
	// it would overwrite the real profile of whoever runs the suite.
	cfg := withOAuthConfig(t)

	url := cfg.AuthCodeURL("state-token", oauth2.AccessTypeOffline)
	if !strings.Contains(url, "client_id=test-client-id") {
		t.Fatalf("auth URL must carry the client id: %q", url)
	}
	if !strings.Contains(url, "access_type=offline") {
		t.Fatalf("offline access is required for refresh tokens: %q", url)
	}
}

func TestGoogleTokenRoundTripAndDisconnect(t *testing.T) {
	isolateConfigDir(t)
	s := &cloudService{}

	if s.IsGoogleConnected() {
		t.Fatal("no token must exist before connecting")
	}

	expiry := time.Now().Add(time.Hour).Truncate(time.Second)
	token := &oauth2.Token{
		AccessToken:  "access-token",
		TokenType:    "Bearer",
		RefreshToken: "refresh-token",
		Expiry:       expiry,
	}
	if err := saveToken(token); err != nil {
		t.Fatalf("saveToken: %v", err)
	}

	// The stored token must be encrypted at rest.
	raw, err := os.ReadFile(getGoogleTokenPath())
	if err != nil {
		t.Fatalf("read token file: %v", err)
	}
	if strings.Contains(string(raw), "access-token") {
		t.Fatal("the OAuth token must be encrypted at rest")
	}

	if !s.IsGoogleConnected() {
		t.Fatal("a stored token must report as connected")
	}
	loaded, err := loadToken()
	if err != nil || loaded == nil {
		t.Fatalf("loadToken = %+v, %v", loaded, err)
	}
	if loaded.AccessToken != "access-token" || loaded.RefreshToken != "refresh-token" {
		t.Fatalf("token round trip mismatch: %+v", loaded)
	}
	if !loaded.Expiry.Equal(expiry) {
		t.Fatalf("token expiry mismatch: %v", loaded.Expiry)
	}

	if err := s.DisconnectGoogle(); err != nil {
		t.Fatalf("DisconnectGoogle: %v", err)
	}
	if s.IsGoogleConnected() {
		t.Fatal("disconnecting must remove the stored token")
	}
	if err := s.DisconnectGoogle(); err == nil {
		t.Fatal("disconnecting twice must report the missing file")
	}
}

func TestLoadTokenRejectsCorruptFile(t *testing.T) {
	isolateConfigDir(t)
	if err := os.WriteFile(getGoogleTokenPath(), []byte("garbage"), 0600); err != nil {
		t.Fatalf("write corrupt token: %v", err)
	}
	if _, err := loadToken(); err == nil {
		t.Fatal("a corrupt token file must be rejected")
	}
}

func TestGoogleAuthKeyDerivations(t *testing.T) {
	current := deriveGoogleAuthKey()
	previous := prevGoogleAuthKey()
	if len(current) == 0 || len(previous) == 0 {
		t.Fatal("both key derivations must produce material")
	}
	if string(current) == string(previous) {
		t.Fatal("the machine-bound key must differ from the legacy hostname-only key")
	}
}

func TestInitGoogleAuthWithoutConfig(t *testing.T) {
	prev := googleOauthConfig
	t.Cleanup(func() { googleOauthConfig = prev })
	googleOauthConfig = nil

	s := &cloudService{}
	if _, err := s.InitGoogleAuth(); err == nil {
		t.Fatal("InitGoogleAuth must fail when OAuth is not configured")
	}
}

func TestCompleteGoogleAuthExchangesCode(t *testing.T) {
	isolateConfigDir(t)
	cfg := withOAuthConfig(t)

	form := &formRecorder{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body.Close()
		_ = r.ParseForm()
		form.set(r.Form)
		_, _ = io.WriteString(w, `{"access_token":"exchanged","token_type":"Bearer","refresh_token":"r-2","expires_in":3600}`)
	}))
	defer server.Close()

	cfg.Endpoint = oauth2.Endpoint{AuthURL: server.URL + "/auth", TokenURL: server.URL + "/token"}
	authCodeChan = make(chan string, 1)
	authCodeChan <- "code-from-callback"

	s := &cloudService{}
	if err := s.CompleteGoogleAuth(); err != nil {
		t.Fatalf("CompleteGoogleAuth: %v", err)
	}
	exchanged := form.get()
	if exchanged["code"] == nil || exchanged["code"][0] != "code-from-callback" {
		t.Fatalf("the authorization code was not exchanged: %v", exchanged)
	}
	token, err := loadToken()
	if err != nil || token == nil || token.AccessToken != "exchanged" {
		t.Fatalf("exchanged token not persisted: %+v, %v", token, err)
	}

	// A rejected exchange must surface instead of storing a broken token.
	cfg.Endpoint = oauth2.Endpoint{AuthURL: server.URL + "/auth", TokenURL: server.URL + "/fail"}
	failServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, `{"error":"invalid_grant"}`)
	}))
	defer failServer.Close()
	cfg.Endpoint = oauth2.Endpoint{AuthURL: failServer.URL + "/auth", TokenURL: failServer.URL + "/token"}

	authCodeChan = make(chan string, 1)
	authCodeChan <- "stale-code"
	if err := s.CompleteGoogleAuth(); err == nil {
		t.Fatal("a rejected exchange must surface an error")
	}
}

func TestInitGoogleAuthServesCallback(t *testing.T) {
	isolateConfigDir(t)
	withOAuthConfig(t)

	s := &cloudService{}
	authURL, err := s.InitGoogleAuth()
	if err != nil {
		t.Fatalf("InitGoogleAuth: %v", err)
	}
	if !strings.Contains(authURL, "state="+oauthStateToken) {
		t.Fatalf("the auth URL must carry the generated CSRF state: %q", authURL)
	}
	if oauthStateToken == "" {
		t.Fatal("a CSRF state token must be generated")
	}

	// The local callback listener uses a fixed port; if it is taken in this
	// environment the callback cannot be exercised, so say so instead of
	// asserting on an unreachable listener.
	base := "http://127.0.0.1:" + AuthPort
	ready := false
	for i := 0; i < 30; i++ {
		resp, err := http.Get(base + "/auth/callback?state=wrong&code=x")
		if err == nil {
			resp.Body.Close()
			ready = true
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if !ready {
		t.Skipf("local callback listener on port %s is unavailable in this environment", AuthPort)
	}

	// A wrong state must be rejected (CSRF protection).
	resp, err := http.Get(base + "/auth/callback?state=wrong&code=x")
	if err != nil {
		t.Fatalf("callback request: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("a mismatched state must be rejected, got %d", resp.StatusCode)
	}

	// A correct state delivers the code to the waiting exchange.
	go func() {
		_, _ = http.Get(base + "/auth/callback?state=" + oauthStateToken + "&code=good-code")
	}()
	select {
	case code := <-authCodeChan:
		if code != "good-code" {
			t.Fatalf("unexpected delivered code: %q", code)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("the callback did not deliver the authorization code")
	}
}

func TestGoogleDriveBackupRequiresConnection(t *testing.T) {
	isolateConfigDir(t)
	withOAuthConfig(t)
	s := &cloudService{}

	if err := s.GoogleDriveBackupNow(); err == nil {
		t.Fatal("backing up to Drive without a connection must fail")
	}

	// With a token stored the client is constructible offline; the network call
	// itself is intentionally never issued from a unit test.
	if err := saveToken(&oauth2.Token{AccessToken: "a", TokenType: "Bearer", Expiry: time.Now().Add(time.Hour)}); err != nil {
		t.Fatalf("saveToken: %v", err)
	}
	client, err := s.GetGoogleClient()
	if err != nil || client == nil {
		t.Fatalf("GetGoogleClient with a stored token = %v, %v", client, err)
	}
}
