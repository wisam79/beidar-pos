package service_test

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
	"testing"
	"time"

	"gorm.io/gorm"
)

func setupDiscountTestDB(t *testing.T) (service.DiscountService, *gorm.DB, func()) {
	db, cleanup := testutil.SetupDB(t, &domain.Discount{})

	discountRepo := repository.NewDiscountRepository(db)
	discountService := service.NewDiscountService(discountRepo)

	return discountService, db, cleanup
}

func TestDiscountLifecycle(t *testing.T) {
	s, _, cleanup := setupDiscountTestDB(t)
	defer cleanup()

	// 1. Create discount
	d := domain.Discount{
		Name:  "Summer Sale",
		Type:  "percentage",
		Value: 10, // 10%
	}
	created, err := s.CreateDiscount(d)
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}
	if created.ID == "" {
		t.Error("Expected ID to be populated")
	}

	// Test GetDiscounts
	allDiscounts, err := s.GetDiscounts()
	if err != nil {
		t.Fatalf("GetDiscounts failed: %v", err)
	}
	if len(allDiscounts) != 1 {
		t.Errorf("Expected 1 discount, got %d", len(allDiscounts))
	}

	// 2. GetDiscount (by ID)
	found, err := s.GetDiscount(created.ID)
	if err != nil {
		t.Fatalf("GetDiscount failed: %v", err)
	}
	if found.Name != d.Name {
		t.Errorf("Expected name %s, got %s", d.Name, found.Name)
	}

	// 3. UpdateDiscount
	found.Name = "Updated Summer Sale"
	err = s.UpdateDiscount(*found)
	if err != nil {
		t.Fatalf("UpdateDiscount failed: %v", err)
	}
	updated, _ := s.GetDiscount(created.ID)
	if updated.Name != "Updated Summer Sale" {
		t.Errorf("Expected updated name, got %s", updated.Name)
	}

	// 4. ToggleDiscountStatus
	if !updated.Active {
		// Default might be false depending on create, let's verify toggle
		err = s.ToggleDiscountStatus(updated.ID)
		if err != nil {
			t.Fatalf("ToggleDiscountStatus failed: %v", err)
		}
		toggled, _ := s.GetDiscount(updated.ID)
		if !toggled.Active {
			t.Error("Expected discount to be active after toggle")
		}
	}

	// 5. DeleteDiscount
	err = s.DeleteDiscount(updated.ID)
	if err != nil {
		t.Fatalf("DeleteDiscount failed: %v", err)
	}
	_, err = s.GetDiscount(updated.ID)
	if err == nil {
		t.Error("Expected discount to be deleted")
	}
}

func TestGetActiveDiscountsAndValidateCoupon(t *testing.T) {
	s, _, cleanup := setupDiscountTestDB(t)
	defer cleanup()

	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	tomorrow := time.Now().AddDate(0, 0, 1).Format("2006-01-02")

	// 1. Active discount (today is between start and end)
	activeDisc := domain.Discount{
		Name:      "Active Now",
		Code:      "ACTIVE10",
		Type:      "percentage",
		Value:     10,
		Active:    true,
		StartDate: yesterday,
		EndDate:   tomorrow,
	}
	_, _ = s.CreateDiscount(activeDisc)

	// 2. Inactive discount
	inactiveDisc := domain.Discount{
		Name:      "Inactive",
		Code:      "INACTIVE10",
		Type:      "percentage",
		Value:     10,
		Active:    false,
		StartDate: yesterday,
		EndDate:   tomorrow,
	}
	_, _ = s.CreateDiscount(inactiveDisc)

	// 3. Expired discount
	expiredDisc := domain.Discount{
		Name:      "Expired",
		Code:      "EXPIRED10",
		Type:      "percentage",
		Value:     10,
		Active:    true,
		StartDate: yesterday,
		EndDate:   yesterday,
	}
	_, _ = s.CreateDiscount(expiredDisc)

	// 4. Check GetActiveDiscounts
	actives, err := s.GetActiveDiscounts()
	if err != nil {
		t.Fatalf("GetActiveDiscounts failed: %v", err)
	}
	// We expect 1 active discount (Active Now).
	// Expired shouldn't show up. Inactive shouldn't show up.
	// Wait, let's verify if there is at least 1 active.
	foundActiveNow := false
	for _, a := range actives {
		if a.Name == "Active Now" {
			foundActiveNow = true
		}
	}
	if !foundActiveNow {
		t.Errorf("Expected 'Active Now' in active discounts list. Actives: %v", actives)
	}

	// 5. ValidateCoupon
	valid, err := s.ValidateCoupon("ACTIVE10")
	if err != nil {
		t.Fatalf("ValidateCoupon failed for active coupon: %v", err)
	}
	if valid.Code != "ACTIVE10" {
		t.Errorf("Expected valid coupon, got %v", valid)
	}

	// Try expired coupon
	_, err = s.ValidateCoupon("EXPIRED10")
	if err == nil {
		t.Error("Expected error when validating expired coupon")
	}

	// Try non-existent coupon
	_, err = s.ValidateCoupon("NOTEXIST")
	if err == nil {
		t.Error("Expected error when validating non-existent coupon")
	}

	// 6. ApplyDiscount
	err = s.ApplyDiscount(valid.ID)
	if err != nil {
		t.Fatalf("ApplyDiscount failed: %v", err)
	}
	applied, _ := s.GetDiscount(valid.ID)
	if applied.UsageCount != 1 {
		t.Errorf("Expected UsageCount 1, got %d", applied.UsageCount)
	}
}

func TestCalculateDiscountAmount(t *testing.T) {
	s, _, cleanup := setupDiscountTestDB(t)
	defer cleanup()

	// 1. Percentage discount (10%)
	perc := domain.Discount{
		Type:  "percentage",
		Value: 10,
	}
	createdPerc, err := s.CreateDiscount(perc)
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	amt, err := s.CalculateDiscountAmount(createdPerc.ID, domain.NewAmount(100000), 2)
	if err != nil {
		t.Fatalf("CalculateDiscountAmount failed: %v", err)
	}
	if amt != domain.NewAmount(10000) {
		t.Errorf("Expected 10,000, got %s", amt.String())
	}

	// 2. Percentage discount with MaxDiscount limit (max 5,000)
	percMax := domain.Discount{
		Type:        "percentage",
		Value:       10,
		MaxDiscount: domain.NewAmount(5000),
	}
	createdPercMax, _ := s.CreateDiscount(percMax)

	amt, _ = s.CalculateDiscountAmount(createdPercMax.ID, domain.NewAmount(100000), 2)
	if amt != domain.NewAmount(5000) {
		t.Errorf("Expected capped discount 5,000, got %s", amt.String())
	}

	// 3. Fixed discount (15,000)
	fixed := domain.Discount{
		Type:  "fixed",
		Value: 15000,
	}
	createdFixed, _ := s.CreateDiscount(fixed)

	amt, _ = s.CalculateDiscountAmount(createdFixed.ID, domain.NewAmount(100000), 2)
	if amt != domain.NewAmount(15000) {
		t.Errorf("Expected fixed discount 15,000, got %s", amt.String())
	}

	// 4. Fixed discount with MinPurchase (min 150,000)
	fixedMin := domain.Discount{
		Type:        "fixed",
		Value:       15000,
		MinPurchase: domain.NewAmount(150000),
	}
	createdFixedMin, _ := s.CreateDiscount(fixedMin)

	// Subtotal < MinPurchase -> Should return 0 discount
	amt, _ = s.CalculateDiscountAmount(createdFixedMin.ID, domain.NewAmount(100000), 2)
	if amt != domain.Zero() {
		t.Errorf("Expected 0 discount due to min purchase limit, got %s", amt.String())
	}

	// Subtotal >= MinPurchase -> Should return 15,000
	amt, _ = s.CalculateDiscountAmount(createdFixedMin.ID, domain.NewAmount(160000), 2)
	if amt != domain.NewAmount(15000) {
		t.Errorf("Expected 15,000 discount, got %s", amt.String())
	}

	// 5. Quantity discount (needs >= 3 items for 10% discount)
	qtyDisc := domain.Discount{
		Type:  "quantity",
		Value: 3, // min items
	}
	createdQtyDisc, _ := s.CreateDiscount(qtyDisc)

	// 2 items -> 0 discount
	amt, _ = s.CalculateDiscountAmount(createdQtyDisc.ID, domain.NewAmount(100000), 2)
	if amt != domain.Zero() {
		t.Errorf("Expected 0 discount for 2 items, got %s", amt.String())
	}

	// 3 items -> 10% discount -> 10,000
	amt, _ = s.CalculateDiscountAmount(createdQtyDisc.ID, domain.NewAmount(100000), 3)
	if amt != domain.NewAmount(10000) {
		t.Errorf("Expected 10,000 discount for 3 items, got %s", amt.String())
	}

	// 6. Buy X Get Y discount (Buy >= 2 items, one item free)
	// We simulate subtotal divided by itemsCount as one item free
	buyX := domain.Discount{
		Type:  "buyXgetY",
		Value: 2, // min items
	}
	createdBuyX, _ := s.CreateDiscount(buyX)

	// 1 item -> 0 discount
	amt, _ = s.CalculateDiscountAmount(createdBuyX.ID, domain.NewAmount(50000), 1)
	if amt != domain.Zero() {
		t.Errorf("Expected 0 discount for 1 item, got %s", amt.String())
	}

	// 2 items (total 100,000) -> 1 free -> 100k / 2 = 50,000
	amt, _ = s.CalculateDiscountAmount(createdBuyX.ID, domain.NewAmount(100000), 2)
	if amt != domain.NewAmount(50000) {
		t.Errorf("Expected 50,000 discount, got %s", amt.String())
	}
}
