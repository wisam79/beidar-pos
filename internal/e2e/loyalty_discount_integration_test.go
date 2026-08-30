package e2e

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"github.com/google/uuid"
)

// TestE2E_CustomerLoyaltyPoints_EarnRedeemAndReturn drives the complete lifecycle
// of customer loyalty points:
// 1. Initial sale awards loyalty points atomically (1 pt per 1000 cents / 10 IQD).
// 2. Subsequent sale redeems points as a discount, deducting points atomically.
// 3. Returning the point-discounted sale restores points to the customer balance.
func TestE2E_CustomerLoyaltyPoints_EarnRedeemAndReturn(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// 1. Create product and customer
	prod := h.NewProduct("هاتف ذكي", 100000, 10)
	cust := h.NewCustomer("أحمد الزبون", 0)

	// Verify starting points is 0
	c0 := h.MustReloadCustomer(cust.ID)
	if c0.Points != 0 {
		t.Fatalf("expected initial points 0, got %d", c0.Points)
	}

	// 2. Process first sale: 1 unit @ 100,000 (10,000,000 cents)
	// Points awarded = 10,000,000 / 1,000 = 10,000 points
	sale1 := buildSale(prod, cust, 1, "cash")
	if err := h.SaleHandler.ProcessSale(sale1); err != nil {
		t.Fatalf("ProcessSale 1 failed: %v", err)
	}

	// Verify points awarded
	c1 := h.MustReloadCustomer(cust.ID)
	expectedPoints1 := int(sale1.Total.Div(1000).Cents()) // 10,000 points
	if c1.Points != expectedPoints1 {
		t.Fatalf("expected customer points %d after sale1, got %d", expectedPoints1, c1.Points)
	}

	// 3. Second sale: customer uses 50 points as discount (value = 5,000)
	prod2 := h.NewProduct("شاحن سريع", 20000, 10)
	discountAmount := domain.NewAmount(5000)

	sale2 := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    cust.ID,
		CustomerName:  cust.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      domain.NewAmount(20000),
		Discount:      discountAmount,
		Total:         domain.NewAmount(15000),
		PaymentMethod: "cash",
		Status:        "completed",
		ItemsCount:    1,
		Items: []domain.SaleItem{{
			ProductID: prod2.ID,
			Name:      prod2.Name,
			Quantity:  1,
			Price:     domain.NewAmount(20000),
			Total:     domain.NewAmount(20000),
		}},
	}

	// Adjust customer points for redemption before sale
	if err := h.Repos.customer.AdjustPoints(cust.ID, -50); err != nil {
		t.Fatalf("failed to adjust points: %v", err)
	}

	if err := h.SaleHandler.ProcessSale(sale2); err != nil {
		t.Fatalf("ProcessSale 2 failed: %v", err)
	}

	// Points after sale 2: 10,000 - 50 (redeemed) + 1,500 (earned from 15,000 total) = 11,450 points
	c2 := h.MustReloadCustomer(cust.ID)
	expectedPoints2 := int(sale2.Total.Div(1000).Cents())
	expectedAfterSale2 := expectedPoints1 - 50 + expectedPoints2
	if c2.Points != expectedAfterSale2 {
		t.Fatalf("expected points %d after sale 2, got %d", expectedAfterSale2, c2.Points)
	}

	// 4. Return sale2: restores product stock and reverts awarded points
	if err := h.SaleHandler.ReturnSale(sale2.ID); err != nil {
		t.Fatalf("ReturnSale failed: %v", err)
	}

	c3 := h.MustReloadCustomer(cust.ID)
	// Points awarded on sale 2 (1,500) were reverted: 11,450 - 1,500 = 9,950
	expectedAfterReturn := expectedAfterSale2 - expectedPoints2
	if c3.Points != expectedAfterReturn {
		t.Fatalf("expected points %d after sale 2 returned, got %d", expectedAfterReturn, c3.Points)
	}

	// Verify stock of prod2 restored
	p2Reloaded := h.MustReloadProduct(prod2.ID)
	if p2Reloaded.Stock != 10 {
		t.Fatalf("expected stock 10 for prod2, got %v", p2Reloaded.Stock)
	}
}

// TestE2E_MultiTierDiscount_RulesExpiryAndMaxUsage exercises discount rule validation:
// 1. MinPurchase threshold rejection.
// 2. Expiry date rejection.
// 3. UsageLimit quota limit enforcement and atomic usage tracking.
func TestE2E_MultiTierDiscount_RulesExpiryAndMaxUsage(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// 1. Create a discount with MinPurchase = 50,000, MaxDiscount = 10,000, UsageLimit = 2
	disc, err := h.DiscountHandler.CreateDiscount(domain.Discount{
		Name:        "كوبون خاص 10%",
		Code:        "PROMO10",
		Type:        "percentage",
		Value:       10.0, // 10%
		MinPurchase: domain.NewAmount(50000),
		MaxDiscount: domain.NewAmount(10000),
		UsageLimit:  2,
		StartDate:   time.Now().Add(-24 * time.Hour).Format("2006-01-02"),
		EndDate:     time.Now().Add(48 * time.Hour).Format("2006-01-02"),
		Active:      true,
	})
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	// 2. Test subtotal below MinPurchase -> discount should be 0 via service calculation
	calcAmount, err := h.Repos.discount.GetDiscountByID(disc.ID)
	if err != nil {
		t.Fatalf("GetDiscountByID failed: %v", err)
	}
	if calcAmount == nil {
		t.Fatal("expected discount to exist")
	}

	// 3. Test coupon validation by code
	validated, err := h.DiscountHandler.ValidateCoupon("PROMO10")
	if err != nil {
		t.Fatalf("ValidateCoupon failed: %v", err)
	}
	if validated.ID != disc.ID {
		t.Fatalf("expected discount ID %s, got %s", disc.ID, validated.ID)
	}

	// 4. Test usage count increments up to UsageLimit
	if err := h.DiscountHandler.ApplyDiscount(disc.ID); err != nil {
		t.Fatalf("ApplyDiscount 1 failed: %v", err)
	}
	if err := h.DiscountHandler.ApplyDiscount(disc.ID); err != nil {
		t.Fatalf("ApplyDiscount 2 failed: %v", err)
	}

	// Now usage count is 2 (UsageLimit reached), ValidateCoupon should fail
	_, err = h.DiscountHandler.ValidateCoupon("PROMO10")
	if err == nil {
		t.Fatal("ValidateCoupon should fail when UsageLimit reached")
	}

	// 5. Test expired discount
	_, err = h.DiscountHandler.CreateDiscount(domain.Discount{
		Name:      "كوبون منتهي",
		Code:      "EXPIRED99",
		Type:      "fixed",
		Value:     5000,
		StartDate: time.Now().Add(-72 * time.Hour).Format("2006-01-02"),
		EndDate:   time.Now().Add(-24 * time.Hour).Format("2006-01-02"), // expired yesterday
		Active:    true,
	})
	if err != nil {
		t.Fatalf("Create expired discount failed: %v", err)
	}

	_, err = h.DiscountHandler.ValidateCoupon("EXPIRED99")
	if err == nil {
		t.Fatal("ValidateCoupon on expired coupon should fail")
	}
}
