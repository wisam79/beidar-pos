package repository

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestDiscountRepository(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	repo := NewDiscountRepository(db)

	nowStr := time.Now().Format("2006-01-02 15:04:05")

	t.Run("CreateAndGetDiscounts", func(t *testing.T) {
		d1 := &domain.Discount{
			ID:          "disc-1",
			Name:        "Summer Sale",
			Code:        "SUMMER10",
			Type:        "percentage",
			Value:       10,
			Active:      true,
			StartDate:   "2026-01-01 00:00:00",
			EndDate:     "2026-12-31 23:59:59",
			UsageLimit:  100,
			CreatedAt:   time.Now().Unix(),
		}
		d2 := &domain.Discount{
			ID:          "disc-2",
			Name:        "Expired Coupon",
			Code:        "EXPIRED",
			Type:        "amount",
			Value:       5000,
			Active:      true,
			StartDate:   "2020-01-01 00:00:00",
			EndDate:     "2020-12-31 23:59:59",
			UsageLimit:  50,
			UsageCount:  0,
			CreatedAt:   time.Now().Add(time.Second).Unix(),
		}

		if err := repo.CreateDiscount(d1); err != nil {
			t.Fatalf("CreateDiscount 1 failed: %v", err)
		}
		if err := repo.CreateDiscount(d2); err != nil {
			t.Fatalf("CreateDiscount 2 failed: %v", err)
		}

		list, err := repo.GetDiscounts()
		if err != nil {
			t.Fatalf("GetDiscounts failed: %v", err)
		}
		if len(list) != 2 {
			t.Errorf("Expected 2 discounts, got %d", len(list))
		}

		active, err := repo.GetActiveDiscounts(nowStr)
		if err != nil {
			t.Fatalf("GetActiveDiscounts failed: %v", err)
		}
		// Only disc-1 should be active now
		if len(active) != 1 || active[0].ID != "disc-1" {
			t.Errorf("Expected 1 active discount (disc-1), got %d", len(active))
		}
	})

	t.Run("GetByIDAndUpdates", func(t *testing.T) {
		d, err := repo.GetDiscountByID("disc-1")
		if err != nil {
			t.Fatalf("GetDiscountByID failed: %v", err)
		}
		if d.Name != "Summer Sale" {
			t.Errorf("Expected 'Summer Sale', got %q", d.Name)
		}

		d.Value = 15
		if err := repo.UpdateDiscount(d); err != nil {
			t.Fatalf("UpdateDiscount failed: %v", err)
		}

		updated, _ := repo.GetDiscountByID("disc-1")
		if updated.Value != 15 {
			t.Errorf("Expected updated value 15, got %f", updated.Value)
		}
	})

	t.Run("ValidateCouponAndUsage", func(t *testing.T) {
		// Valid coupon
		v, err := repo.ValidateCoupon("SUMMER10", nowStr)
		if err != nil {
			t.Fatalf("ValidateCoupon SUMMER10 failed: %v", err)
		}
		if v.ID != "disc-1" {
			t.Errorf("Expected valid coupon to be disc-1, got %q", v.ID)
		}

		// Expired coupon
		_, err = repo.ValidateCoupon("EXPIRED", nowStr)
		if err == nil {
			t.Error("Expected error validating expired coupon")
		}

		// Increment usage
		err = repo.IncrementUsageCount("disc-1")
		if err != nil {
			t.Fatalf("IncrementUsageCount failed: %v", err)
		}

		afterInc, _ := repo.GetDiscountByID("disc-1")
		if afterInc.UsageCount != 1 {
			t.Errorf("Expected usage_count 1, got %d", afterInc.UsageCount)
		}
	})

	t.Run("DeleteDiscount", func(t *testing.T) {
		if err := repo.DeleteDiscount("disc-2"); err != nil {
			t.Fatalf("DeleteDiscount failed: %v", err)
		}

		_, err := repo.GetDiscountByID("disc-2")
		if err == nil {
			t.Error("Expected error fetching deleted discount")
		}
	})
}
