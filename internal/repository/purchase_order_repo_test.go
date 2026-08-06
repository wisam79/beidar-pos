package repository

import (
	"testing"

	"beidar-desktop/internal/core/domain"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupPurchaseOrderTestDB(t *testing.T) (domain.PurchaseOrderRepository, func()) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open in-memory DB: %v", err)
	}
	if err := db.AutoMigrate(&domain.PurchaseOrder{}, &domain.PurchaseOrderItem{}); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}
	return NewPurchaseOrderRepository(db), func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}
}

func seedOrder(t *testing.T, repo domain.PurchaseOrderRepository, id string, status domain.PurchaseOrderStatus) {
	t.Helper()
	order := &domain.PurchaseOrder{
		ID:           id,
		SupplierID:   "sup_1",
		SupplierName: "المورد",
		Status:       status,
		TotalAmount:  domain.NewAmount(240.0),
		PaidAmount:   domain.NewAmount(100.0),
		CreatedAt:    1700000000,
		Items: []domain.PurchaseOrderItem{
			{ProductID: "p_1", ProductName: "منتج ١", Quantity: 10, ReceivedQty: 0, UnitCost: domain.NewAmount(10.0), Total: domain.NewAmount(100.0)},
			{ProductID: "p_2", ProductName: "منتج ٢", Quantity: 5, ReceivedQty: 5, UnitCost: domain.NewAmount(28.0), Total: domain.NewAmount(140.0)},
		},
	}
	if err := repo.Create(order); err != nil {
		t.Fatalf("Create failed: %v", err)
	}
}

func TestPurchaseOrderRepository_GetOrderItem(t *testing.T) {
	repo, cleanup := setupPurchaseOrderTestDB(t)
	defer cleanup()
	seedOrder(t, repo, "po_item", domain.POStatusPending)

	item, err := repo.GetOrderItem("po_item", "p_2")
	if err != nil {
		t.Fatalf("GetOrderItem failed: %v", err)
	}
	if item.ProductName != "منتج ٢" {
		t.Errorf("ProductName = %q, want 'منتج ٢'", item.ProductName)
	}
	if item.Quantity != 5 {
		t.Errorf("Quantity = %v, want 5", item.Quantity)
	}

	if _, err := repo.GetOrderItem("po_item", "missing"); err == nil {
		t.Error("expected error for unknown product")
	}
}

func TestPurchaseOrderRepository_GetOrderItems(t *testing.T) {
	repo, cleanup := setupPurchaseOrderTestDB(t)
	defer cleanup()
	seedOrder(t, repo, "po_items", domain.POStatusPending)

	items, err := repo.GetOrderItems("po_items")
	if err != nil {
		t.Fatalf("GetOrderItems failed: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("items len = %d, want 2", len(items))
	}
}

func TestPurchaseOrderRepository_UpdateItemReceivedQty(t *testing.T) {
	repo, cleanup := setupPurchaseOrderTestDB(t)
	defer cleanup()
	seedOrder(t, repo, "po_rqty", domain.POStatusPending)

	items, _ := repo.GetOrderItems("po_rqty")
	item := items[0]
	if err := repo.UpdateItemReceivedQty(item.ID, 7); err != nil {
		t.Fatalf("UpdateItemReceivedQty failed: %v", err)
	}

	got, err := repo.GetOrderItem("po_rqty", item.ProductID)
	if err != nil {
		t.Fatalf("GetOrderItem failed: %v", err)
	}
	if got.ReceivedQty != 7 {
		t.Errorf("ReceivedQty = %v, want 7", got.ReceivedQty)
	}
}

func TestPurchaseOrderRepository_UpdateAndDeleteItems(t *testing.T) {
	repo, cleanup := setupPurchaseOrderTestDB(t)
	defer cleanup()
	seedOrder(t, repo, "po_upd", domain.POStatusPending)

	if err := repo.DeleteItemsByOrderID("po_upd"); err != nil {
		t.Fatalf("DeleteItemsByOrderID failed: %v", err)
	}
	items, _ := repo.GetOrderItems("po_upd")
	if len(items) != 0 {
		t.Fatalf("items after delete = %d, want 0", len(items))
	}

	// Update on the now item-less order.
	order, err := repo.GetByID("po_upd")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	order.Note = "تحديث"
	if err := repo.Update(order); err != nil {
		t.Fatalf("Update failed: %v", err)
	}
	got, _ := repo.GetByID("po_upd")
	if got.Note != "تحديث" {
		t.Errorf("Note = %q, want 'تحديث'", got.Note)
	}
}

func TestPurchaseOrderRepository_GetPurchaseOrdersFilters(t *testing.T) {
	repo, cleanup := setupPurchaseOrderTestDB(t)
	defer cleanup()
	seedOrder(t, repo, "po_f1", domain.POStatusPending)
	seedOrder(t, repo, "po_f2", domain.POStatusReceived)
	seedOrder(t, repo, "po_f3", domain.POStatusCancelled)

	all, err := repo.GetPurchaseOrders("all", "")
	if err != nil {
		t.Fatalf("GetPurchaseOrders(all) failed: %v", err)
	}
	if len(all) != 3 {
		t.Errorf("all len = %d, want 3", len(all))
	}

	received, err := repo.GetPurchaseOrders("received", "")
	if err != nil {
		t.Fatalf("GetPurchaseOrders(received) failed: %v", err)
	}
	if len(received) != 1 || received[0].ID != "po_f2" {
		t.Errorf("received filter = %+v, want only po_f2", received)
	}

	bySupplier, err := repo.GetPurchaseOrders("", "sup_1")
	if err != nil {
		t.Fatalf("GetPurchaseOrders(supplier) failed: %v", err)
	}
	if len(bySupplier) != 3 {
		t.Errorf("supplier filter len = %d, want 3", len(bySupplier))
	}
}

func TestPurchaseOrderRepository_GetForUpdate(t *testing.T) {
	repo, cleanup := setupPurchaseOrderTestDB(t)
	defer cleanup()
	seedOrder(t, repo, "po_lock", domain.POStatusPending)

	order, err := repo.GetForUpdate("po_lock")
	if err != nil {
		t.Fatalf("GetForUpdate failed: %v", err)
	}
	if len(order.Items) != 2 {
		t.Errorf("preloaded items = %d, want 2", len(order.Items))
	}

	if _, err := repo.GetForUpdate("missing"); err == nil {
		t.Error("expected error for missing order")
	}
}

func TestPurchaseOrderRepository_GetPurchaseOrderStats(t *testing.T) {
	repo, cleanup := setupPurchaseOrderTestDB(t)
	defer cleanup()
	seedOrder(t, repo, "po_s1", domain.POStatusPending)
	seedOrder(t, repo, "po_s2", domain.POStatusReceived)
	seedOrder(t, repo, "po_s3", domain.POStatusCancelled)

	stats, err := repo.GetPurchaseOrderStats()
	if err != nil {
		t.Fatalf("GetPurchaseOrderStats failed: %v", err)
	}
	if stats.TotalOrders != 3 {
		t.Errorf("TotalOrders = %d, want 3", stats.TotalOrders)
	}
	if stats.PendingOrders != 1 {
		t.Errorf("PendingOrders = %d, want 1 (only pending+partial)", stats.PendingOrders)
	}
	if stats.TotalValue.Cents() != 72000 {
		t.Errorf("TotalValue = %d, want 72000", stats.TotalValue.Cents())
	}
	if stats.TotalPaid.Cents() != 30000 {
		t.Errorf("TotalPaid = %d, want 30000", stats.TotalPaid.Cents())
	}
	if stats.TotalUnpaid.Cents() != 42000 {
		t.Errorf("TotalUnpaid = %d, want 42000", stats.TotalUnpaid.Cents())
	}
}

func TestPurchaseOrderRepository_Delete(t *testing.T) {
	repo, cleanup := setupPurchaseOrderTestDB(t)
	defer cleanup()
	seedOrder(t, repo, "po_del", domain.POStatusPending)

	if err := repo.Delete("po_del"); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	if _, err := repo.GetByID("po_del"); err == nil {
		t.Error("expected error after delete")
	}
}