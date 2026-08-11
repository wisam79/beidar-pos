package service_test

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupDiscountEdgeTestDB(t *testing.T) (service.DiscountService, *gorm.DB, func()) {
	t.Helper()
	db, cleanup := testutil.SetupFullDB(t)
	testutil.SeedPreferences(t, db)

	discountRepo := repository.NewDiscountRepository(db)
	discountService := service.NewDiscountService(discountRepo)

	return discountService, db, cleanup
}

// TestEdge_ApplyDiscount_ConcurrentCouponUsage tests concurrent application of a single-use coupon,
// verifying that exactly one goroutine succeeds and subsequent applications are rejected.
func TestEdge_ApplyDiscount_ConcurrentCouponUsage(t *testing.T) {
	discountService, db, cleanup := setupDiscountEdgeTestDB(t)
	defer cleanup()

	discount := domain.Discount{
		ID:         uuid.New().String(),
		Name:       "Single Use Coupon",
		Code:       "ONE_OFF_100",
		Type:       "fixed",
		Value:      100.0,
		UsageLimit: 1,
		UsageCount: 0,
		Active:     true,
	}

	created, err := discountService.CreateDiscount(discount)
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	const goroutines = 10
	var wg sync.WaitGroup
	var successCount int64
	var failCount int64

	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			err := discountService.ApplyDiscount(created.ID)
			if err == nil {
				atomic.AddInt64(&successCount, 1)
			} else {
				atomic.AddInt64(&failCount, 1)
			}
		}()
	}
	wg.Wait()

	if successCount != 1 {
		t.Fatalf("Expected exactly 1 successful coupon application, got %d", successCount)
	}
	if failCount != goroutines-1 {
		t.Fatalf("Expected %d failed coupon applications, got %d", goroutines-1, failCount)
	}

	var reloaded domain.Discount
	if err := db.First(&reloaded, "id = ?", created.ID).Error; err != nil {
		t.Fatalf("Failed to reload discount: %v", err)
	}
	if reloaded.UsageCount != 1 {
		t.Errorf("Expected final UsageCount to be 1, got %d", reloaded.UsageCount)
	}
}

// TestEdge_CalculateDiscount_BuyXGetY_ExactThreshold tests that buying the exact X items
// applies the free item discount correctly.
func TestEdge_CalculateDiscount_BuyXGetY_ExactThreshold(t *testing.T) {
	discountService, _, cleanup := setupDiscountEdgeTestDB(t)
	defer cleanup()

	discount := domain.Discount{
		ID:     uuid.New().String(),
		Name:   "Buy 3 Get 1 Free",
		Type:   "buyXgetY",
		Value:  3.0, // Threshold: 3 items
		Active: true,
	}
	created, err := discountService.CreateDiscount(discount)
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	// 3 items at 100 each -> subtotal 300
	subtotal := domain.NewAmount(300)
	amount, err := discountService.CalculateDiscountAmount(created.ID, subtotal, 3)
	if err != nil {
		t.Fatalf("CalculateDiscountAmount failed: %v", err)
	}

	// Discount is 1 free item: 300 / 3 = 100
	expectedDiscount := domain.NewAmount(100)
	if amount != expectedDiscount {
		t.Fatalf("Expected discount %s, got %s", expectedDiscount.String(), amount.String())
	}
}

// TestEdge_CalculateDiscount_BuyXGetY_MultipleSets tests buying items above and below the threshold.
func TestEdge_CalculateDiscount_BuyXGetY_MultipleSets(t *testing.T) {
	discountService, _, cleanup := setupDiscountEdgeTestDB(t)
	defer cleanup()

	discount := domain.Discount{
		ID:     uuid.New().String(),
		Name:   "Buy 3 Promo",
		Type:   "buyXgetY",
		Value:  3.0,
		Active: true,
	}
	created, err := discountService.CreateDiscount(discount)
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	// Below threshold: 2 items (subtotal 200) -> discount should be 0
	amountBelow, err := discountService.CalculateDiscountAmount(created.ID, domain.NewAmount(200), 2)
	if err != nil {
		t.Fatalf("CalculateDiscountAmount below threshold failed: %v", err)
	}
	if amountBelow != domain.Zero() {
		t.Errorf("Expected 0 discount when below threshold, got %s", amountBelow.String())
	}

	// Above threshold: 6 items (subtotal 600) -> 600 / 6 = 100
	amountAbove, err := discountService.CalculateDiscountAmount(created.ID, domain.NewAmount(600), 6)
	if err != nil {
		t.Fatalf("CalculateDiscountAmount above threshold failed: %v", err)
	}
	expectedDiscount := domain.NewAmount(100)
	if amountAbove != expectedDiscount {
		t.Errorf("Expected discount %s for 6 items, got %s", expectedDiscount.String(), amountAbove.String())
	}
}

// TestEdge_CalculateDiscount_PercentageWithMaxCap tests a 50% discount capped at max discount amount.
func TestEdge_CalculateDiscount_PercentageWithMaxCap(t *testing.T) {
	discountService, _, cleanup := setupDiscountEdgeTestDB(t)
	defer cleanup()

	discount := domain.Discount{
		ID:          uuid.New().String(),
		Name:        "50% with Cap",
		Type:        "percentage",
		Value:       50.0,                   // 50%
		MaxDiscount: domain.NewAmount(200),  // Capped at 200
		Active:      true,
	}
	created, err := discountService.CreateDiscount(discount)
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	// Subtotal = 1000. 50% of 1000 = 500 > MaxDiscount(200) -> capped at 200
	subtotal := domain.NewAmount(1000)
	amount, err := discountService.CalculateDiscountAmount(created.ID, subtotal, 5)
	if err != nil {
		t.Fatalf("CalculateDiscountAmount failed: %v", err)
	}

	expectedCap := domain.NewAmount(200)
	if amount != expectedCap {
		t.Fatalf("Expected discount capped at %s, got %s", expectedCap.String(), amount.String())
	}

	// Subtotal = 300. 50% of 300 = 150 < MaxDiscount(200) -> 150 applied
	subtotalSmall := domain.NewAmount(300)
	amountSmall, err := discountService.CalculateDiscountAmount(created.ID, subtotalSmall, 2)
	if err != nil {
		t.Fatalf("CalculateDiscountAmount small subtotal failed: %v", err)
	}
	expectedSmall := domain.NewAmount(150)
	if amountSmall != expectedSmall {
		t.Fatalf("Expected uncapped discount %s, got %s", expectedSmall.String(), amountSmall.String())
	}
}

// TestEdge_CalculateDiscount_ExpiredCoupon_Rejected tests that applying an expired coupon fails validation.
func TestEdge_CalculateDiscount_ExpiredCoupon_Rejected(t *testing.T) {
	discountService, _, cleanup := setupDiscountEdgeTestDB(t)
	defer cleanup()

	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	lastWeek := time.Now().AddDate(0, 0, -7).Format("2006-01-02")

	discount := domain.Discount{
		ID:        uuid.New().String(),
		Name:      "Expired Summer Promo",
		Code:      "EXPIRED_PROMO",
		Type:      "percentage",
		Value:     15.0,
		StartDate: lastWeek,
		EndDate:   yesterday, // Expired yesterday
		Active:    true,
	}
	_, err := discountService.CreateDiscount(discount)
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	_, err = discountService.ValidateCoupon("EXPIRED_PROMO")
	if err == nil {
		t.Fatal("Expected error when validating expired coupon, got nil")
	}
}

// TestEdge_CalculateDiscount_MinPurchaseNotMet tests that subtotal below minPurchase rejects discount.
func TestEdge_CalculateDiscount_MinPurchaseNotMet(t *testing.T) {
	discountService, _, cleanup := setupDiscountEdgeTestDB(t)
	defer cleanup()

	discount := domain.Discount{
		ID:          uuid.New().String(),
		Name:        "VIP Promo",
		Type:        "percentage",
		Value:       20.0,
		MinPurchase: domain.NewAmount(500), // Minimum purchase 500
		Active:      true,
	}
	created, err := discountService.CreateDiscount(discount)
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	// Below MinPurchase: subtotal 300 < 500 -> 0 discount
	subtotalBelow := domain.NewAmount(300)
	amountBelow, err := discountService.CalculateDiscountAmount(created.ID, subtotalBelow, 1)
	if err != nil {
		t.Fatalf("CalculateDiscountAmount failed: %v", err)
	}
	if amountBelow != domain.Zero() {
		t.Errorf("Expected 0 discount when subtotal is below minimum purchase, got %s", amountBelow.String())
	}

	// Meets MinPurchase: subtotal 600 >= 500 -> 20% of 600 = 120
	subtotalMeets := domain.NewAmount(600)
	amountMeets, err := discountService.CalculateDiscountAmount(created.ID, subtotalMeets, 2)
	if err != nil {
		t.Fatalf("CalculateDiscountAmount failed: %v", err)
	}
	expectedDiscount := domain.NewAmount(120)
	if amountMeets != expectedDiscount {
		t.Errorf("Expected discount %s, got %s", expectedDiscount.String(), amountMeets.String())
	}
}

// TestEdge_CalculateDiscount_200PercentDiscount_Capped tests extreme percentage discounts
// handled safely without producing negative or uncontrolled amounts.
func TestEdge_CalculateDiscount_200PercentDiscount_Capped(t *testing.T) {
	discountService, _, cleanup := setupDiscountEdgeTestDB(t)
	defer cleanup()

	discount := domain.Discount{
		ID:          uuid.New().String(),
		Name:        "Extreme Discount",
		Type:        "percentage",
		Value:       200.0,                 // 200%
		MaxDiscount: domain.NewAmount(300), // Max cap 300
		Active:      true,
	}
	created, err := discountService.CreateDiscount(discount)
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	// Subtotal = 200. 200% of 200 is 400. Capped at 300.
	subtotal := domain.NewAmount(200)
	amount, err := discountService.CalculateDiscountAmount(created.ID, subtotal, 1)
	if err != nil {
		t.Fatalf("CalculateDiscountAmount failed: %v", err)
	}

	expectedCap := domain.NewAmount(300)
	if amount != expectedCap {
		t.Fatalf("Expected discount capped at %s, got %s", expectedCap.String(), amount.String())
	}

	if amount.IsNegative() {
		t.Errorf("Calculated discount should never be negative: %s", amount.String())
	}
}
