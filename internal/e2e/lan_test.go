package e2e

import (
	"bytes"
	"net"
	"net/http"
	"strconv"
	"testing"

	"beidar-desktop/internal/core/domain"
)

// pickFreePort reserves an ephemeral port for the LAN server so the E2E test
// never collides with a real server running on the default port.
func pickFreePort(t *testing.T) int {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("cannot reserve a free port: %v", err)
	}
	port := l.Addr().(*net.TCPAddr).Port
	_ = l.Close() // released; server binds to it right after
	return port
}

// itoa is a minimal int→string helper to avoid importing strconv at every site.
func itoa(n int) string {
	return strconv.Itoa(n)
}

// postBarcode POSTs a remote-scan payload to the server and returns the HTTP
// status code.
func postBarcode(base, secret, code string) int {
	payload := `{"code":"` + code + `","type":"barcode"}`
	req, err := http.NewRequest(http.MethodPost, base+"/api/remote-scan", bytes.NewBufferString(payload))
	if err != nil {
		return -1
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Server-Secret", secret)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return -1
	}
	defer resp.Body.Close()
	return resp.StatusCode
}

func TestE2E_LANServerConnectAndRemoteSale(t *testing.T) {
	// ── Server harness ────────────────────────────────────────────────────────
	server, cleanupServer := NewHarness(t)
	defer cleanupServer()

	server.LoginAsAdmin(t)

	port := pickFreePort(t)
	if err := server.Lan.StartServer(port); err != nil {
		t.Fatalf("StartServer failed: %v", err)
	}
	defer func() { _ = server.Lan.StopServer() }()

	if !server.Lan.IsServerRunning() {
		t.Fatal("server should be running")
	}

	secret, err := server.LanHandler.GetServerSecret()
	if err != nil {
		t.Fatalf("GetServerSecret failed: %v", err)
	}
	if secret == "" {
		t.Fatal("server secret must be non-empty")
	}

	// Seed a product on the server that the remote client will sell.
	product := server.NewProduct("منتج LAN", 10000, 50)
	customer := server.NewCustomer("عميل LAN", 0)

	serverStatus := server.Lan.GetServerStatus()
	if !serverStatus.Running {
		t.Fatal("server status should report running")
	}
	if serverStatus.Port == 0 {
		t.Fatal("server status should report the bound port")
	}

	// ── Client harness ────────────────────────────────────────────────────────
	client, clientCleanup := NewHarness(t)
	defer clientCleanup()

	client.LoginAsAdmin(t)
	defer client.DeferLogout()

	if err := client.LanHandler.ConnectToLanServer("127.0.0.1", port, secret); err != nil {
		t.Fatalf("ConnectToLanServer failed: %v", err)
	}
	if !client.Lan.IsClientMode() {
		t.Fatal("client should be in client mode")
	}

	// Server sees the connected client.
	clients := server.LanHandler.GetConnectedClients()
	if len(clients) != 1 {
		t.Fatalf("connected clients = %d, want 1", len(clients))
	}

	// ── Remote cash sale through the client's SaleHandler ────────────────────
	sale := domain.Sale{
		ID: newSaleID(),
		CustomerID: customer.ID,
		CustomerName: customer.Name,
		Date:          "2026-01-20",
		Timestamp:     1769126400000,
		Subtotal:      product.Price,
		Total:         product.Price,
		PaymentMethod: "cash",
		Status:        "completed",
		ItemsCount:    1,
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  1,
			Price:     product.Price,
			Total:     product.Price,
		}},
	}
	if err := client.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("remote ProcessSale failed: %v", err)
	}

	// The sale must be visible on the server.
	serverSales, err := server.SaleHandler.GetSales(1, 50, "", "", "")
	if err != nil {
		t.Fatalf("server GetSales failed: %v", err)
	}
	if serverSales.Total != 1 {
		t.Errorf("server sale total = %d, want 1", serverSales.Total)
	}

	// Stock was deducted on the server.
	reloaded := server.MustReloadProduct(product.ID)
	if reloaded.Stock != 49 {
		t.Errorf("server stock = %v, want 49", reloaded.Stock)
	}
}

func TestE2E_LANBlockedDeviceRejected(t *testing.T) {
	server, cleanup := NewHarness(t)
	defer cleanup()

	server.LoginAsAdmin(t)

	port := pickFreePort(t)
	if err := server.Lan.StartServer(port); err != nil {
		t.Fatalf("StartServer failed: %v", err)
	}
	defer func() { _ = server.Lan.StopServer() }()

	secret, _ := server.LanHandler.GetServerSecret()

	// Connect once to learn the device ID used.
	client, clientCleanup := NewHarness(t)
	defer clientCleanup()
	client.LoginAsAdmin(t)
	defer client.DeferLogout()

	if err := client.LanHandler.ConnectToLanServer("127.0.0.1", port, secret); err != nil {
		t.Fatalf("initial connect failed: %v", err)
	}
	clients := server.LanHandler.GetConnectedClients()
	if len(clients) != 1 {
		t.Fatalf("expected 1 connected client, got %d", len(clients))
	}
	deviceID := clients[0].DeviceID
	if deviceID == "" {
		t.Fatal("device ID must not be empty")
	}

	// Block the device on the server.
	if err := server.LanHandler.BlockLanDevice(deviceID, "client-x", "مخالفة"); err != nil {
		t.Fatalf("BlockLanDevice failed: %v", err)
	}
	blocked, err := server.LanHandler.GetBlockedDevices()
	if err != nil {
		t.Fatalf("GetBlockedDevices failed: %v", err)
	}
	if len(blocked) != 1 {
		t.Fatalf("blocked devices = %d, want 1", len(blocked))
	}

	// The client registering with the blocked device ID must be rejected.
	if err := client.LanHandler.ConnectToLanServer("127.0.0.1", port, secret); err == nil {
		t.Fatal("blocked device must not be able to connect")
	}

	// Unblock and allow reconnect.
	if err := server.LanHandler.UnblockLanDevice(blocked[0].ID); err != nil {
		t.Fatalf("UnblockLanDevice failed: %v", err)
	}
	blocked2, _ := server.LanHandler.GetBlockedDevices()
	if len(blocked2) != 0 {
		t.Errorf("blocked devices after unblock = %d, want 0", len(blocked2))
	}

	if err := client.LanHandler.ConnectToLanServer("127.0.0.1", port, secret); err != nil {
		t.Fatalf("reconnect after unblock failed: %v", err)
	}
}

func TestE2E_RemoteScanEndpointRequiresSecret(t *testing.T) {
	server, cleanup := NewHarness(t)
	defer cleanup()

	server.LoginAsAdmin(t)

	port := pickFreePort(t)
	if err := server.Lan.StartServer(port); err != nil {
		t.Fatalf("StartServer failed: %v", err)
	}
	defer func() { _ = server.Lan.StopServer() }()

	base := "http://127.0.0.1:" + itoa(port)
	secret, _ := server.LanHandler.GetServerSecret()

	// No secret is rejected by /api/remote-scan.
	if code := postBarcode(base, "", "123456789"); code != 401 {
		t.Errorf("expected 401 with no secret, got %d", code)
	}
	// Unknown secret is rejected by /api/remote-scan.
	if code := postBarcode(base, "wrong-secret", "123456789"); code != 401 {
		t.Errorf("expected 401 with wrong secret, got %d", code)
	}
	// Correct secret passes the auth gate. In a headless test there is no Wails
	// frontend bound, so the desktop emits 503 "app not ready" instead of 200 —
	// but it must NEVER be 401 (that would mean the secret gate rejected us).
	if code := postBarcode(base, secret, "987654321"); code == 401 {
		t.Errorf("expected non-401 with correct secret, got %d", code)
	}
}