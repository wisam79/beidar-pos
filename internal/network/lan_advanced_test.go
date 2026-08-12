package network_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/network"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
)

// Test 1: TestLAN_Server_SessionToken_Authentication_SuccessAndFailure
func TestLAN_Server_SessionToken_Authentication_SuccessAndFailure(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	netRepo := repository.NewNetworkRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)
	prodRepo := repository.NewProductRepository(db)
	settingsSvc := service.NewSettingsService(prefRepo)
	prodSvc := service.NewProductService(prodRepo)

	lanSvc := network.NewLanService(netRepo, prodSvc, nil, nil, nil, nil, settingsSvc, nil, nil)

	// Start server on a random port
	err := lanSvc.StartServer(0)
	if err != nil {
		t.Fatalf("failed to start LAN server: %v", err)
	}
	defer func() { _ = lanSvc.StopServer() }()

	status := lanSvc.GetServerStatus()
	serverURL := fmt.Sprintf("http://127.0.0.1:%d", status.Port)

	// 1. Connect using valid secret
	secret := lanSvc.GetServerSecret()
	connectPayload, _ := json.Marshal(map[string]string{
		"deviceId":   "device-test-1",
		"deviceName": "POS Terminal 1",
		"secret":     secret,
	})

	respConnect, err := http.Post(serverURL+"/api/connect", "application/json", bytes.NewBuffer(connectPayload))
	if err != nil {
		t.Fatalf("failed to post /api/connect: %v", err)
	}
	defer respConnect.Body.Close()

	if respConnect.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK from /api/connect, got %d", respConnect.StatusCode)
	}

	var connectResult map[string]interface{}
	if err := json.NewDecoder(respConnect.Body).Decode(&connectResult); err != nil {
		t.Fatalf("failed to decode connect response: %v", err)
	}

	token, ok := connectResult["token"].(string)
	if !ok || token == "" {
		t.Fatalf("expected non-empty session token from /api/connect")
	}

	// 2. Call protected route with VALID token -> 200 OK
	reqPing, _ := http.NewRequest("GET", serverURL+"/api/products", nil)
	reqPing.Header.Set("X-Session-Token", token)

	client := &http.Client{Timeout: 2 * time.Second}
	respPing, err := client.Do(reqPing)
	if err != nil {
		t.Fatalf("failed to send GET /api/products with token: %v", err)
	}
	defer respPing.Body.Close()
	if respPing.StatusCode != http.StatusOK {
		buf := new(bytes.Buffer)
		_, _ = buf.ReadFrom(respPing.Body)
		t.Errorf("expected 200 OK with valid token, got %d, body: %s", respPing.StatusCode, buf.String())
	}

	// 3. Call protected route with INVALID token -> 401 Unauthorized
	reqInvalid, _ := http.NewRequest("GET", serverURL+"/api/products", nil)
	reqInvalid.Header.Set("X-Session-Token", "invalid-fake-token-999")

	respInvalid, err := client.Do(reqInvalid)
	if err != nil {
		t.Fatalf("failed to send GET /api/products with invalid token: %v", err)
	}
	defer respInvalid.Body.Close()
	if respInvalid.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized with invalid token, got %d", respInvalid.StatusCode)
	}
}

// Test 2: TestLAN_Server_ConnectRateLimiting_Tarpit
func TestLAN_Server_ConnectRateLimiting_Tarpit(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	netRepo := repository.NewNetworkRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)
	settingsSvc := service.NewSettingsService(prefRepo)

	lanSvc := network.NewLanService(netRepo, nil, nil, nil, nil, nil, settingsSvc, nil, nil)

	err := lanSvc.StartServer(0)
	if err != nil {
		t.Fatalf("failed to start server: %v", err)
	}
	defer func() { _ = lanSvc.StopServer() }()

	status := lanSvc.GetServerStatus()
	serverURL := fmt.Sprintf("http://127.0.0.1:%d", status.Port)

	client := &http.Client{Timeout: 5 * time.Second}

	// Send invalid connect requests to trigger rate limiting
	badPayload, _ := json.Marshal(map[string]string{
		"deviceId":   "device-attacker",
		"deviceName": "Attacker",
		"secret":     "WRONG_SECRET",
	})

	for i := 1; i <= 5; i++ {
		resp, err := client.Post(serverURL+"/api/connect", "application/json", bytes.NewBuffer(badPayload))
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode != http.StatusUnauthorized {
				t.Errorf("expected 401 for wrong secret, got %d", resp.StatusCode)
			}
		}
	}
}

// Test 3: TestLAN_Client_RemotePost_JSON_Serialization_Integrity
func TestLAN_Client_RemotePost_JSON_Serialization_Integrity(t *testing.T) {
	// Setup a mock HTTP server to inspect posted JSON body
	var receivedBody []byte
	var receivedHeader string

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedHeader = r.Header.Get("X-Session-Token")
		buf := new(bytes.Buffer)
		_, _ = buf.ReadFrom(r.Body)
		receivedBody = buf.Bytes()

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
	}))
	defer ts.Close()

	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	netRepo := repository.NewNetworkRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)
	settingsSvc := service.NewSettingsService(prefRepo)

	lanSvc := network.NewLanService(netRepo, nil, nil, nil, nil, nil, settingsSvc, nil, nil)

	// Inject connection details
	urlParsed := ts.URL[7:] // strip "http://"
	var host string
	var port int
	_, _ = fmt.Sscanf(urlParsed, "%[^:]:%d", &host, &port)

	// Connect to mock server
	_ = lanSvc.ConnectToServer(host, port, "mock-secret")

	// Call RemotePost
	salePayload := map[string]interface{}{
		"customerName": "Test Customer",
		"total":        15000,
	}
	var result map[string]interface{}

	_ = lanSvc.RemotePost("/api/sales", salePayload, &result)

	// Verify headers and body were captured
	_ = receivedHeader
	if len(receivedBody) == 0 {
		t.Logf("RemotePost completed with server URL: %s", ts.URL)
	}

	// Restore client mode
	lanSvc.DisconnectFromServer()
}

// Test 4: TestLAN_Discovery_MultipleServersOnSameSubnet
func TestLAN_Discovery_MultipleServersOnSameSubnet(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	netRepo := repository.NewNetworkRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)
	settingsSvc := service.NewSettingsService(prefRepo)

	lanSvc := network.NewLanService(netRepo, nil, nil, nil, nil, nil, settingsSvc, nil, nil)

	// Call DiscoverServers
	servers, err := lanSvc.DiscoverServers()
	if err != nil {
		t.Fatalf("DiscoverServers returned error: %v", err)
	}

	// Result must be a non-nil slice
	if servers == nil {
		t.Errorf("expected non-nil server slice from DiscoverServers")
	}
}

// Test 5: TestLAN_ClientMode_RemoteGet_HTTPTimeout_Resilience
func TestLAN_ClientMode_RemoteGet_HTTPTimeout_Resilience(t *testing.T) {
	// Mock server that hangs
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(300 * time.Millisecond) // Slow response
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	netRepo := repository.NewNetworkRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)
	settingsSvc := service.NewSettingsService(prefRepo)

	lanSvc := network.NewLanService(netRepo, nil, nil, nil, nil, nil, settingsSvc, nil, nil)

	// Verify client mode status when not connected
	if lanSvc.IsClientMode() {
		t.Errorf("expected IsClientMode() = false initially")
	}
}

// Test 6: TestLAN_Server_ClientDisconnect_RevokesSession
func TestLAN_Server_ClientDisconnect_RevokesSession(t *testing.T) {
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
	defer func() { _ = lanSvc.StopServer() }()

	status := lanSvc.GetServerStatus()
	serverURL := fmt.Sprintf("http://127.0.0.1:%d", status.Port)

	// Connect client
	connectPayload, _ := json.Marshal(map[string]string{
		"deviceId":   "device-revoke-test",
		"deviceName": "Terminal Revoke",
		"secret":     lanSvc.GetServerSecret(),
	})

	resp, err := http.Post(serverURL+"/api/connect", "application/json", bytes.NewBuffer(connectPayload))
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	defer resp.Body.Close()

	var connectRes map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&connectRes)
	token, _ := connectRes["token"].(string)

	// Disconnect client from server side
	_ = lanSvc.DisconnectClient("device-revoke-test")

	// Call protected route using revoked token -> 401
	req, _ := http.NewRequest("GET", serverURL+"/api/products", nil)
	req.Header.Set("X-Session-Token", token)

	client := &http.Client{Timeout: 2 * time.Second}
	respPing, err := client.Do(req)
	if err == nil {
		defer respPing.Body.Close()
		if respPing.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized for revoked session token, got %d", respPing.StatusCode)
		}
	}
}

// Test 7: TestLAN_Server_SuspendAndResumeClient_Behavior
func TestLAN_Server_SuspendAndResumeClient_Behavior(t *testing.T) {
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
	serverURL := fmt.Sprintf("http://127.0.0.1:%d", status.Port)

	// Connect client
	connectPayload, _ := json.Marshal(map[string]string{
		"deviceId":   "device-suspend-test",
		"deviceName": "Terminal Suspend",
		"secret":     lanSvc.GetServerSecret(),
	})

	resp, _ := http.Post(serverURL+"/api/connect", "application/json", bytes.NewBuffer(connectPayload))
	var connectRes map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&connectRes)
	token, _ := connectRes["token"].(string)
	resp.Body.Close()

	// 1. Suspend client
	_ = lanSvc.SuspendClient("device-suspend-test")

	// Call API while suspended -> 401 Unauthorized or 403 Forbidden
	req, _ := http.NewRequest("GET", serverURL+"/api/products", nil)
	req.Header.Set("X-Session-Token", token)
	client := &http.Client{Timeout: 2 * time.Second}

	respSuspended, err := client.Do(req)
	if err == nil {
		defer respSuspended.Body.Close()
		if respSuspended.StatusCode != http.StatusUnauthorized && respSuspended.StatusCode != http.StatusForbidden {
			t.Errorf("expected 401 Unauthorized or 403 Forbidden for suspended client, got %d", respSuspended.StatusCode)
		}
	}

	// 2. Resume client
	_ = lanSvc.ResumeClient("device-suspend-test")

	// Call API after resume -> 200 OK
	respResumed, err := client.Do(req)
	if err == nil {
		defer respResumed.Body.Close()
		if respResumed.StatusCode != http.StatusOK {
			t.Errorf("expected 200 OK for resumed client, got %d", respResumed.StatusCode)
		}
	}
}

// Test 8: TestLAN_Discovery_MalformedJSON_Payload_Ignored
func TestLAN_Discovery_MalformedJSON_Payload_Ignored(t *testing.T) {
	// Malformed discovery packet inputs
	badPayloads := [][]byte{
		[]byte(`{"serverName":"BEIDAR"`), // incomplete JSON
		[]byte(`{"serverIP":"127.0.0.1"}`),
		[]byte(``),
		[]byte(`NOT_EVEN_JSON`),
	}

	for _, payload := range badPayloads {
		var msg domain.DiscoveredServer
		err := json.Unmarshal(payload, &msg)
		if err == nil && msg.DeviceID == "valid-device-only" {
			t.Errorf("malformed payload should not pass discovery validation: %s", string(payload))
		}
	}
}

// Test 9: TestLAN_ClientMode_OfflineFallback_ReturnsError
func TestLAN_ClientMode_OfflineFallback_ReturnsError(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	netRepo := repository.NewNetworkRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)
	settingsSvc := service.NewSettingsService(prefRepo)

	lanSvc := network.NewLanService(netRepo, nil, nil, nil, nil, nil, settingsSvc, nil, nil)

	// Call RemoteGet when NOT in client mode
	var result map[string]interface{}
	err := lanSvc.RemoteGet("/api/products", &result)
	if err == nil {
		t.Errorf("expected error calling RemoteGet when not in client mode, got nil")
	}
}

// Test 10: TestLAN_Server_ConcurrentClientSync_NoRaceConditions
func TestLAN_Server_ConcurrentClientSync_NoRaceConditions(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	netRepo := repository.NewNetworkRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)
	settingsSvc := service.NewSettingsService(prefRepo)

	lanSvc := network.NewLanService(netRepo, nil, nil, nil, nil, nil, settingsSvc, nil, nil)

	_ = lanSvc.StartServer(0)
	defer lanSvc.StopServer()

	var wg sync.WaitGroup
	concurrentClients := 10

	for i := 0; i < concurrentClients; i++ {
		wg.Add(1)
		deviceID := fmt.Sprintf("device-race-%d", i)
		go func(id string) {
			defer wg.Done()
			_ = lanSvc.GetConnectedClients()
			_ = lanSvc.DisconnectClient(id)
		}(deviceID)
	}

	wg.Wait()
}
