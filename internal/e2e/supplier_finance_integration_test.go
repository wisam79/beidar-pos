package e2e

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
	"github.com/google/uuid"
)

// TestE2E_SupplierDebt_PurchaseOrderPartialDeliveryAndPayouts tests the full supplier workflow:
// 1. Creation of supplier and purchase order.
// 2. Multi-stage partial receiving of items (inventory stock increments atomically, PO status evolves pending -> partial -> received).
// 3. Supplier payout lifecycle: partial payment reducing order debt, preventing overpayment.
// 4. Financial verification of supplier balances and purchase order statistics.
func TestE2E_SupplierDebt_PurchaseOrderPartialDeliveryAndPayouts(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// 1. Create Supplier with initial debt balance of 250,000 cents
	supplier := domain.Supplier{
		ID:          uuid.New().String(),
		Name:        "شركة النور للتجارة والتوريد",
		CompanyName: "النور المحدودة",
		Phone:       "07701234567",
		Balance:     domain.NewAmount(250000),
	}
	if err := h.Repos.supplier.Create(&supplier); err != nil {
		t.Fatalf("Create supplier failed: %v", err)
	}

	// 2. Create 2 Products for PO
	prod1 := h.NewProduct("شاحن أنكر 20 واط", 25000, 5) // Initial stock 5, Cost 15000
	prod1.Cost = domain.NewAmount(15000)
	_ = h.Repos.product.Update(prod1)

	prod2 := h.NewProduct("كابل شحن تايب سي", 10000, 10) // Initial stock 10, Cost 5000
	prod2.Cost = domain.NewAmount(5000)
	_ = h.Repos.product.Update(prod2)

	// 3. Create Purchase Order: 10 units prod1 @ 15,000 = 150,000; 20 units prod2 @ 5,000 = 100,000
	// Total PO = 250,000
	order := domain.PurchaseOrder{
		SupplierID:   supplier.ID,
		SupplierName: supplier.Name,
		Status:       domain.POStatusPending,
		CreatedAt:    time.Now().UnixMilli(),
		Items: []domain.PurchaseOrderItem{
			{
				ProductID:   prod1.ID,
				ProductName: prod1.Name,
				Quantity:    10,
				ReceivedQty: 0,
				UnitCost:    domain.NewAmount(15000),
			},
			{
				ProductID:   prod2.ID,
				ProductName: prod2.Name,
				Quantity:    20,
				ReceivedQty: 0,
				UnitCost:    domain.NewAmount(5000),
			},
		},
	}

	createdPO, err := h.FinanceHandler.CreatePurchaseOrder(order)
	if err != nil {
		t.Fatalf("CreatePurchaseOrder failed: %v", err)
	}
	if createdPO.Status != domain.POStatusPending {
		t.Fatalf("expected PO status pending, got %s", createdPO.Status)
	}

	poID := createdPO.ID

	// 4. Partial Delivery #1: Receive 4 units of prod1 only
	receiveBatch1 := []domain.PurchaseOrderItem{
		{ProductID: prod1.ID, ReceivedQty: 4},
	}
	if err := h.FinanceHandler.ReceivePurchaseOrder(poID, receiveBatch1); err != nil {
		t.Fatalf("ReceivePurchaseOrder batch 1 failed: %v", err)
	}

	// Verify prod1 stock increased from 5 to 9
	p1Reloaded := h.MustReloadProduct(prod1.ID)
	if p1Reloaded.Stock != 9 {
		t.Fatalf("expected prod1 stock 9 after partial receive, got %v", p1Reloaded.Stock)
	}

	// Verify PO status transitioned to "partial"
	poReloaded, err := h.Repos.purchase.GetByID(poID)
	if err != nil {
		t.Fatalf("GetByID PO failed: %v", err)
	}
	if poReloaded.Status != domain.POStatusPartial {
		t.Fatalf("expected PO status partial, got %s", poReloaded.Status)
	}

	// 5. Final Delivery #2: Receive remaining 6 units of prod1 and all 20 units of prod2
	receiveBatch2 := []domain.PurchaseOrderItem{
		{ProductID: prod1.ID, ReceivedQty: 6},
		{ProductID: prod2.ID, ReceivedQty: 20},
	}
	if err := h.FinanceHandler.ReceivePurchaseOrder(poID, receiveBatch2); err != nil {
		t.Fatalf("ReceivePurchaseOrder batch 2 failed: %v", err)
	}

	// Verify stocks: prod1 = 5 + 10 = 15; prod2 = 10 + 20 = 30
	p1Final := h.MustReloadProduct(prod1.ID)
	if p1Final.Stock != 15 {
		t.Fatalf("expected prod1 stock 15, got %v", p1Final.Stock)
	}
	p2Final := h.MustReloadProduct(prod2.ID)
	if p2Final.Stock != 30 {
		t.Fatalf("expected prod2 stock 30, got %v", p2Final.Stock)
	}

	// Verify PO status transitioned to "received"
	poFinal, err := h.Repos.purchase.GetByID(poID)
	if err != nil {
		t.Fatalf("GetByID PO final failed: %v", err)
	}
	if poFinal.Status != domain.POStatusReceived {
		t.Fatalf("expected PO status received, got %s", poFinal.Status)
	}

	// 6. Payment to Supplier: Pay partial amount of 100,000
	if err := h.FinanceHandler.PayPurchaseOrder(poID, domain.NewAmount(100000), "cash"); err != nil {
		t.Fatalf("PayPurchaseOrder partial failed: %v", err)
	}

	poPaid, err := h.Repos.purchase.GetByID(poID)
	if err != nil {
		t.Fatalf("GetByID PO after payment failed: %v", err)
	}
	if !testutil.AmountEq(poPaid.PaidAmount, domain.NewAmount(100000)) {
		t.Fatalf("expected paid amount 100000, got %s", poPaid.PaidAmount.String())
	}

	// Verify supplier balance updated: 250,000 - 100,000 = 150,000
	supReloaded, err := h.Repos.supplier.GetByID(supplier.ID)
	if err != nil {
		t.Fatalf("GetByID supplier failed: %v", err)
	}
	if !testutil.AmountEq(supReloaded.Balance, domain.NewAmount(150000)) {
		t.Fatalf("expected supplier balance 150000, got %s", supReloaded.Balance.String())
	}

	// 7. Overpayment protection: Attempting to pay 200,000 when only 150,000 remains must fail
	err = h.FinanceHandler.PayPurchaseOrder(poID, domain.NewAmount(200000), "cash")
	if err == nil {
		t.Fatal("expected overpayment beyond remaining balance to fail")
	}

	// 8. Settle remaining 150,000
	if err := h.FinanceHandler.PayPurchaseOrder(poID, domain.NewAmount(150000), "cash"); err != nil {
		t.Fatalf("PayPurchaseOrder final payoff failed: %v", err)
	}

	poCompleted, err := h.Repos.purchase.GetByID(poID)
	if err != nil {
		t.Fatalf("GetByID PO completed failed: %v", err)
	}
	if !testutil.AmountEq(poCompleted.PaidAmount, poCompleted.TotalAmount) {
		t.Fatalf("expected fully paid PO, got paid=%s total=%s", poCompleted.PaidAmount.String(), poCompleted.TotalAmount.String())
	}

	// Supplier balance now completely settled (0)
	supFinal, err := h.Repos.supplier.GetByID(supplier.ID)
	if err != nil {
		t.Fatalf("GetByID supplier final failed: %v", err)
	}
	if !testutil.AmountEq(supFinal.Balance, domain.Zero()) {
		t.Fatalf("expected supplier balance 0, got %s", supFinal.Balance.String())
	}
}
