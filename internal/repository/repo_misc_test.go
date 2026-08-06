package repository

import (
	"errors"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

// TestTransactionWrappers exercises the Transaction() and WithTx() methods on
// repos whose implementations previously had no test coverage.
func TestTransactionWrappers(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	seedStaff := func(t *testing.T, id, username string) {
		t.Helper()
		s := &domain.Staff{ID: id, Username: username, Name: "x", Role: domain.RoleCashier}
		if err := db.Create(s).Error; err != nil {
			t.Fatalf("seed staff failed: %v", err)
		}
	}
	seedStaff(t, "st_1", "st1")

	t.Run("StaffTransactionCommitAndRollback", func(t *testing.T) {
		repo := NewStaffRepository(db)

		err := repo.Transaction(func(tx domain.Tx) error {
			if tx == nil {
				t.Error("expected non-nil tx")
			}
			gdb := getDB(tx, db)
			s := &domain.Staff{ID: "st_tx", Username: "stx", Name: "tx", Role: domain.RoleCashier}
			return gdb.Create(s).Error
		})
		if err != nil {
			t.Fatalf("Transaction(commit) failed: %v", err)
		}

		// Rollback: returning an error must abort the change.
		err = repo.Transaction(func(tx domain.Tx) error {
			gdb := getDB(tx, db)
			s := &domain.Staff{ID: "st_rb", Username: "srb", Name: "rb", Role: domain.RoleCashier}
			if cerr := gdb.Create(s).Error; cerr != nil {
				return cerr
			}
			return errors.New("force rollback")
		})
		if err == nil {
			t.Fatal("expected Transaction to surface the rollback error")
		}
		if _, gerr := repo.GetByID("st_rb"); gerr == nil {
			t.Error("staff created inside rolled-back tx should not exist")
		}
	})

	t.Run("StaffWithTxNilAndBound", func(t *testing.T) {
		repo := NewStaffRepository(db)

		if r := repo.WithTx(nil); r == nil {
			t.Fatal("WithTx(nil) returned nil")
		}
		bound := repo.WithTx(domain.NewTx(db))
		got, err := bound.GetByID("st_1")
		if err != nil {
			t.Fatalf("WithTx-bound GetByID failed: %v", err)
		}
		if got.Username != "st1" {
			t.Errorf("username = %q, want 'st1'", got.Username)
		}
	})

	t.Run("SupplierAndCustomerTransaction", func(t *testing.T) {
		sRepo := NewSupplierRepository(db)
		if err := sRepo.Transaction(func(tx domain.Tx) error { return nil }); err != nil {
			t.Errorf("supplier Transaction failed: %v", err)
		}

		cRepo := NewCustomerRepository(db)
		if err := cRepo.Transaction(func(tx domain.Tx) error { return nil }); err != nil {
			t.Errorf("customer Transaction failed: %v", err)
		}
	})
}

func TestCustomerRepository_UpdateFullStruct(t *testing.T) {
	repo, cleanup := setupCustomerTestDB(t)
	defer cleanup()

	c := &domain.Customer{
		ID:    "cust_full",
		Name:  "Old",
		Phone: "4444",
		Debt:  domain.NewAmount(10),
	}
	if err := repo.Create(c); err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	c.Name = "New"
	c.Debt = domain.NewAmount(25)
	if err := repo.Update(c); err != nil {
		t.Fatalf("Update failed: %v", err)
	}

	got, err := repo.GetByID("cust_full")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if got.Name != "New" {
		t.Errorf("Name = %q, want 'New'", got.Name)
	}
	if got.Debt.Cents() != 2500 {
		t.Errorf("Debt = %d, want 2500", got.Debt.Cents())
	}
}

func TestSaleRepository_SyncFlags(t *testing.T) {
	repo, _, cleanup := setupSaleTestDB(t)
	defer cleanup()

	syncable := &domain.Sale{ID: "s_sync", Total: domain.NewAmount(50)}
	if err := repo.Create(syncable); err != nil {
		t.Fatalf("Create(syncable) failed: %v", err)
	}
	already := &domain.Sale{ID: "s_done", Total: domain.NewAmount(90), ZohoSynced: true}
	if err := repo.Create(already); err != nil {
		t.Fatalf("Create(already) failed: %v", err)
	}

	unsynced, err := repo.GetUnsyncedSales()
	if err != nil {
		t.Fatalf("GetUnsyncedSales failed: %v", err)
	}
	if len(unsynced) != 1 || unsynced[0].ID != "s_sync" {
		t.Fatalf("unsynced = %+v, want only s_sync", unsynced)
	}

	if err := repo.MarkSaleAsSynced("s_sync"); err != nil {
		t.Fatalf("MarkSaleAsSynced failed: %v", err)
	}
	unsynced, _ = repo.GetUnsyncedSales()
	if len(unsynced) != 0 {
		t.Errorf("unsynced after sync = %d, want 0", len(unsynced))
	}
}