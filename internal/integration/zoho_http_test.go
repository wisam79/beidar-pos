package integration

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
)

// hostRewriteTransport sends every Zoho request to a local test server while
// leaving the production URL construction untouched, so the real request
// building code runs verbatim.
type hostRewriteTransport struct{ base *url.URL }

func (h hostRewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	clone := req.Clone(req.Context())
	clone.URL.Scheme = h.base.Scheme
	clone.URL.Host = h.base.Host
	return http.DefaultTransport.RoundTrip(clone)
}

func pointZohoAt(t *testing.T, serverURL string) {
	t.Helper()
	base, err := url.Parse(serverURL)
	if err != nil {
		t.Fatalf("parse test server URL: %v", err)
	}
	prevClient := zohoHTTPClient
	zohoHTTPClient = &http.Client{Timeout: 5 * time.Second, Transport: hostRewriteTransport{base: base}}
	t.Cleanup(func() { zohoHTTPClient = prevClient })
}

// resetZohoState clears the process-wide Zoho caches between tests.
func resetZohoState(t *testing.T) {
	t.Helper()
	prevConfig, prevQueue := zohoConfig, syncQueue
	zohoConfig = nil
	syncQueue = nil
	t.Cleanup(func() {
		zohoConfig = prevConfig
		syncQueue = prevQueue
	})
}

func zohoTestService(t *testing.T) *cloudService {
	t.Helper()
	service, _, cleanup := setupTestIntegration(t)
	t.Cleanup(cleanup)
	resetZohoState(t)
	return service.(*cloudService)
}

func writeZohoConfig(t *testing.T, s *cloudService, expiry int64) {
	t.Helper()
	cfg := &domain.ZohoConfig{
		ClientID:       "client-id",
		ClientSecret:   "client-secret",
		RefreshToken:   "refresh-token",
		AccessToken:    "access-token",
		OrganizationID: "org-1",
		TokenExpiry:    expiry,
		Enabled:        true,
	}
	if err := s.SaveZohoConfig(cfg); err != nil {
		t.Fatalf("SaveZohoConfig: %v", err)
	}
}

func TestZohoConfigLifecycle(t *testing.T) {
	isolateConfigDir(t)
	s := zohoTestService(t)

	// No config yet: not an error, just "nothing configured".
	if cfg, err := s.GetZohoConfig(); err != nil || cfg != nil {
		t.Fatalf("expected no config, got %+v, %v", cfg, err)
	}
	if s.IsZohoEnabled() {
		t.Fatal("Zoho must be disabled before setup")
	}
	// A fresh install has no config file at all: every entry point must fail
	// closed instead of dereferencing a nil config.
	if status := s.GetZohoStatus(); status["enabled"] != false || status["configured"] != false {
		t.Fatalf("a fresh install must report Zoho as disabled: %v", status)
	}
	if _, err := s.GetValidAccessToken(); err == nil {
		t.Fatal("requesting a token without a config must fail, not panic")
	}
	if err := s.RefreshAccessToken(); err == nil {
		t.Fatal("refreshing without a config must fail, not panic")
	}
	if err := s.DisableZohoIntegration(); err == nil {
		t.Fatal("disabling a missing config must fail, not panic")
	}
	if err := s.CreateZohoInvoice(&domain.Sale{ID: "no-config"}); err != nil {
		t.Fatalf("invoicing without a config must be a no-op: %v", err)
	}

	writeZohoConfig(t, s, time.Now().Unix()+3600)

	loaded, err := s.LoadZohoConfig()
	if err != nil || loaded == nil {
		t.Fatalf("LoadZohoConfig = %+v, %v", loaded, err)
	}
	if loaded.OrganizationID != "org-1" || !s.IsZohoEnabled() {
		t.Fatalf("config not round-tripped: %+v", loaded)
	}

	// The refresh token is the credential: without it Zoho counts as disabled.
	loaded.RefreshToken = ""
	if err := s.SaveZohoConfig(loaded); err != nil {
		t.Fatalf("SaveZohoConfig: %v", err)
	}
	if s.IsZohoEnabled() {
		t.Fatal("a config without a refresh token must not count as enabled")
	}

	loaded.RefreshToken = "refresh-token"
	if err := s.SaveZohoConfig(loaded); err != nil {
		t.Fatalf("SaveZohoConfig: %v", err)
	}
	if err := s.DisableZohoIntegration(); err != nil {
		t.Fatalf("DisableZohoIntegration: %v", err)
	}
	if s.IsZohoEnabled() {
		t.Fatal("DisableZohoIntegration must disable the integration")
	}

	// A tampered/corrupt config file must fail closed.
	if err := os.WriteFile(getZohoConfigPath(), []byte("garbage"), 0600); err != nil {
		t.Fatalf("write corrupt config: %v", err)
	}
	resetZohoState(t)
	if _, err := s.LoadZohoConfig(); err == nil {
		t.Fatal("a corrupt Zoho config must be reported, not ignored")
	}
	if s.IsZohoEnabled() {
		t.Fatal("a corrupt config must never count as enabled")
	}
	if status := s.GetZohoStatus(); status["enabled"] != false {
		t.Fatalf("a corrupt config must report as disabled: %v", status)
	}
}

func TestZohoStatusReport(t *testing.T) {
	isolateConfigDir(t)
	s := zohoTestService(t)

	writeZohoConfig(t, s, time.Now().Unix()+3600)
	status := s.GetZohoStatus()
	if status["enabled"] != true || status["configured"] != true {
		t.Fatalf("unexpected status: %v", status)
	}
	if status["organizationId"] != "org-1" {
		t.Fatalf("organization id missing from status: %v", status)
	}
	if status["queueLength"] != 0 {
		t.Fatalf("expected an empty queue, got %v", status["queueLength"])
	}
}

func TestExchangeCodeForToken(t *testing.T) {
	isolateConfigDir(t)
	s := zohoTestService(t)

	script := &mutableResponse{}
	server := httptest.NewServer(script)
	defer server.Close()
	pointZohoAt(t, server.URL)

	script.set(`{"access_token":"a-1","refresh_token":"r-1","expires_in":3600,"token_type":"Bearer"}`)
	token, err := s.ExchangeCodeForToken("id", "secret", "code")
	if err != nil || token == nil || token.AccessToken != "a-1" || token.RefreshToken != "r-1" {
		t.Fatalf("ExchangeCodeForToken = %+v, %v", token, err)
	}

	// Zoho reports failures in the body with HTTP 200.
	script.set(`{"error":"invalid_code"}`)
	if _, err := s.ExchangeCodeForToken("id", "secret", "bad"); err == nil {
		t.Fatal("an OAuth error field must surface as an error")
	}

	script.set("not json")
	if _, err := s.ExchangeCodeForToken("id", "secret", "code"); err == nil {
		t.Fatal("a malformed token response must surface as an error")
	}
}

func TestRefreshAccessTokenAndValidToken(t *testing.T) {
	isolateConfigDir(t)
	s := zohoTestService(t)

	script := &mutableResponse{}
	server := httptest.NewServer(script)
	defer server.Close()
	pointZohoAt(t, server.URL)

	// Still valid: no refresh round trip.
	writeZohoConfig(t, s, time.Now().Unix()+3600)
	if token, err := s.GetValidAccessToken(); err != nil || token != "access-token" {
		t.Fatalf("GetValidAccessToken = %q, %v", token, err)
	}

	// Expiring: the token is refreshed and persisted.
	writeZohoConfig(t, s, time.Now().Unix()-10)
	script.set(`{"access_token":"fresh-token","expires_in":3600}`)
	token, err := s.GetValidAccessToken()
	if err != nil || token != "fresh-token" {
		t.Fatalf("refreshed token = %q, %v", token, err)
	}
	reloaded, err := s.LoadZohoConfig()
	if err != nil || reloaded.AccessToken != "fresh-token" {
		t.Fatalf("refreshed token must be persisted: %+v, %v", reloaded, err)
	}
	if reloaded.TokenExpiry <= time.Now().Unix() {
		t.Fatal("refreshed token expiry must move into the future")
	}

	// A failed refresh must be reported.
	writeZohoConfig(t, s, time.Now().Unix()-10)
	script.set(`{"error":"invalid_client"}`)
	if _, err := s.GetValidAccessToken(); err == nil {
		t.Fatal("a failed refresh must surface an error")
	}
}

func TestGetOrganizationID(t *testing.T) {
	isolateConfigDir(t)
	s := zohoTestService(t)

	script := &mutableResponse{}
	server := httptest.NewServer(script)
	defer server.Close()
	pointZohoAt(t, server.URL)
	writeZohoConfig(t, s, time.Now().Unix()+3600)

	script.set(`{"organizations":[{"organization_id":"org-a","is_primary":false},{"organization_id":"org-b","is_primary":true}]}`)
	if org, err := s.GetOrganizationID(); err != nil || org != "org-b" {
		t.Fatalf("GetOrganizationID must prefer the primary org: %q, %v", org, err)
	}

	script.set(`{"organizations":[{"organization_id":"org-a","is_primary":false}]}`)
	if org, err := s.GetOrganizationID(); err != nil || org != "org-a" {
		t.Fatalf("GetOrganizationID must fall back to the first org: %q, %v", org, err)
	}

	script.set(`{"organizations":[]}`)
	if _, err := s.GetOrganizationID(); err == nil {
		t.Fatal("an account without organisations must fail")
	}

	script.set("not json")
	if _, err := s.GetOrganizationID(); err == nil {
		t.Fatal("a malformed organisations payload must fail")
	}
}

func TestCreateZohoInvoice(t *testing.T) {
	isolateConfigDir(t)
	service, db, cleanup := setupTestIntegration(t)
	defer cleanup()
	resetZohoState(t)
	s := service.(*cloudService)

	script := &mutableResponse{}
	server := httptest.NewServer(script)
	defer server.Close()
	pointZohoAt(t, server.URL)

	sale := domain.Sale{
		ID:           "sale-1",
		CustomerName: "عميل",
		Date:         "2026-10-06",
		Items:        []domain.SaleItem{{Name: "صنف", Price: 1500, Quantity: 2}},
	}
	if err := db.Create(&sale).Error; err != nil {
		t.Fatalf("seed sale: %v", err)
	}

	// Disabled integration: nothing is sent, nothing is queued.
	if err := s.CreateZohoInvoice(&sale); err != nil {
		t.Fatalf("a disabled integration must be a no-op: %v", err)
	}
	if len(syncQueue) != 0 {
		t.Fatalf("nothing may be queued while disabled: %v", syncQueue)
	}

	writeZohoConfig(t, s, time.Now().Unix()+3600)

	// Success: the invoice is posted and the sale is marked as synced.
	script.set(`{"code":0,"invoice":{"invoice_id":"inv-1"}}`)
	if err := s.CreateZohoInvoice(&sale); err != nil {
		t.Fatalf("CreateZohoInvoice: %v", err)
	}
	var stored domain.Sale
	if err := db.First(&stored, "id = ?", "sale-1").Error; err != nil {
		t.Fatalf("reload sale: %v", err)
	}
	if !stored.ZohoSynced {
		t.Fatal("a successful invoice must mark the sale as synced")
	}

	// API rejection: the sale goes back on the retry queue.
	if err := db.Model(&domain.Sale{}).Where("id = ?", "sale-1").Update("zoho_synced", false).Error; err != nil {
		t.Fatalf("reset sync flag: %v", err)
	}
	script.setRaw(`{"code":1234,"message":"internal error"}`, http.StatusInternalServerError)
	if err := s.CreateZohoInvoice(&sale); err == nil {
		t.Fatal("an API rejection must surface as an error")
	}
	if len(syncQueue) != 1 || syncQueue[0].SaleID != "sale-1" {
		t.Fatalf("a rejected invoice must be queued for retry: %v", syncQueue)
	}

	// A broken token endpoint also queues the sale instead of dropping it.
	writeZohoConfig(t, s, time.Now().Unix()-10)
	script.setRaw("<html>bad gateway</html>", http.StatusBadGateway)
	if err := s.CreateZohoInvoice(&sale); err == nil {
		t.Fatal("a failed token refresh must surface as an error")
	}
	if len(syncQueue) != 1 {
		t.Fatalf("the queue must not duplicate an already queued sale: %v", syncQueue)
	}
}

func TestAddToSyncQueueDeduplicates(t *testing.T) {
	isolateConfigDir(t)
	s := zohoTestService(t)

	s.AddToSyncQueue("sale-1")
	s.AddToSyncQueue("sale-1")
	s.AddToSyncQueue("sale-2")
	if len(syncQueue) != 2 {
		t.Fatalf("the queue must not hold duplicates: %v", syncQueue)
	}
	if syncQueue[0].CreatedAt == "" || syncQueue[0].Retries != 0 {
		t.Fatalf("queued entries must carry a timestamp: %v", syncQueue[0])
	}
}

func TestProcessSyncQueue(t *testing.T) {
	isolateConfigDir(t)
	service, db, cleanup := setupTestIntegration(t)
	defer cleanup()
	resetZohoState(t)
	s := service.(*cloudService)

	script := &mutableResponse{}
	script.set(`{"code":0}`)
	server := httptest.NewServer(script)
	defer server.Close()
	pointZohoAt(t, server.URL)

	if err := db.Create(&domain.Sale{ID: "sale-9", CustomerName: "عميل"}).Error; err != nil {
		t.Fatalf("seed sale: %v", err)
	}

	// Disabled: the queue is never drained.
	s.ProcessSyncQueue()
	var stored domain.Sale
	_ = db.First(&stored, "id = ?", "sale-9").Error
	if stored.ZohoSynced {
		t.Fatal("nothing may sync while the integration is disabled")
	}

	writeZohoConfig(t, s, time.Now().Unix()+3600)
	s.ProcessSyncQueue()
	_ = db.First(&stored, "id = ?", "sale-9").Error
	if !stored.ZohoSynced {
		t.Fatal("the queue worker must sync outstanding sales once enabled")
	}
}

func TestSetupZohoIntegrationEndToEnd(t *testing.T) {
	isolateConfigDir(t)
	s := zohoTestService(t)

	script := &mutableResponse{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/oauth/v2/token"):
			_ = r.ParseForm()
			if r.FormValue("code") == "bad" {
				script.set(`{"error":"invalid_code"}`)
			} else {
				script.set(`{"access_token":"a-1","refresh_token":"r-1","expires_in":3600,"token_type":"Bearer"}`)
			}
		case strings.HasSuffix(r.URL.Path, "/organizations"):
			script.set(`{"organizations":[{"organization_id":"org-x","is_primary":true}]}`)
		default:
			script.set(`{"code":0}`)
		}
		script.ServeHTTP(w, r)
	}))
	defer server.Close()
	pointZohoAt(t, server.URL)

	if err := s.SetupZohoIntegration("client-id", "client-secret", "auth-code"); err != nil {
		t.Fatalf("SetupZohoIntegration: %v", err)
	}

	cfg, err := s.LoadZohoConfig()
	if err != nil || cfg == nil {
		t.Fatalf("LoadZohoConfig after setup = %+v, %v", cfg, err)
	}
	if !cfg.Enabled || cfg.OrganizationID != "org-x" || cfg.RefreshToken != "r-1" {
		t.Fatalf("setup did not persist the full config: %+v", cfg)
	}
	if !s.IsZohoEnabled() {
		t.Fatal("the integration must be enabled after a successful setup")
	}

	// A failing code exchange must surface as an error and not silently succeed.
	resetZohoState(t)
	if err := s.SetupZohoIntegration("client-id", "client-secret", "bad"); err == nil {
		t.Fatal("a failing setup must surface an error")
	}
}
