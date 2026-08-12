package network_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/network"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
)

// Helper function to setup a test LAN server
func setupTestLANServer(t *testing.T) (network.LanService, string, func()) {
	db, cleanup := testutil.SetupFullDB(t)
	testutil.SeedPreferences(t, db)

	netRepo := repository.NewNetworkRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)
	prodRepo := repository.NewProductRepository(db)
	settingsSvc := service.NewSettingsService(prefRepo)
	prodSvc := service.NewProductService(prodRepo)

	lanSvc := network.NewLanService(netRepo, prodSvc, nil, nil, nil, nil, settingsSvc, nil, nil)

	err := lanSvc.StartServer(0)
	if err != nil {
		cleanup()
		t.Fatalf("failed to start LAN server: %v", err)
	}

	status := lanSvc.GetServerStatus()
	serverURL := fmt.Sprintf("http://127.0.0.1:%d", status.Port)

	fullCleanup := func() {
		_ = lanSvc.StopServer()
		cleanup()
	}

	return lanSvc, serverURL, fullCleanup
}

// 1. TestNetwork_LAN_LargePayloadDoS: Protect against Denial of Service via huge JSON bodies
func TestNetwork_LAN_LargePayloadDoS(t *testing.T) {
	_, serverURL, cleanup := setupTestLANServer(t)
	defer cleanup()

	// Construct a 10MB dummy string payload
	hugeData := strings.Repeat("A", 10*1024*1024)
	payload, _ := json.Marshal(map[string]string{
		"deviceId": "dev-dos",
		"secret":   "fake-secret",
		"data":     hugeData,
	})

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Post(serverURL+"/api/connect", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		// Server closing connection on large payload is acceptable behavior
		return
	}
	defer resp.Body.Close()

	// Must either reject with Bad Request, Payload Too Large, or rate limit/tarpit
	if resp.StatusCode == http.StatusOK {
		t.Errorf("expected server to reject oversized payload, got status %d", resp.StatusCode)
	}
}

// 2. TestNetwork_LAN_UnauthorizedRoleAccess: Verify cashier token cannot access admin routes
func TestNetwork_LAN_UnauthorizedRoleAccess(t *testing.T) {
	lanSvc, serverURL, cleanup := setupTestLANServer(t)
	defer cleanup()

	// Connect as regular device
	secret := lanSvc.GetServerSecret()
	connectPayload, _ := json.Marshal(map[string]string{
		"deviceId":   "cashier-pos-1",
		"deviceName": "Cashier Device",
		"secret":     secret,
		"role":       string(domain.RoleCashier),
	})

	respConnect, err := http.Post(serverURL+"/api/connect", "application/json", bytes.NewBuffer(connectPayload))
	if err != nil || respConnect.StatusCode != http.StatusOK {
		t.Fatalf("failed to connect as cashier: %v", err)
	}

	var connResult struct {
		Token string `json:"token"`
	}
	_ = json.NewDecoder(respConnect.Body).Decode(&connResult)
	respConnect.Body.Close()

	// Attempt to hit admin routes with Cashier token
	adminEndpoints := []string{
		"/api/admin/clients",
		"/api/admin/blocked",
		"/api/database/export",
		"/api/expenses",
		"/api/stats/dashboard",
	}

	client := &http.Client{Timeout: 2 * time.Second}

	for _, ep := range adminEndpoints {
		req, _ := http.NewRequest("GET", serverURL+ep, nil)
		req.Header.Set("X-Session-Token", connResult.Token)

		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("failed request to %s: %v", ep, err)
		}
		resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			t.Errorf("SECURITY RISK: Cashier token accessed admin endpoint %s with status 200 OK", ep)
		}
	}
}

// 3. TestNetwork_LAN_InvalidSessionTokenReplay: Tampered tokens must be rejected
func TestNetwork_LAN_InvalidSessionTokenReplay(t *testing.T) {
	_, serverURL, cleanup := setupTestLANServer(t)
	defer cleanup()

	invalidTokens := []string{
		"invalid-token-12345",
		"Bearer admin-secret-forged",
		"' OR '1'='1",
		"",
	}

	client := &http.Client{Timeout: 2 * time.Second}

	for _, token := range invalidTokens {
		req, _ := http.NewRequest("GET", serverURL+"/api/products", nil)
		if token != "" {
			req.Header.Set("X-Session-Token", token)
		}

		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("failed to send request: %v", err)
		}
		resp.Body.Close()

		if resp.StatusCode != http.StatusUnauthorized && resp.StatusCode != http.StatusForbidden {
			t.Errorf("expected 401/403 for token '%s', got status %d", token, resp.StatusCode)
		}
	}
}

// 4. TestNetwork_LAN_MalformedJSONPayloads: Ensure null bytes and garbage JSON don't panic server
func TestNetwork_LAN_MalformedJSONPayloads(t *testing.T) {
	_, serverURL, cleanup := setupTestLANServer(t)
	defer cleanup()

	garbagePayloads := [][]byte{
		[]byte("{malformed_json:"),
		[]byte("\x00\x01\x02\x03\x04"),
		[]byte("{\"deviceId\": null}"),
		[]byte(""),
	}

	client := &http.Client{Timeout: 2 * time.Second}

	for i, payload := range garbagePayloads {
		resp, err := client.Post(serverURL+"/api/connect", "application/json", bytes.NewBuffer(payload))
		if err != nil {
			continue // Closed connection is safe
		}
		resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			t.Errorf("payload %d: server returned 200 OK for garbage input", i)
		}
	}
}

// 5. TestNetwork_LAN_RemoteScan_SecretProtection: Ensure scanner gate works
func TestNetwork_LAN_RemoteScan_SecretProtection(t *testing.T) {
	_, serverURL, cleanup := setupTestLANServer(t)
	defer cleanup()

	payload, _ := json.Marshal(map[string]string{
		"barcode": "123456789",
		"secret":  "invalid-secret",
	})

	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Post(serverURL+"/api/remote-scan", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		t.Fatalf("failed to post /api/remote-scan: %v", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized && resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 401/403 for invalid scan secret, got %d", resp.StatusCode)
	}
}

// 6. BenchmarkLAN_PingLatency: Measure /api/ping throughput and latency
func BenchmarkLAN_PingLatency(b *testing.B) {
	t := &testing.T{}
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	netRepo := repository.NewNetworkRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)
	prodRepo := repository.NewProductRepository(db)
	settingsSvc := service.NewSettingsService(prefRepo)
	prodSvc := service.NewProductService(prodRepo)

	lanSvc := network.NewLanService(netRepo, prodSvc, nil, nil, nil, nil, settingsSvc, nil, nil)
	_ = lanSvc.StartServer(0)
	defer lanSvc.StopServer()

	status := lanSvc.GetServerStatus()
	pingURL := fmt.Sprintf("http://127.0.0.1:%d/api/ping", status.Port)

	client := &http.Client{Timeout: 1 * time.Second}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		resp, err := client.Get(pingURL)
		if err == nil {
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
		}
	}
}
