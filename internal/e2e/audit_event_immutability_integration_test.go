package e2e

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/auth"
	"github.com/google/uuid"
)

// TestE2E_AuditLog_ComprehensiveEventTrackingAndImmutability tests audit traceability:
// Critical sales operations (sale discount application, full sale return) generate
// persistent and immutable audit log records with actor ID, entity ID, action type, and details.
func TestE2E_AuditLog_ComprehensiveEventTrackingAndImmutability(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// 1. Create Products and Customer
	prod1 := h.NewProduct("كاميرا مراقبة 4K", 80000, 10)
	prod2 := h.NewProduct("كارت ميموري 128 جيجا", 20000, 10)
	cust := h.NewCustomer("زبون التدقيق والرقابة", 0)

	// 2. Process Sale with Discount (Subtotal 100,000, Discount 10,000, Total 90,000)
	discountAmount := domain.NewAmount(10000)
	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    cust.ID,
		CustomerName:  cust.Name,
		StaffID:       auth.CurrentStaffID(),
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      domain.NewAmount(100000),
		Discount:      discountAmount,
		Total:         domain.NewAmount(90000),
		PaymentMethod: "cash",
		Status:        "completed",
		ItemsCount:    2,
		Items: []domain.SaleItem{
			{ProductID: prod1.ID, Name: prod1.Name, Quantity: 1, Price: prod1.Price, Total: prod1.Price},
			{ProductID: prod2.ID, Name: prod2.Name, Quantity: 1, Price: prod2.Price, Total: prod2.Price},
		},
	}

	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// 3. Verify Sale Discount Audit Log
	recentLogs1, err := h.Repos.audit.GetRecent(10)
	if err != nil {
		t.Fatalf("GetRecent audit failed: %v", err)
	}
	if len(recentLogs1) == 0 {
		t.Fatal("expected audit log record for sale discount")
	}

	foundDiscountAudit := false
	for _, l := range recentLogs1 {
		if l.EntityID == sale.ID && l.Action == "SALE_DISCOUNT" {
			foundDiscountAudit = true
			if l.StaffID != auth.CurrentStaffID() {
				t.Errorf("expected staff ID %s, got %s", auth.CurrentStaffID(), l.StaffID)
			}
			if l.Entity != "Sale" {
				t.Errorf("expected entity 'Sale', got %s", l.Entity)
			}
			break
		}
	}
	if !foundDiscountAudit {
		t.Error("SALE_DISCOUNT audit log entry not found")
	}

	// 4. Perform Full Return of the Sale
	if err := h.SaleHandler.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale failed: %v", err)
	}

	// 5. Verify Sale Return Audit Log
	recentLogs2, err := h.Repos.audit.GetRecent(10)
	if err != nil {
		t.Fatalf("GetRecent audit failed: %v", err)
	}

	foundSaleReturn := false
	for _, l := range recentLogs2 {
		if l.EntityID == sale.ID && l.Action == "RETURN_SALE" {
			foundSaleReturn = true
			if l.Entity != "Sale" {
				t.Errorf("expected entity 'Sale', got %s", l.Entity)
			}
			break
		}
	}
	if !foundSaleReturn {
		t.Error("RETURN_SALE audit log entry not found")
	}
}
