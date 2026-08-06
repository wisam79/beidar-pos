package e2e

import (
	"strings"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

// TestE2E_PurchaseOrderLifecycle drives the full purchase order flow through
// the finance handlers: create pending -> update -> receive (stock added) ->
// pay -> stats.
func TestE2E_PurchaseOrderLifecycle(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// Supplier + product required by the order.
	if err := h.CRMHandler.SaveSupplier(domain.Supplier{Name: "مورد الإلكترونيات", Phone: "07790000001"}); err != nil {
		t.Fatalf("SaveSupplier failed: %v", err)
	}
	suppliers, err := h.CRMHandler.GetSuppliers()
	if err != nil {
		t.Fatalf("GetSuppliers failed: %v", err)
	}
	if len(suppliers) != 1 {
		t.Fatalf("suppliers = %d, want 1", len(suppliers))
	}
	supplierID := suppliers[0].ID

	p := domain.Product{
		ID:    newSaleID(),
		Name:  "لوحة أم",
		Price: domain.NewAmount(80000),
		Stock: 5,
	}
	if err := h.ProductHandler.CreateProduct(p); err != nil {
		t.Fatalf("CreateProduct failed: %v", err)
	}

	// Create a pending purchase order for 10 units at 20000 each.
	created, err := h.FinanceHandler.CreatePurchaseOrder(domain.PurchaseOrder{
		SupplierID: supplierID,
		Note:       "أمر شراء تجريبي",
		Items: []domain.PurchaseOrderItem{
			{ProductID: p.ID, ProductName: p.Name, Quantity: 10, UnitCost: domain.NewAmount(20000)},
		},
	})
	if err != nil {
		t.Fatalf("CreatePurchaseOrder failed: %v", err)
	}
	if created.Status != domain.POStatusPending {
		t.Errorf("status = %q, want pending", created.Status)
	}
	if !testutil.AmountEq(created.TotalAmount, domain.NewAmount(200000)) {
		t.Errorf("total = %s, want 200000", created.TotalAmount.String())
	}
	if created.SupplierName != "مورد الإلكترونيات" {
		t.Errorf("supplier name = %q, want the supplier name", created.SupplierName)
	}

	// Single lookup + list by supplier.
	fetched, err := h.FinanceHandler.GetPurchaseOrder(created.ID)
	if err != nil {
		t.Fatalf("GetPurchaseOrder failed: %v", err)
	}
	if fetched == nil || len(fetched.Items) != 1 {
		t.Fatalf("purchase order items = %v, want 1", fetched)
	}
	listed, err := h.FinanceHandler.GetPurchaseOrders("", supplierID)
	if err != nil {
		t.Fatalf("GetPurchaseOrders failed: %v", err)
	}
	if len(listed) != 1 {
		t.Errorf("purchase orders = %d, want 1", len(listed))
	}

	// Update the order while still pending: quantity 10 -> 12.
	fetched.Items[0].Quantity = 12
	if err := h.FinanceHandler.UpdatePurchaseOrder(*fetched); err != nil {
		t.Fatalf("UpdatePurchaseOrder failed: %v", err)
	}
	updated, err := h.FinanceHandler.GetPurchaseOrder(created.ID)
	if err != nil {
		t.Fatalf("GetPurchaseOrder after update failed: %v", err)
	}
	if !testutil.AmountEq(updated.TotalAmount, domain.NewAmount(240000)) {
		t.Errorf("total after update = %s, want 240000", updated.TotalAmount.String())
	}

	// Receive the full order -> stock goes from 5 to 17.
	if err := h.FinanceHandler.ReceivePurchaseOrder(created.ID, []domain.PurchaseOrderItem{
		{ProductID: p.ID, ProductName: p.Name, Quantity: 12, ReceivedQty: 12, UnitCost: domain.NewAmount(20000)},
	}); err != nil {
		t.Fatalf("ReceivePurchaseOrder failed: %v", err)
	}
	product := h.MustReloadProduct(p.ID)
	if product.Stock != 17 {
		t.Errorf("stock after receive = %v, want 17", product.Stock)
	}
	received, _ := h.FinanceHandler.GetPurchaseOrder(created.ID)
	if received.Status != domain.POStatusReceived {
		t.Errorf("status = %q, want received", received.Status)
	}

	// Pay part of the balance, then the rest.
	if err := h.FinanceHandler.PayPurchaseOrder(created.ID, domain.NewAmount(100000), "cash"); err != nil {
		t.Fatalf("PayPurchaseOrder failed: %v", err)
	}
	if err := h.FinanceHandler.PayPurchaseOrder(created.ID, domain.NewAmount(140000), "bank"); err != nil {
		t.Fatalf("PayPurchaseOrder second payment failed: %v", err)
	}

	// Stats reflect the totals.
	stats, err := h.FinanceHandler.GetPurchaseOrderStats()
	if err != nil {
		t.Fatalf("GetPurchaseOrderStats failed: %v", err)
	}
	if stats.TotalOrders != 1 {
		t.Errorf("stats total orders = %d, want 1", stats.TotalOrders)
	}
	if !testutil.AmountEq(stats.TotalValue, domain.NewAmount(240000)) {
		t.Errorf("stats total value = %s, want 240000", stats.TotalValue.String())
	}
	if !testutil.AmountEq(stats.TotalPaid, domain.NewAmount(240000)) {
		t.Errorf("stats total paid = %s, want 240000", stats.TotalPaid.String())
	}
	if !testutil.AmountEq(stats.TotalUnpaid, domain.Zero()) {
		t.Errorf("stats total unpaid = %s, want 0", stats.TotalUnpaid.String())
	}
}

// TestE2E_PurchaseOrderDeleteAndCancel covers the delete (pending only) and
// cancel paths through the handlers.
func TestE2E_PurchaseOrderDeleteAndCancel(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	if err := h.CRMHandler.SaveSupplier(domain.Supplier{Name: "مورد الحذف", Phone: "07790000002"}); err != nil {
		t.Fatalf("SaveSupplier failed: %v", err)
	}
	suppliers, _ := h.CRMHandler.GetSuppliers()
	supplierID := suppliers[0].ID

	p := domain.Product{ID: newSaleID(), Name: "كابل", Price: domain.NewAmount(1000), Stock: 0}
	if err := h.ProductHandler.CreateProduct(p); err != nil {
		t.Fatalf("CreateProduct failed: %v", err)
	}

	// Pending order can be deleted.
	toDelete, err := h.FinanceHandler.CreatePurchaseOrder(domain.PurchaseOrder{
		SupplierID: supplierID,
		Items:      []domain.PurchaseOrderItem{{ProductID: p.ID, ProductName: p.Name, Quantity: 1, UnitCost: domain.NewAmount(500)}},
	})
	if err != nil {
		t.Fatalf("CreatePurchaseOrder failed: %v", err)
	}
	if err := h.FinanceHandler.DeletePurchaseOrder(toDelete.ID); err != nil {
		t.Fatalf("DeletePurchaseOrder failed: %v", err)
	}
	if _, err := h.FinanceHandler.GetPurchaseOrder(toDelete.ID); err == nil {
		t.Error("expected deleted purchase order to be gone")
	}

	// A pending order can be cancelled.
	toCancel, err := h.FinanceHandler.CreatePurchaseOrder(domain.PurchaseOrder{
		SupplierID: supplierID,
		Items:      []domain.PurchaseOrderItem{{ProductID: p.ID, ProductName: p.Name, Quantity: 2, UnitCost: domain.NewAmount(500)}},
	})
	if err != nil {
		t.Fatalf("CreatePurchaseOrder failed: %v", err)
	}
	if err := h.FinanceHandler.CancelPurchaseOrder(toCancel.ID); err != nil {
		t.Fatalf("CancelPurchaseOrder failed: %v", err)
	}
	cancelled, _ := h.FinanceHandler.GetPurchaseOrder(toCancel.ID)
	if cancelled.Status != domain.POStatusCancelled {
		t.Errorf("status = %q, want cancelled", cancelled.Status)
	}

	// A cancelled order cannot be deleted or received.
	if err := h.FinanceHandler.DeletePurchaseOrder(toCancel.ID); err == nil {
		t.Error("expected deleting a cancelled order to fail")
	}
	if err := h.FinanceHandler.ReceivePurchaseOrder(toCancel.ID, []domain.PurchaseOrderItem{
		{ProductID: p.ID, ProductName: p.Name, Quantity: 2, UnitCost: domain.NewAmount(500)},
	}); err == nil {
		t.Error("expected receiving a cancelled order to fail")
	}

	// Validation errors surface through the handler.
	if _, err := h.FinanceHandler.CreatePurchaseOrder(domain.PurchaseOrder{
		SupplierID: supplierID,
	}); err == nil || !strings.Contains(err.Error(), "منتج") {
		t.Errorf("expected missing-items error, got: %v", err)
	}
	if _, err := h.FinanceHandler.CreatePurchaseOrder(domain.PurchaseOrder{
		Items: []domain.PurchaseOrderItem{{ProductID: p.ID, ProductName: p.Name, Quantity: 1, UnitCost: domain.NewAmount(500)}},
	}); err == nil || !strings.Contains(err.Error(), "مورد") {
		t.Errorf("expected missing-supplier error, got: %v", err)
	}
}

// TestE2E_DashboardStats computes dashboard + monthly comparison after sales.
func TestE2E_DashboardStats(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	customer := h.NewCustomer("عميل الإحصائيات", 0)
	product := h.NewProduct("منتج إحصاءات", 5000, 20)
	_ = product

	saleID := newSaleID()
	if err := h.SaleHandler.ProcessSale(domain.Sale{
		ID:         saleID,
		CustomerID: customer.ID,
		Total:      domain.NewAmount(5000),
		Items: []domain.SaleItem{
			{ProductID: product.ID, Name: product.Name, Quantity: 1, Price: domain.NewAmount(5000)},
		},
	}); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	dashboard, err := h.StatsHandler.GetDashboardStats("today")
	if err != nil {
		t.Fatalf("GetDashboardStats failed: %v", err)
	}
	if dashboard == nil || dashboard.TotalOrders != 1 {
		t.Errorf("dashboard total orders = %v, want 1", dashboard)
	}

	comparison, err := h.StatsHandler.GetMonthlyComparison()
	if err != nil {
		t.Fatalf("GetMonthlyComparison failed: %v", err)
	}
	if comparison == nil {
		t.Error("expected a monthly comparison result")
	}
}
