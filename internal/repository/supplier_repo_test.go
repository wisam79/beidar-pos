package repository

import (
	"testing"

	"beidar-desktop/internal/core/domain"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupSupplierTestDB(t *testing.T) (domain.SupplierRepository, func()) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open in-memory DB: %v", err)
	}
	if err := db.AutoMigrate(&domain.Supplier{}); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}
	return NewSupplierRepository(db), func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}
}

func TestSupplierRepository_Update(t *testing.T) {
	repo, cleanup := setupSupplierTestDB(t)
	defer cleanup()

	s := &domain.Supplier{
		ID:          "sup_1",
		Name:        "المورد الأول",
		CompanyName: "شركة أ",
		Phone:       "111",
		Email:       "a@x.com",
		Notes:       "note",
	}
	if err := repo.Create(s); err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	// Modify fields and update.
	s.Name = "المورد المحدث"
	s.CompanyName = "شركة ب"
	s.Balance = domain.NewAmount(150.0)
	if err := repo.Update(s); err != nil {
		t.Fatalf("Update failed: %v", err)
	}

	got, err := repo.GetByID("sup_1")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if got.Name != "المورد المحدث" {
		t.Errorf("Name = %q, want 'المورد المحدث'", got.Name)
	}
	if got.Balance.Cents() != 15000 {
		t.Errorf("Balance = %d, want 15000", got.Balance.Cents())
	}
}

func TestSupplierRepository_GetAll(t *testing.T) {
	repo, cleanup := setupSupplierTestDB(t)
	defer cleanup()

	suppliers := []*domain.Supplier{
		{ID: "s1", Name: "أ"},
		{ID: "s2", Name: "ب"},
	}
	for _, s := range suppliers {
		if err := repo.Create(s); err != nil {
			t.Fatalf("Create failed: %v", err)
		}
	}

	got, err := repo.GetAll()
	if err != nil {
		t.Fatalf("GetAll failed: %v", err)
	}
	if len(got) != 2 {
		t.Errorf("GetAll len = %d, want 2", len(got))
	}
}

func TestSupplierRepository_GetForUpdate(t *testing.T) {
	repo, cleanup := setupSupplierTestDB(t)
	defer cleanup()

	s := &domain.Supplier{ID: "sup_lock", Name: "قفل"}
	if err := repo.Create(s); err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	got, err := repo.GetForUpdate("sup_lock")
	if err != nil {
		t.Fatalf("GetForUpdate failed: %v", err)
	}
	if got.Name != "قفل" {
		t.Errorf("Name = %q, want 'قفل'", got.Name)
	}

	if _, err := repo.GetForUpdate("missing"); err == nil {
		t.Error("expected error for missing supplier")
	}
}

func TestSupplierRepository_UpdateBalance(t *testing.T) {
	repo, cleanup := setupSupplierTestDB(t)
	defer cleanup()

	s := &domain.Supplier{ID: "sup_bal", Name: "رصيد", Balance: domain.NewAmount(200.0)}
	if err := repo.Create(s); err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	if err := repo.UpdateBalance("sup_bal", domain.NewAmount(50.0)); err != nil {
		t.Fatalf("UpdateBalance failed: %v", err)
	}

	got, _ := repo.GetByID("sup_bal")
	if got.Balance.Cents() != 15000 {
		t.Errorf("Balance = %d, want 15000 (200 - 50 debit)", got.Balance.Cents())
	}
}

func TestSupplierRepository_Delete(t *testing.T) {
	repo, cleanup := setupSupplierTestDB(t)
	defer cleanup()

	s := &domain.Supplier{ID: "sup_del", Name: "حذف"}
	if err := repo.Create(s); err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	if err := repo.Delete("sup_del"); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	if _, err := repo.GetByID("sup_del"); err == nil {
		t.Error("expected error after delete")
	}
}