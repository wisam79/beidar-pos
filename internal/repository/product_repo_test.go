package repository

import (
	"beidar-desktop/internal/core/domain"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupProductTestDB(t *testing.T) (domain.ProductRepository, *gorm.DB, func()) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open in-memory DB: %v", err)
	}
	if err := db.AutoMigrate(&domain.Product{}, &domain.StockMovement{}); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}
	repo := NewProductRepository(db)
	return repo, db, func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}
}

func TestProductRepository_Create(t *testing.T) {
	repo, _, cleanup := setupProductTestDB(t)
	defer cleanup()

	p := &domain.Product{
		ID:    "prod_test1",
		Name:  "Test Product",
		Price: domain.NewAmount(100),
		Cost:  domain.NewAmount(50),
		Stock: 10,
	}
	if err := repo.Create(p); err != nil {
		t.Fatalf("Failed to create product: %v", err)
	}

	got, err := repo.GetByID("prod_test1")
	if err != nil {
		t.Fatalf("Failed to get product: %v", err)
	}
	if got.Name != "Test Product" {
		t.Errorf("Name = %q, want %q", got.Name, "Test Product")
	}
	if got.Price != domain.NewAmount(100) {
		t.Errorf("Price = %s, want %s", got.Price, domain.NewAmount(100))
	}
}

func TestProductRepository_UpdateStock(t *testing.T) {
	repo, _, cleanup := setupProductTestDB(t)
	defer cleanup()

	p := &domain.Product{
		ID:    "prod_stock1",
		Name:  "Stock Test",
		Price: domain.NewAmount(50),
		Stock: 10,
	}
	if err := repo.Create(p); err != nil {
		t.Fatalf("Failed to create product: %v", err)
	}

	if err := repo.UpdateStock("prod_stock1", -3); err != nil {
		t.Fatalf("Failed to update stock: %v", err)
	}

	got, err := repo.GetByID("prod_stock1")
	if err != nil {
		t.Fatalf("Failed to get product: %v", err)
	}
	if got.Stock != 7 {
		t.Errorf("Stock = %f, want 7", got.Stock)
	}
}

func TestProductRepository_UpdateStock_Insufficient(t *testing.T) {
	repo, _, cleanup := setupProductTestDB(t)
	defer cleanup()

	p := &domain.Product{
		ID:    "prod_insufficient",
		Name:  "Low Stock",
		Price: domain.NewAmount(50),
		Stock: 5,
	}
	if err := repo.Create(p); err != nil {
		t.Fatalf("Failed to create product: %v", err)
	}

	err := repo.UpdateStock("prod_insufficient", -10)
	if err != domain.ErrInsufficientStock {
		t.Errorf("Expected ErrInsufficientStock, got %v", err)
	}
}

func TestProductRepository_Search(t *testing.T) {
	repo, _, cleanup := setupProductTestDB(t)
	defer cleanup()

	products := []*domain.Product{
		{ID: "p1", Name: "Apple Juice", Price: domain.NewAmount(10), Barcode: "1001"},
		{ID: "p2", Name: "Orange Juice", Price: domain.NewAmount(15), Barcode: "1002"},
		{ID: "p3", Name: "Bread", Price: domain.NewAmount(5), Barcode: "2001"},
	}
	for _, p := range products {
		if err := repo.Create(p); err != nil {
			t.Fatalf("Failed to create product: %v", err)
		}
	}

	results, err := repo.Search("Juice")
	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}
	if len(results) != 2 {
		t.Errorf("Search results = %d, want 2", len(results))
	}

	results, err = repo.Search("1001")
	if err != nil {
		t.Fatalf("Search by barcode failed: %v", err)
	}
	if len(results) != 1 || results[0].ID != "p1" {
		t.Errorf("Barcode search failed, got %d results", len(results))
	}
}

func TestProductRepository_GetByBarcode(t *testing.T) {
	repo, _, cleanup := setupProductTestDB(t)
	defer cleanup()

	p := &domain.Product{
		ID:      "prod_bc",
		Name:    "Barcode Product",
		Barcode: "ABC123",
		Price:   domain.NewAmount(25),
	}
	if err := repo.Create(p); err != nil {
		t.Fatalf("Failed to create product: %v", err)
	}

	got, err := repo.GetByBarcode("ABC123")
	if err != nil {
		t.Fatalf("GetByBarcode failed: %v", err)
	}
	if got.ID != "prod_bc" {
		t.Errorf("Got product %s, want prod_bc", got.ID)
	}

	_, err = repo.GetByBarcode("NONEXISTENT")
	if err == nil {
		t.Error("Expected error for nonexistent barcode, got nil")
	}
}
