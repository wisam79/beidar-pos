package integration

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"beidar-desktop/pkg/crypto"
	"beidar-desktop/pkg/secureconfig"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

const (
	AuthPort    = "10999"
	RedirectURL = "http://localhost:" + AuthPort + "/auth/callback"
)

var (
	googleOauthConfig *oauth2.Config
	authCodeChan      chan string
	oauthStateToken   string
)

// initOAuthConfig sets up the Google OAuth configuration using the provided
// credentials. These should be loaded from secureconfig or environment variables.
func initOAuthConfig(clientID, clientSecret string) {
	if clientID == "" || clientSecret == "" {
		return
	}
	googleOauthConfig = &oauth2.Config{
		RedirectURL:  RedirectURL,
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Scopes: []string{
			"https://www.googleapis.com/auth/drive.file",
		},
		Endpoint: google.Endpoint,
	}
}

// InitGoogleSecrets stores Google OAuth credentials in secureconfig and
// initializes the OAuth config. Called from app.go startup.
func (s *cloudService) InitGoogleSecrets(clientID, clientSecret string) {
	if clientID != "" && clientSecret != "" {
		_ = secureconfig.SetGoogleOAuthSecrets(clientID, clientSecret)
	}
	initOAuthConfig(secureconfig.GetGoogleOAuthClientID(), secureconfig.GetGoogleOAuthClientSecret())
}

type TokenStore struct {
	AccessToken  string    `json:"access_token"`
	TokenType    string    `json:"token_type"`
	RefreshToken string    `json:"refresh_token,omitempty"`
	Expiry       time.Time `json:"expiry"`
}

func getGoogleTokenPath() string {
	configDir, _ := os.UserConfigDir()
	appDir := filepath.Join(configDir, "BeidarPOS_V3")
	_ = os.MkdirAll(appDir, 0755)
	return filepath.Join(appDir, "google_token.json")
}

func (s *cloudService) InitGoogleAuth() (string, error) {
	authCodeChan = make(chan string)

	// Generate secure state token
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("system entropy failure for google auth state: %w", err)
	}
	oauthStateToken = hex.EncodeToString(b)

	mux := http.NewServeMux()
	server := &http.Server{
		Addr:    "127.0.0.1:" + AuthPort,
		Handler: mux,
	}

	mux.HandleFunc("/auth/callback", func(w http.ResponseWriter, r *http.Request) {
		state := r.URL.Query().Get("state")
		if state == "" || state != oauthStateToken {
			http.Error(w, "State mismatch (CSRF warning)", http.StatusBadRequest)
			return
		}

		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "Code not found", http.StatusBadRequest)
			return
		}

		authCodeChan <- code

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintf(w, `
			<html>
			<body style="font-family: sans-serif; text-align: center; padding: 50px;">
				<h1 style="color: #10b981;">تم الاتصال بنجاح!</h1>
				<p>يمكنك إغلاق هذه النافذة والعودة للتطبيق.</p>
				<script>window.close()</script>
			</body>
			</html>
		`)

		go func() {
			time.Sleep(1 * time.Second)
			_ = server.Shutdown(context.Background())
		}()
	})

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Auth server error: %v\n", err)
		}
	}()

	url := googleOauthConfig.AuthCodeURL(oauthStateToken, oauth2.AccessTypeOffline)
	return url, nil
}

func (s *cloudService) CompleteGoogleAuth() error {
	select {
	case code := <-authCodeChan:
		token, err := googleOauthConfig.Exchange(context.Background(), code)
		if err != nil {
			return err
		}
		return saveToken(token)
	case <-time.After(5 * time.Minute):
		return fmt.Errorf("timeout waiting for login")
	}
}

func saveToken(token *oauth2.Token) error {
	data := TokenStore{
		AccessToken:  token.AccessToken,
		TokenType:    token.TokenType,
		RefreshToken: token.RefreshToken,
		Expiry:       token.Expiry,
	}

	file, err := json.Marshal(data)
	if err != nil {
		return err
	}

	key := deriveGoogleAuthKey()
	encrypted, err := crypto.Encrypt(file, key)
	if err != nil {
		return fmt.Errorf("failed to encrypt oauth token: %w", err)
	}

	return os.WriteFile(getGoogleTokenPath(), []byte(encrypted), 0600)
}

func (s *cloudService) IsGoogleConnected() bool {
	_, err := loadToken()
	return err == nil
}

func (s *cloudService) DisconnectGoogle() error {
	return os.Remove(getGoogleTokenPath())
}

func (s *cloudService) UploadBackupToDrive(filename string, content string) (string, error) {
	client, err := s.GetGoogleClient()
	if err != nil {
		return "", err
	}

	srv, err := drive.NewService(context.Background(), option.WithHTTPClient(client))
	if err != nil {
		return "", err
	}

	f := &drive.File{Name: filename}
	res, err := srv.Files.Create(f).Media(bytes.NewReader([]byte(content))).Do()
	if err != nil {
		return "", err
	}

	return res.Id, nil
}

func (s *cloudService) GetGoogleClient() (*http.Client, error) {
	token, err := loadToken()
	if err != nil {
		return nil, err
	}

	return googleOauthConfig.Client(context.Background(), token), nil
}

func deriveGoogleAuthKey() []byte {
	host, err := os.Hostname()
	if err != nil {
		host = "beidar-google-auth-default"
	}
	machineID := secureconfig.MachineID()
	return crypto.DeriveKey(fmt.Sprintf("beidar-google-auth-key-%s-%s", host, machineID))
}

// prevGoogleAuthKey reproduces the old hostname-only derivation so OAuth
// tokens cached by previous builds can still be decrypted and migrated.
func prevGoogleAuthKey() []byte {
	host, err := os.Hostname()
	if err != nil {
		host = "beidar-google-auth-default"
	}
	return crypto.DeriveKey(fmt.Sprintf("beidar-google-auth-key-%s", host))
}

func loadToken() (*oauth2.Token, error) {
	data, err := os.ReadFile(getGoogleTokenPath())
	if err != nil {
		return nil, err
	}

	key := deriveGoogleAuthKey()
	decrypted, err := crypto.Decrypt(string(data), key)
	if err != nil {
		// Fallback: try the old hostname-only key so OAuth tokens from
		// previous builds migrate to the new machine-ID-bound key.
		prevKey := prevGoogleAuthKey()
		decrypted, err = crypto.Decrypt(string(data), prevKey)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt oauth token: %w", err)
		}
	}

	var store TokenStore
	if err := json.Unmarshal(decrypted, &store); err != nil {
		return nil, err
	}

	token := &oauth2.Token{
		AccessToken:  store.AccessToken,
		TokenType:    store.TokenType,
		RefreshToken: store.RefreshToken,
		Expiry:       store.Expiry,
	}

	return token, nil
}
