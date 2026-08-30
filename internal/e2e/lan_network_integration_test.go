package e2e

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
	"github.com/google/uuid"
)

// TestE2E_LAN_AuthenticatedRemoteSaleAndBlockedClient tests the LAN distributed architecture:
// 1. LAN server boots and generates an ephemeral secret.
// 2. Client POS connects over local loopback using the server secret.
// 3. Client executes a remote credit sale with customer debt and stock reduction on the master server.
// 4. Server administrative suspension of the client device stops future client remote operations.
func TestE2E_LAN_AuthenticatedRemoteSaleAndBlockedClient(t *testing.T) {
	// ── 1. Start Server ───────────────────────────────────────────────────
	server, serverCleanup := NewHarness(t)
	defer serverCleanup()

	server.LoginAsAdmin(t)
	defer server.DeferLogout()

	port := pickFreePort(t)
	if err := server.Lan.StartServer(port); err != nil {
		t.Fatalf("StartServer on port %d failed: %v", port, err)
	}
	defer func() { _ = server.Lan.StopServer() }()

	secret, err := server.LanHandler.GetServerSecret()
	if err != nil || secret == "" {
		t.Fatalf("failed to retrieve server secret: %v", err)
	}

	// Seed product and customer on server
	prod := server.NewProduct("كمبيوتر مكتبي خادم", 400000, 10)
	cust := server.NewCustomer("شركة النظم البعيدة", 0)

	// ── 2. Connect Client ─────────────────────────────────────────────────
	client, clientCleanup := NewHarness(t)
	defer clientCleanup()

	client.LoginAsAdmin(t)
	defer client.DeferLogout()

	if err := client.LanHandler.ConnectToLanServer("127.0.0.1", port, secret); err != nil {
		t.Fatalf("Client ConnectToLanServer failed: %v", err)
	}
	if !client.Lan.IsClientMode() {
		t.Fatal("expected client to be in client mode")
	}

	// ── 3. Client executes Remote Credit Sale ──────────────────────────────
	remoteSale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    cust.ID,
		CustomerName:  cust.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      prod.Price,
		Total:         prod.Price,
		PaymentMethod: "credit",
		Status:        "pending",
		ItemsCount:    1,
		Items: []domain.SaleItem{
			{ProductID: prod.ID, Name: prod.Name, Quantity: 1, Price: prod.Price, Total: prod.Price},
		},
	}

	if err := client.SaleHandler.ProcessSale(remoteSale); err != nil {
		t.Fatalf("Client ProcessSale remote failed: %v", err)
	}

	// Verify server updated stock to 9 and customer debt to 400,000
	pServer := server.MustReloadProduct(prod.ID)
	if pServer.Stock != 9 {
		t.Errorf("expected server product stock 9, got %v", pServer.Stock)
	}

	cServer := server.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(cServer.Debt, prod.Price) {
		t.Errorf("expected server customer debt %s, got %s", prod.Price.String(), cServer.Debt.String())
	}

	// ── 4. Server Suspends Client Device ───────────────────────────────────
	connectedClients := server.LanHandler.GetConnectedClients()
	if len(connectedClients) == 0 {
		t.Fatal("expected at least 1 connected client")
	}
	clientDeviceID := connectedClients[0].DeviceID

	if err := server.LanHandler.SuspendLanClient(clientDeviceID); err != nil {
		t.Fatalf("SuspendLanClient failed: %v", err)
	}

	// ── 5. Client subsequent remote operation must fail when suspended ──────
	suspendedSale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    cust.ID,
		CustomerName:  cust.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      prod.Price,
		Total:         prod.Price,
		PaymentMethod: "cash",
		Status:        "completed",
		ItemsCount:    1,
		Items: []domain.SaleItem{
			{ProductID: prod.ID, Name: prod.Name, Quantity: 1, Price: prod.Price, Total: prod.Price},
		},
	}

	err = client.SaleHandler.ProcessSale(suspendedSale)
	if err == nil {
		t.Fatal("expected suspended client remote sale to fail")
	}

	// Disconnect client cleanly
	client.LanHandler.DisconnectFromLanServer()
}
