package repository

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestShiftRepository(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	repo := NewShiftRepository(db)

	t.Run("GetActiveShift_NoneOpen", func(t *testing.T) {
		shift, err := repo.GetActiveShift()
		if err != nil {
			t.Fatalf("GetActiveShift failed: %v", err)
		}
		if shift != nil {
			t.Errorf("Expected nil active shift, got %v", shift)
		}
	})

	t.Run("SaveAndGetActiveShift", func(t *testing.T) {
		now := time.Now().Unix()
		s := &domain.Shift{
			ID:              "shift-1",
			StaffID:         "staff-1",
			StaffName:       "John Doe",
			Status:          "open",
			OpenTime:        now,
			OpeningBalance:  domain.Amount(50000),
			ExpectedBalance: domain.Amount(50000),
		}

		if err := repo.Save(s); err != nil {
			t.Fatalf("Failed to save shift: %v", err)
		}

		active, err := repo.GetActiveShift()
		if err != nil {
			t.Fatalf("GetActiveShift failed: %v", err)
		}
		if active == nil || active.ID != "shift-1" {
			t.Errorf("Expected active shift 'shift-1', got %v", active)
		}

		byID, err := repo.GetByID("shift-1")
		if err != nil {
			t.Fatalf("GetByID failed: %v", err)
		}
		if byID.StaffName != "John Doe" {
			t.Errorf("Expected staff name 'John Doe', got %q", byID.StaffName)
		}
	})

	t.Run("CashMovementsAndStats", func(t *testing.T) {
		moveIn := &domain.CashMovement{
			ID:        "move-1",
			ShiftID:   "shift-1",
			Amount:    domain.Amount(10000),
			Type:      "cash_in",
			Reason:    "Add change",
			Timestamp: time.Now().Unix(),
		}
		moveOut := &domain.CashMovement{
			ID:        "move-2",
			ShiftID:   "shift-1",
			Amount:    domain.Amount(5000),
			Type:      "cash_out",
			Reason:    "Payout",
			Timestamp: time.Now().Add(time.Second).Unix(),
		}

		if err := repo.CreateCashMovement(moveIn); err != nil {
			t.Fatalf("Failed to create cash in: %v", err)
		}
		if err := repo.CreateCashMovement(moveOut); err != nil {
			t.Fatalf("Failed to create cash out: %v", err)
		}

		moves, err := repo.GetShiftMovements("shift-1")
		if err != nil {
			t.Fatalf("GetShiftMovements failed: %v", err)
		}
		if len(moves) != 2 {
			t.Errorf("Expected 2 cash movements, got %d", len(moves))
		}

		cashIn, cashOut, err := repo.GetCashInAndOut("shift-1")
		if err != nil {
			t.Fatalf("GetCashInAndOut failed: %v", err)
		}
		if int64(cashIn) != 10000 {
			t.Errorf("Expected cash in 10000, got %v", cashIn)
		}
		if int64(cashOut) != 5000 {
			t.Errorf("Expected cash out 5000, got %v", cashOut)
		}
	})

	t.Run("UpdateShiftSales", func(t *testing.T) {
		err := repo.UpdateShiftSales(domain.Amount(20000), domain.Amount(15000), true)
		if err != nil {
			t.Fatalf("UpdateShiftSales failed: %v", err)
		}

		shift, err := repo.GetByID("shift-1")
		if err != nil {
			t.Fatalf("GetByID failed: %v", err)
		}

		if int64(shift.TotalSales) != 20000 {
			t.Errorf("Expected TotalSales 20000, got %v", shift.TotalSales)
		}
		if int64(shift.CashSales) != 15000 {
			t.Errorf("Expected CashSales 15000, got %v", shift.CashSales)
		}
		if shift.SalesCount != 1 {
			t.Errorf("Expected SalesCount 1, got %d", shift.SalesCount)
		}
		if int64(shift.ExpectedBalance) != 65000 { // 50000 + 15000
			t.Errorf("Expected ExpectedBalance 65000, got %v", shift.ExpectedBalance)
		}
	})

	t.Run("GetShiftHistory", func(t *testing.T) {
		// Close shift-1
		active, _ := repo.GetActiveShift()
		active.Status = "closed"
		active.CloseTime = time.Now().Unix()
		_ = repo.Save(active)

		history, err := repo.GetShiftHistory(10)
		if err != nil {
			t.Fatalf("GetShiftHistory failed: %v", err)
		}
		if len(history) != 1 || history[0].ID != "shift-1" {
			t.Errorf("Expected history to contain closed shift-1, got %v", history)
		}
	})

	t.Run("TransactionsAndWithTx", func(t *testing.T) {
		err := repo.Transaction(func(tx domain.Tx) error {
			txRepo := repo.WithTx(tx)
			s := &domain.Shift{
				ID:        "shift-tx",
				StaffID:   "staff-2",
				Status:    "open",
				OpenTime:  time.Now().Unix(),
				StaffName: "John Tx",
			}
			return txRepo.Save(s)
		})
		if err != nil {
			t.Fatalf("Transaction failed: %v", err)
		}

		shift, err := repo.GetByID("shift-tx")
		if err != nil {
			t.Fatalf("GetByID for tx shift failed: %v", err)
		}
		if shift.StaffName != "John Tx" {
			t.Errorf("Expected staff name 'John Tx', got %q", shift.StaffName)
		}
	})
}
