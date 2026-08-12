package e2e

import (
	"net/http"
	"strings"
	"testing"

	"beidar-desktop/internal/core/domain"
)

// TestE2E_LANServerAdminOps covers the LAN handler operations that manage the
// server and its connected clients: start/stop, status, secret rotation,
// suspend/resume, and disconnect.
func TestE2E_LANServerAdminOps(t *testing.T) {
	server, cleanup := NewHarness(t)
	defer cleanup()

	server.LoginAsAdmin(t)
	defer server.DeferLogout()

	// Handler-level server lifecycle on the default LAN port.
	if err := server.LanHandler.StartLanServer(); err != nil {
		t.Fatalf("StartLanServer failed: %v", err)
	}
	defer func() { _ = server.LanHandler.StopLanServer() }()

	status := server.LanHandler.GetLanServerStatus()
	if !status.Running {
		t.Fatal("expected server status to be running")
	}

	ip, err := server.LanHandler.GetLocalIP()
	if err != nil || ip == "" {
		t.Errorf("GetLocalIP = %q, err=%v", ip, err)
	}

	// Secret rotation and retrieval.
	newSecret, err := server.LanHandler.GenerateServerSecret()
	if err != nil {
		t.Fatalf("GenerateServerSecret failed: %v", err)
	}
	if newSecret == "" {
		t.Error("expected a non-empty generated secret")
	}
	secret, err := server.LanHandler.GetServerSecret()
	if err != nil {
		t.Fatalf("GetServerSecret failed: %v", err)
	}
	if secret == "" || secret != newSecret {
		t.Errorf("GetServerSecret = %q, want the generated secret", secret)
	}

	// Before any client connects.
	if clients := server.LanHandler.GetConnectedClients(); len(clients) != 0 {
		t.Errorf("connected clients before connect = %d, want 0", len(clients))
	}

	// Client mode on the same machine, pointed at our server.
	client, cleanupClient := NewHarness(t)
	defer cleanupClient()
	client.LoginAsAdmin(t)
	defer client.DeferLogout()

	// Not connected yet -> standalone.
	cs := client.LanHandler.GetLanClientStatus()
	if cs.Connected || cs.Mode != "standalone" {
		t.Errorf("expected standalone client status, got %+v", cs)
	}
	if s := client.LanHandler.TestLanConnection(); !strings.Contains(s, "Not connected") {
		t.Errorf("TestLanConnection when disconnected = %q", s)
	}

	status = server.LanHandler.GetLanServerStatus()
	if err := client.LanHandler.ConnectToLanServer("127.0.0.1", status.Port, secret); err != nil {
		t.Fatalf("ConnectToLanServer failed: %v", err)
	}

	// Client sees itself connected in client mode.
	cs = client.LanHandler.GetLanClientStatus()
	if !cs.Connected || cs.Mode != "client" || cs.ServerAddress == "" {
		t.Errorf("expected connected client status, got %+v", cs)
	}

	// Server sees exactly one client.
	clients := server.LanHandler.GetConnectedClients()
	if len(clients) != 1 {
		t.Fatalf("connected clients = %d, want 1", len(clients))
	}
	deviceID := clients[0].DeviceID
	if deviceID == "" {
		t.Fatal("client has no device id")
	}

	// TestConnection through the client round-trips /api/products.
	if s := client.LanHandler.TestLanConnection(); !strings.Contains(s, "Status 200") {
		t.Errorf("TestLanConnection after connect = %q, want 200", s)
	}

	// RemoteGet over the LAN returns the paginated products endpoint.
	var page struct {
		Data  []domain.Product `json:"data"`
		Total int64            `json:"total"`
	}
	if err := client.Lan.RemoteGet("/api/products", &page); err != nil {
		t.Fatalf("RemoteGet failed: %v", err)
	}

	// Suspending the client blocks its remote operations and is observable.
	if err := server.LanHandler.SuspendLanClient(deviceID); err != nil {
		t.Fatalf("SuspendLanClient failed: %v", err)
	}
	clients = server.LanHandler.GetConnectedClients()
	if len(clients) != 1 || clients[0].Status != "suspended" {
		t.Errorf("expected client to be suspended, got %+v", clients)
	}
	if err := client.Lan.RemoteGet("/api/products", &page); err == nil {
		t.Error("expected suspended client remote call to fail")
	}

	// Resume restores the remote session.
	if err := server.LanHandler.ResumeLanClient(deviceID); err != nil {
		t.Fatalf("ResumeLanClient failed: %v", err)
	}
	clients = server.LanHandler.GetConnectedClients()
	if len(clients) != 1 || clients[0].Status != "active" {
		t.Errorf("expected client to be active again, got %+v", clients)
	}
	if err := client.Lan.RemoteGet("/api/products", &page); err != nil {
		t.Errorf("RemoteGet after resume failed: %v", err)
	}

	// Disconnect the client from the server side.
	if err := server.LanHandler.DisconnectLanClient(deviceID); err != nil {
		t.Fatalf("DisconnectLanClient failed: %v", err)
	}
	if clients := server.LanHandler.GetConnectedClients(); len(clients) != 0 {
		t.Errorf("connected clients after disconnect = %d, want 0", len(clients))
	}

	// Client-side disconnect from the server.
	status = server.LanHandler.GetLanServerStatus()
	if err := client.LanHandler.ConnectToLanServer("127.0.0.1", status.Port, secret); err != nil {
		t.Fatalf("reconnect failed: %v", err)
	}
	client.LanHandler.DisconnectFromLanServer()
	cs = client.LanHandler.GetLanClientStatus()
	if cs.Connected || cs.Mode != "standalone" {
		t.Errorf("expected standalone after client disconnect, got %+v", cs)
	}
}

// TestE2E_LANHandlerRequiresPermissionForServerOps ensures the admin-only LAN
// management operations reject a cashier session on the backend, not just in
// the UI.
func TestE2E_LANHandlerRequiresPermissionForServerOps(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	// CreateStaff requires an authenticated session; log in as admin first.
	h.LoginAsAdmin(t)

	// Seed a cashier.
	if _, err := h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "كاشير الشبكة",
		Username: "lancashier",
		Role:     domain.RoleCashier,
		Active:   true,
	}, "5739"); err != nil {
		t.Fatalf("CreateStaff failed: %v", err)
	}

	// Switch to the cashier session.
	h.DeferLogout()
	result, err := h.StaffHandler.AuthenticateByUsername("lancashier", "5739")
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	if !result.Success {
		t.Fatalf("login rejected: %s", result.Message)
	}
	defer h.DeferLogout()

	if err := h.LanHandler.StartLanServer(); err == nil {
		t.Error("cashier must not be able to start the LAN server")
	}
	if _, err := h.LanHandler.GenerateServerSecret(); err == nil {
		t.Error("cashier must not be able to generate the server secret")
	}
	if err := h.LanHandler.BlockLanDevice("d1", "n", "r"); err == nil {
		t.Error("cashier must not be able to block devices")
	}
	if err := h.LanHandler.SuspendLanClient("d1"); err == nil {
		t.Error("cashier must not be able to suspend clients")
	}
}

// TestE2E_RemoteScanWrongMethodRejected guards the remote-scan endpoint's
// method/secret gate through the real HTTP surface.
func TestE2E_RemoteScanMethodAndSecretGate(t *testing.T) {
	server, cleanup := NewHarness(t)
	defer cleanup()

	server.LoginAsAdmin(t)

	port := pickFreePort(t)
	if err := server.Lan.StartServer(port); err != nil {
		t.Fatalf("StartServer failed: %v", err)
	}
	defer func() { _ = server.Lan.StopServer() }()

	secret, _ := server.LanHandler.GetServerSecret()
	base := "http://127.0.0.1:" + itoa(port)

	// GET on a POST-only endpoint must not be accepted.
	req, err := http.NewRequest(http.MethodGet, base+"/api/remote-scan", nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET remote-scan: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		t.Error("GET /api/remote-scan must not succeed")
	}

	// Correct secret + POST is accepted (200 in-app or 503 headless, never 401).
	if code := postBarcode(base, secret, "555666777"); code == http.StatusUnauthorized {
		t.Error("correct secret must pass the auth gate")
	}
}
