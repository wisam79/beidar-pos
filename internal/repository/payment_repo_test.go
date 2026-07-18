package repository

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestPaymentRepository(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	repo := NewPaymentRepository(db)

	t.Run("CreateAndRetrievePayments", func(t *testing.T) {
		p1 := &domain.Payment{
			Amount:     10000,
			SaleID:     "sale-abc",
			CustomerID: "cust-1",
			Method:     "cash",
			StaffID:    "staff-1",
			Timestamp:  time.Now().Unix(),
		}
		p2 := &domain.Payment{
			Amount:     15000,
			SaleID:     "sale-xyz",
			CustomerID: "cust-1",
			Method:     "card",
			StaffID:    "staff-1",
			Timestamp:  time.Now().Add(time.Second).Unix(),
		}

		if err := repo.Create(p1); err != nil {
			t.Fatalf("Create 1 failed: %v", err)
		}
		if err := repo.Create(p2); err != nil {
			t.Fatalf("Create 2 failed: %v", err)
		}

		// Check by sale ID
		bySale, err := repo.GetPaymentsBySale("sale-abc")
		if err != nil {
			t.Fatalf("GetPaymentsBySale failed: %v", err)
		}
		if len(bySale) != 1 || bySale[0].Method != "cash" {
			t.Errorf("Expected 1 cash payment for sale-abc, got %v", bySale)
		}

		// Check by customer ID
		byCust, err := repo.GetPaymentsByCustomer("cust-1")
		if err != nil {
			t.Fatalf("GetPaymentsByCustomer failed: %v", err)
		}
		if len(byCust) != 2 {
			t.Errorf("Expected 2 payments for cust-1, got %d", len(byCust))
		}

		// Check by numeric ID
		id := byCust[0].ID
		got, err := repo.GetByID(id)
		if err != nil {
			t.Fatalf("GetByID failed: %v", err)
		}
		if int64(got.Amount) != 15000 {
			t.Errorf("Expected Amount 15000, got %v", got.Amount)
		}
	})

	t.Run("DeletePayment", func(t *testing.T) {
		byCust, _ := repo.GetPaymentsByCustomer("cust-1")
		idToDelete := byCust[0].ID

		if err := repo.Delete(idToDelete); err != nil {
			t.Fatalf("Delete failed: %v", err)
		}

		_, err := repo.GetByID(idToDelete)
		if err == nil {
			t.Error("Expected error fetching deleted payment")
		}
	})

	t.Run("TransactionsAndWithTx", func(t *testing.T) {
		err := repo.Transaction(func(tx domain.Tx) error {
			txRepo := repo.WithTx(tx)
			p := &domain.Payment{
				Amount:     25000,
				SaleID:     "sale-tx",
				CustomerID: "cust-tx",
				Method:     "cash",
				Timestamp:  time.Now().Unix(),
			}
			return txRepo.Create(p)
		})
		if err != nil {
			t.Fatalf("Transaction failed: %v", err)
		}

		bySale, err := repo.GetPaymentsBySale("sale-tx")
		if err != nil {
			t.Fatalf("GetPaymentsBySale for tx payment failed: %v", err)
		}
		if len(bySale) != 1 || int64(bySale[0].Amount) != 25000 {
			t.Errorf("Expected 1 payment of 25000, got %v", bySale)
		}
	})
}
