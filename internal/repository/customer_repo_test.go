package repository

import (
	"beidar-desktop/internal/core/domain"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupCustomerTestDB(t *testing.T) (domain.CustomerRepository, func()) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open in-memory DB: %v", err)
	}
	if err := db.AutoMigrate(&domain.Customer{}); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}
	repo := NewCustomerRepository(db)
	return repo, func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}
}

func TestCustomerRepository_Create(t *testing.T) {
	repo, cleanup := setupCustomerTestDB(t)
	defer cleanup()

	c := &domain.Customer{
		ID:    "cust_1",
		Name:  "Ali",
		Phone: "1234567890",
	}
	if err := repo.Create(c); err != nil {
		t.Fatalf("Failed to create customer: %v", err)
	}

	got, err := repo.GetByID("cust_1")
	if err != nil {
		t.Fatalf("Failed to get customer: %v", err)
	}
	if got.Name != "Ali" {
		t.Errorf("Name = %q, want 'Ali'", got.Name)
	}
}

func TestCustomerRepository_GetByPhone(t *testing.T) {
	repo, cleanup := setupCustomerTestDB(t)
	defer cleanup()

	c := &domain.Customer{
		ID:    "cust_phone",
		Name:  "Sara",
		Phone: "0987654321",
	}
	if err := repo.Create(c); err != nil {
		t.Fatalf("Failed to create customer: %v", err)
	}

	got, err := repo.GetByPhone("0987654321")
	if err != nil {
		t.Fatalf("GetByPhone failed: %v", err)
	}
	if got.ID != "cust_phone" {
		t.Errorf("Got customer %s, want cust_phone", got.ID)
	}

	_, err = repo.GetByPhone("0000000000")
	if err == nil {
		t.Error("Expected error for nonexistent phone")
	}
}

func TestCustomerRepository_Updates(t *testing.T) {
	repo, cleanup := setupCustomerTestDB(t)
	defer cleanup()

	c := &domain.Customer{
		ID:    "cust_update",
		Name:  "Initial",
		Phone: "1111111111",
	}
	if err := repo.Create(c); err != nil {
		t.Fatalf("Failed to create customer: %v", err)
	}

	if err := repo.Updates("cust_update", map[string]interface{}{
		"name": "Updated",
	}); err != nil {
		t.Fatalf("Updates failed: %v", err)
	}

	got, err := repo.GetByID("cust_update")
	if err != nil {
		t.Fatalf("Failed to get customer: %v", err)
	}
	if got.Name != "Updated" {
		t.Errorf("Name = %q, want 'Updated'", got.Name)
	}
}

func TestCustomerRepository_Search(t *testing.T) {
	repo, cleanup := setupCustomerTestDB(t)
	defer cleanup()

	customers := []*domain.Customer{
		{ID: "c1", Name: "Ahmed Ali", Phone: "1111"},
		{ID: "c2", Name: "Sara Ahmed", Phone: "2222"},
		{ID: "c3", Name: "Mohammed", Phone: "3333"},
	}
	for _, c := range customers {
		if err := repo.Create(c); err != nil {
			t.Fatalf("Failed to create customer: %v", err)
		}
	}

	results, err := repo.Search("Ahmed")
	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}
	if len(results) != 2 {
		t.Errorf("Search results = %d, want 2", len(results))
	}
}

func TestCustomerRepository_AdjustPoints(t *testing.T) {
	repo, cleanup := setupCustomerTestDB(t)
	defer cleanup()

	c := &domain.Customer{
		ID:     "cust_points",
		Name:   "Points Test",
		Phone:  "1234",
		Points: 100,
	}
	if err := repo.Create(c); err != nil {
		t.Fatalf("Failed to create customer: %v", err)
	}

	if err := repo.AdjustPoints("cust_points", 50); err != nil {
		t.Fatalf("AdjustPoints failed: %v", err)
	}

	got, err := repo.GetByID("cust_points")
	if err != nil {
		t.Fatalf("Failed to get customer: %v", err)
	}
	if got.Points != 150 {
		t.Errorf("Points = %d, want 150", got.Points)
	}

	if err := repo.AdjustPoints("cust_points", -30); err != nil {
		t.Fatalf("AdjustPoints (negative) failed: %v", err)
	}
	got, _ = repo.GetByID("cust_points")
	if got.Points != 120 {
		t.Errorf("Points after decrease = %d, want 120", got.Points)
	}
}
