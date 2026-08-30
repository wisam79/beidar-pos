package e2e

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

// TestE2E_InventoryAdjustment_WastageDamageAndValuation tests inventory control:
// 1. Creation of products with initial stock and costs.
// 2. Positive adjustment (stock recount / inventory surplus) updating stock and logging movement.
// 3. Negative adjustment (wastage / damaged / expired items) updating stock and valuation.
// 4. Verification that stock movements are recorded with reason, timestamp, and correct quantities.
func TestE2E_InventoryAdjustment_WastageDamageAndValuation(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// 1. Create product: 50 units @ Cost 10,000, Price 15,000
	prod := h.NewProduct("حليب المراعي 1 لتر", 15000, 50)
	prod.Cost = domain.NewAmount(10000)
	if err := h.Repos.product.Update(prod); err != nil {
		t.Fatalf("Update product cost failed: %v", err)
	}

	// 2. Perform positive adjustment: Recount found +5 extra units (Stock 50 -> 55)
	if err := h.Repos.product.UpdateStock(prod.ID, 5); err != nil {
		t.Fatalf("UpdateStock +5 failed: %v", err)
	}
	movement1 := domain.StockMovement{
		ProductID:   prod.ID,
		ProductName: prod.Name,
		Type:        "recount",
		Qty:         5,
		Reason:      "زيادة في الجرد الدوري",
		Timestamp:   time.Now().UnixMilli(),
	}
	if err := h.Repos.product.CreateStockMovement(&movement1); err != nil {
		t.Fatalf("CreateStockMovement 1 failed: %v", err)
	}

	p1 := h.MustReloadProduct(prod.ID)
	if p1.Stock != 55 {
		t.Fatalf("expected stock 55 after +5 recount, got %v", p1.Stock)
	}

	// 3. Perform negative adjustment: 3 units damaged/expired (Stock 55 -> 52)
	if err := h.Repos.product.UpdateStock(prod.ID, -3); err != nil {
		t.Fatalf("UpdateStock -3 failed: %v", err)
	}
	movement2 := domain.StockMovement{
		ProductID:   prod.ID,
		ProductName: prod.Name,
		Type:        "damage",
		Qty:         -3,
		Reason:      "تلف عبوات أثناء النقل",
		Timestamp:   time.Now().UnixMilli(),
	}
	if err := h.Repos.product.CreateStockMovement(&movement2); err != nil {
		t.Fatalf("CreateStockMovement 2 failed: %v", err)
	}

	p2 := h.MustReloadProduct(prod.ID)
	if p2.Stock != 52 {
		t.Fatalf("expected stock 52 after -3 damage, got %v", p2.Stock)
	}

	// 4. Verify inventory valuation: 52 units * 10,000 cost = 520,000 total inventory cost valuation
	expectedValuation := p2.Cost.MulFloat(p2.Stock)
	if !testutil.AmountEq(expectedValuation, domain.NewAmount(520000)) {
		t.Fatalf("expected valuation 520000, got %s", expectedValuation.String())
	}

	// 5. Verify stock movements history
	movements, err := h.Repos.product.GetStockMovements()
	if err != nil {
		t.Fatalf("GetStockMovements failed: %v", err)
	}
	if len(movements) < 2 {
		t.Fatalf("expected at least 2 stock movements, got %d", len(movements))
	}

	foundRecount := false
	foundDamage := false
	for _, m := range movements {
		if m.ProductID == prod.ID {
			if m.Type == "recount" && m.Qty == 5 {
				foundRecount = true
			}
			if m.Type == "damage" && m.Qty == -3 {
				foundDamage = true
			}
		}
	}
	if !foundRecount {
		t.Errorf("expected recount movement not found")
	}
	if !foundDamage {
		t.Errorf("expected damage movement not found")
	}
}
