package repository

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestShiftRepo_UpdateShiftSales_AtomicIncrement(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Shift{})
	defer cleanup()

	repo := NewShiftRepository(db)

	shift := &domain.Shift{
		ID:              "shift-atomic-sales",
		StaffID:         "staff-01",
		StaffName:       "Cashier Mona",
		Status:          "open",
		OpenTime:        time.Now().Unix(),
		OpeningBalance:  domain.NewAmount(100), // 10,000 cents
		ExpectedBalance: domain.NewAmount(100),
		TotalSales:      domain.Zero(),
		CashSales:       domain.Zero(),
		SalesCount:      0,
	}
	if err := repo.Save(shift); err != nil {
		t.Fatalf("Failed to save initial shift: %v", err)
	}

	// 1. First Sale: 50 total, 50 cash, isNewSale=true
	if err := repo.UpdateShiftSales(domain.NewAmount(50), domain.NewAmount(50), true, true); err != nil {
		t.Fatalf("UpdateShiftSales (sale 1) failed: %v", err)
	}
	s1, err := repo.GetByID("shift-atomic-sales")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if s1.TotalSales != domain.NewAmount(50) || s1.CashSales != domain.NewAmount(50) || s1.SalesCount != 1 || s1.ExpectedBalance != domain.NewAmount(150) {
		t.Errorf("Shift after sale 1 mismatch: TotalSales=%s, CashSales=%s, SalesCount=%d, ExpectedBalance=%s",
			s1.TotalSales, s1.CashSales, s1.SalesCount, s1.ExpectedBalance)
	}

	// 2. Second Sale: 80 total, 0 cash (debt sale), isNewSale=true
	if err := repo.UpdateShiftSales(domain.NewAmount(80), domain.Zero(), true, true); err != nil {
		t.Fatalf("UpdateShiftSales (sale 2) failed: %v", err)
	}
	s2, err := repo.GetByID("shift-atomic-sales")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if s2.TotalSales != domain.NewAmount(130) || s2.CashSales != domain.NewAmount(50) || s2.SalesCount != 2 || s2.ExpectedBalance != domain.NewAmount(150) {
		t.Errorf("Shift after sale 2 mismatch: TotalSales=%s, CashSales=%s, SalesCount=%d, ExpectedBalance=%s",
			s2.TotalSales, s2.CashSales, s2.SalesCount, s2.ExpectedBalance)
	}

	// 3. Customer Debt Payment: 0 total, 30 cash, isNewSale=false (should NOT increment sales_count)
	if err := repo.UpdateShiftSales(domain.Zero(), domain.NewAmount(30), false, true); err != nil {
		t.Fatalf("UpdateShiftSales (debt payment) failed: %v", err)
	}
	s3, err := repo.GetByID("shift-atomic-sales")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if s3.TotalSales != domain.NewAmount(130) || s3.CashSales != domain.NewAmount(80) || s3.SalesCount != 2 || s3.ExpectedBalance != domain.NewAmount(180) {
		t.Errorf("Shift after debt payment mismatch: TotalSales=%s, CashSales=%s, SalesCount=%d, ExpectedBalance=%s",
			s3.TotalSales, s3.CashSales, s3.SalesCount, s3.ExpectedBalance)
	}
}

func TestShiftRepo_UpdateShiftRefunds_CorrectDeduction(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Shift{})
	defer cleanup()

	repo := NewShiftRepository(db)

	shift := &domain.Shift{
		ID:              "shift-refund-edge",
		StaffID:         "staff-02",
		StaffName:       "Manager Omar",
		Status:          "open",
		OpenTime:        time.Now().Unix(),
		OpeningBalance:  domain.NewAmount(200),
		ExpectedBalance: domain.NewAmount(500), // 200 opening + 300 cash sales
		TotalSales:      domain.NewAmount(400),
		CashSales:       domain.NewAmount(300),
		SalesCount:      4,
	}
	if err := repo.Save(shift); err != nil {
		t.Fatalf("Failed to save shift: %v", err)
	}

	// 1. Partial refund: 40 total refund, 40 cash refund, isFullReturn=false (sales_count NOT decremented)
	if err := repo.UpdateShiftRefunds(domain.NewAmount(40), domain.NewAmount(40), false); err != nil {
		t.Fatalf("UpdateShiftRefunds (partial) failed: %v", err)
	}
	s1, err := repo.GetByID("shift-refund-edge")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if s1.TotalSales != domain.NewAmount(360) || s1.CashSales != domain.NewAmount(260) || s1.SalesCount != 4 || s1.ExpectedBalance != domain.NewAmount(460) {
		t.Errorf("Shift after partial refund mismatch: TotalSales=%s, CashSales=%s, SalesCount=%d, ExpectedBalance=%s",
			s1.TotalSales, s1.CashSales, s1.SalesCount, s1.ExpectedBalance)
	}

	// 2. Full refund: 60 total refund, 60 cash refund, isFullReturn=true (sales_count decremented by 1)
	if err := repo.UpdateShiftRefunds(domain.NewAmount(60), domain.NewAmount(60), true); err != nil {
		t.Fatalf("UpdateShiftRefunds (full) failed: %v", err)
	}
	s2, err := repo.GetByID("shift-refund-edge")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if s2.TotalSales != domain.NewAmount(300) || s2.CashSales != domain.NewAmount(200) || s2.SalesCount != 3 || s2.ExpectedBalance != domain.NewAmount(400) {
		t.Errorf("Shift after full refund mismatch: TotalSales=%s, CashSales=%s, SalesCount=%d, ExpectedBalance=%s",
			s2.TotalSales, s2.CashSales, s2.SalesCount, s2.ExpectedBalance)
	}

	// 3. UpdateShiftRefunds when no active shift is a safe no-op
	s2.Status = "closed"
	_ = repo.Save(s2)

	if err := repo.UpdateShiftRefunds(domain.NewAmount(50), domain.NewAmount(50), true); err != nil {
		t.Errorf("Expected nil error when updating refunds with no open shift, got %v", err)
	}
}

func TestShiftRepo_NoActiveShift_ReturnsNil(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Shift{})
	defer cleanup()

	repo := NewShiftRepository(db)

	// 1. Completely empty database
	active, err := repo.GetActiveShift()
	if err != nil {
		t.Fatalf("GetActiveShift on empty DB returned error: %v", err)
	}
	if active != nil {
		t.Errorf("Expected nil active shift on empty DB, got %+v", active)
	}

	// 2. Closed shift in database
	closedShift := &domain.Shift{
		ID:        "shift-closed-prev",
		StaffID:   "staff-03",
		Status:    "closed",
		CloseTime: time.Now().Unix(),
	}
	if err := repo.Save(closedShift); err != nil {
		t.Fatalf("Failed to save closed shift: %v", err)
	}

	activeAfterClosed, err := repo.GetActiveShift()
	if err != nil {
		t.Fatalf("GetActiveShift with only closed shifts returned error: %v", err)
	}
	if activeAfterClosed != nil {
		t.Errorf("Expected nil active shift with only closed shifts, got %+v", activeAfterClosed)
	}

	// 3. UpdateShiftSales when requireShift=true returns error
	err = repo.UpdateShiftSales(domain.NewAmount(100), domain.NewAmount(100), true, true)
	if err == nil {
		t.Error("Expected error from UpdateShiftSales when requireShift=true and no active shift, got nil")
	}

	// 4. UpdateShiftSales when requireShift=false returns nil
	err = repo.UpdateShiftSales(domain.NewAmount(100), domain.NewAmount(100), true, false)
	if err != nil {
		t.Errorf("Expected nil from UpdateShiftSales when requireShift=false, got %v", err)
	}
}
