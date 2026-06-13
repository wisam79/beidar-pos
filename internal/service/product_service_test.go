package service_test

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"os"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupProductTestDB(t *testing.T) (service.ProductService, *gorm.DB, func()) {
	dbFileName := "test_prod_" + uuid.New().String()[:8] + ".db"
	os.Remove(dbFileName)

	db, err := gorm.Open(sqlite.Open(dbFileName), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}

	db.AutoMigrate(&domain.Product{}, &domain.StockMovement{})

	productRepo := repository.NewProductRepository(db)
	productService := service.NewProductService(productRepo)

	return productService, db, func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
		os.Remove(dbFileName)
	}
}

func TestCreateProduct(t *testing.T) {
	s, _, cleanup := setupProductTestDB(t)
	defer cleanup()

	// 1. Success case
	p1 := &domain.Product{
		Name:    "Test Product 1",
		Barcode: "123456",
		Price:   domain.NewAmount(1000),
		Cost:    domain.NewAmount(500),
		Stock:   10,
	}
	err := s.CreateProduct(p1)
	if err != nil {
		t.Fatalf("CreateProduct failed: %v", err)
	}
	if p1.ID == "" {
		t.Error("Expected auto-generated product ID")
	}

	// 2. Error case: empty name
	p2 := &domain.Product{
		Name:    "",
		Barcode: "111222",
		Price:   domain.NewAmount(1000),
	}
	err = s.CreateProduct(p2)
	if err == nil {
		t.Error("Expected error when creating product with empty name")
	}

	// 3. Error case: negative price
	p3 := &domain.Product{
		Name:    "Negative Price Product",
		Barcode: "333444",
		Price:   domain.NewAmount(-100),
	}
	err = s.CreateProduct(p3)
	if err == nil {
		t.Error("Expected error when creating product with negative price")
	}
}

func TestGetProductByID(t *testing.T) {
	s, _, cleanup := setupProductTestDB(t)
	defer cleanup()

	p := &domain.Product{
		Name:    "Get By ID Test",
		Barcode: "999888",
		Price:   domain.NewAmount(2000),
	}
	s.CreateProduct(p)

	// 1. Success case
	found, err := s.GetProductByID(p.ID)
	if err != nil {
		t.Fatalf("GetProductByID failed: %v", err)
	}
	if found.Name != p.Name {
		t.Errorf("Expected name %s, got %s", p.Name, found.Name)
	}

	// 2. Error case: empty ID
	_, err = s.GetProductByID("")
	if err == nil {
		t.Error("Expected error when passing empty ID to GetProductByID")
	}

	// 3. Error case: non-existent ID
	_, err = s.GetProductByID("non-existent-id")
	if err == nil {
		t.Error("Expected error when looking up non-existent product ID")
	}
}

func TestUpdateProduct(t *testing.T) {
	s, _, cleanup := setupProductTestDB(t)
	defer cleanup()

	p := &domain.Product{
		Name:    "Update Test",
		Barcode: "555555",
		Price:   domain.NewAmount(1000),
	}
	s.CreateProduct(p)

	// 1. Success case
	p.Name = "Updated Product Name"
	p.Price = domain.NewAmount(1200)
	err := s.UpdateProduct(p)
	if err != nil {
		t.Fatalf("UpdateProduct failed: %v", err)
	}

	found, _ := s.GetProductByID(p.ID)
	if found.Name != "Updated Product Name" {
		t.Errorf("Expected updated name 'Updated Product Name', got %s", found.Name)
	}

	// 2. Error case: empty ID
	badProd := &domain.Product{
		ID:   "",
		Name: "Bad Product",
	}
	err = s.UpdateProduct(badProd)
	if err == nil {
		t.Error("Expected error when updating product with empty ID")
	}

	// 3. Error case: non-existent ID
	missingProd := &domain.Product{
		ID:   "missing-id",
		Name: "Missing Product",
	}
	err = s.UpdateProduct(missingProd)
	if err == nil {
		t.Error("Expected error when updating non-existent product")
	}
}

func TestDeleteProduct(t *testing.T) {
	s, _, cleanup := setupProductTestDB(t)
	defer cleanup()

	p := &domain.Product{
		Name:    "Delete Test",
		Barcode: "777777",
		Price:   domain.NewAmount(500),
	}
	s.CreateProduct(p)

	// 1. Error case: empty ID
	err := s.DeleteProduct("")
	if err == nil {
		t.Error("Expected error when deleting with empty ID")
	}

	// 2. Error case: non-existent ID
	err = s.DeleteProduct("non-existent")
	if err == nil {
		t.Error("Expected error when deleting non-existent ID")
	}

	// 3. Success case
	err = s.DeleteProduct(p.ID)
	if err != nil {
		t.Fatalf("DeleteProduct failed: %v", err)
	}

	_, err = s.GetProductByID(p.ID)
	if err == nil {
		t.Error("Expected product to be deleted from DB")
	}
}

func TestGetAllProductsAndSearch(t *testing.T) {
	s, _, cleanup := setupProductTestDB(t)
	defer cleanup()

	p1 := &domain.Product{
		Name:    "Apple Juice",
		Barcode: "1111",
		Price:   domain.NewAmount(500),
	}
	p2 := &domain.Product{
		Name:    "Orange Juice",
		Barcode: "2222",
		Price:   domain.NewAmount(600),
	}
	s.CreateProduct(p1)
	s.CreateProduct(p2)

	// GetAllProducts
	all, err := s.GetAllProducts()
	if err != nil {
		t.Fatalf("GetAllProducts failed: %v", err)
	}
	if len(all) != 2 {
		t.Errorf("Expected 2 products, got %d", len(all))
	}

	// SearchProducts (long query)
	results, err := s.SearchProducts("Apple")
	if err != nil {
		t.Fatalf("SearchProducts failed: %v", err)
	}
	if len(results) != 1 || results[0].Name != "Apple Juice" {
		t.Errorf("Expected search result 'Apple Juice', got %v", results)
	}

	// SearchProducts (short query < 2 chars)
	resultsShort, err := s.SearchProducts("a")
	if err != nil {
		t.Fatalf("SearchProducts failed: %v", err)
	}
	if len(resultsShort) == 0 {
		t.Error("Expected search with short query to execute fallback")
	}
}

func TestStockMovements(t *testing.T) {
	s, _, cleanup := setupProductTestDB(t)
	defer cleanup()

	// 1. LogStockMovement
	err := s.LogStockMovement("prod_1", "Test Product", "in", 5.0, "Initial Stock")
	if err != nil {
		t.Fatalf("LogStockMovement failed: %v", err)
	}

	// 2. GetStockMovements
	movements, err := s.GetStockMovements()
	if err != nil {
		t.Fatalf("GetStockMovements failed: %v", err)
	}
	if len(movements) != 1 {
		t.Fatalf("Expected 1 stock movement, got %d", len(movements))
	}
	if movements[0].Reason != "Initial Stock" || movements[0].Qty != 5.0 {
		t.Errorf("Stock movement attributes mismatch: %+v", movements[0])
	}
}

func TestProductServiceCache(t *testing.T) {
	s, db, cleanup := setupProductTestDB(t)
	defer cleanup()

	p := &domain.Product{
		Name:    "Cached Product",
		Barcode: "111222333",
		Price:   domain.NewAmount(150),
		Cost:    domain.NewAmount(100),
		Stock:   5,
	}
	err := s.CreateProduct(p)
	if err != nil {
		t.Fatalf("Failed to create product: %v", err)
	}

	// Populate cache by listing products
	all1, err := s.GetAllProducts()
	if err != nil || len(all1) != 1 {
		t.Fatalf("First GetAllProducts failed or returned wrong length: %v", err)
	}

	// Modify product directly in DB (bypass service cache)
	p.Name = "Directly Modified Name"
	if err := db.Save(p).Error; err != nil {
		t.Fatalf("Failed to save product directly to DB: %v", err)
	}

	// Fetch again via service. Should return cached name, not DB name
	all2, err := s.GetAllProducts()
	if err != nil {
		t.Fatalf("Second GetAllProducts failed: %v", err)
	}
	if all2[0].Name != "Cached Product" {
		t.Errorf("Expected cached name 'Cached Product', got '%s'", all2[0].Name)
	}

	// Explicitly clear cache
	s.ClearCache()

	// Fetch again. Should return new name from DB
	all3, err := s.GetAllProducts()
	if err != nil {
		t.Fatalf("Third GetAllProducts failed: %v", err)
	}
	if all3[0].Name != "Directly Modified Name" {
		t.Errorf("Expected name to be updated to 'Directly Modified Name' after ClearCache, got '%s'", all3[0].Name)
	}
}
