package service_test

import (
	"strings"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupProductEdgeTestDB(t *testing.T) (domain.ProductService, *gorm.DB, func()) {
	t.Helper()
	db, cleanup := testutil.SetupFullDB(t)
	testutil.SeedPreferences(t, db)

	productRepo := repository.NewProductRepository(db)
	productService := service.NewProductService(productRepo)

	return productService, db, cleanup
}

func TestEdge_CreateProduct_EmptyName_Rejected(t *testing.T) {
	s, _, cleanup := setupProductEdgeTestDB(t)
	defer cleanup()

	// 1. Empty name
	p := &domain.Product{
		Name:    "",
		Barcode: "100200300",
		Price:   domain.NewAmount(5000),
		Cost:    domain.NewAmount(3000),
		Stock:   10,
	}
	err := s.CreateProduct(p)
	if err == nil {
		t.Fatal("Expected CreateProduct to fail with empty product name")
	}
	if !strings.Contains(err.Error(), "اسم المنتج مطلوب") {
		t.Errorf("Expected error 'اسم المنتج مطلوب', got: %v", err)
	}

	// Verify no product was inserted
	all, _ := s.GetAllProducts()
	if len(all) != 0 {
		t.Errorf("Expected 0 products in DB, got %d", len(all))
	}
}

func TestEdge_CreateProduct_NegativePrice_Rejected(t *testing.T) {
	s, _, cleanup := setupProductEdgeTestDB(t)
	defer cleanup()

	// 1. Negative Price
	p1 := &domain.Product{
		Name:    "Negative Price Item",
		Barcode: "1110001",
		Price:   domain.NewAmount(-500),
		Cost:    domain.NewAmount(100),
		Stock:   5,
	}
	err := s.CreateProduct(p1)
	if err == nil {
		t.Fatal("Expected error for negative selling price")
	}
	if !strings.Contains(err.Error(), "سعر البيع لا يمكن أن يكون سالباً") {
		t.Errorf("Expected negative price error, got: %v", err)
	}

	// 2. Negative Cost
	p2 := &domain.Product{
		Name:    "Negative Cost Item",
		Barcode: "1110002",
		Price:   domain.NewAmount(1000),
		Cost:    domain.NewAmount(-200),
		Stock:   5,
	}
	err = s.CreateProduct(p2)
	if err == nil {
		t.Fatal("Expected error for negative cost price")
	}
	if !strings.Contains(err.Error(), "سعر التكلفة لا يمكن أن يكون سالباً") {
		t.Errorf("Expected negative cost error, got: %v", err)
	}

	// 3. Negative Stock
	p3 := &domain.Product{
		Name:    "Negative Stock Item",
		Barcode: "1110003",
		Price:   domain.NewAmount(1000),
		Cost:    domain.NewAmount(500),
		Stock:   -10,
	}
	err = s.CreateProduct(p3)
	if err == nil {
		t.Fatal("Expected error for negative initial stock")
	}
	if !strings.Contains(err.Error(), "الكمية بالمخزن لا يمكن أن تكون سالبة") {
		t.Errorf("Expected negative stock error, got: %v", err)
	}
}

func TestEdge_UpdateProduct_PriceChange_StockUnchanged(t *testing.T) {
	s, db, cleanup := setupProductEdgeTestDB(t)
	defer cleanup()

	initialStock := 45.5
	p := &domain.Product{
		Name:     "Espresso Coffee Beans",
		Barcode:  "9900112233",
		Price:    domain.NewAmount(15000),
		Cost:     domain.NewAmount(9000),
		Stock:    initialStock,
		Category: "Beverages",
	}
	if err := s.CreateProduct(p); err != nil {
		t.Fatalf("CreateProduct failed: %v", err)
	}

	// Prime cache
	cachedProd, err := s.GetProductByID(p.ID)
	if err != nil {
		t.Fatalf("GetProductByID failed: %v", err)
	}
	if cachedProd.Price != domain.NewAmount(15000) {
		t.Errorf("Cached price wrong: %s", cachedProd.Price.String())
	}

	// Update only price and cost, leaving stock identical
	p.Price = domain.NewAmount(18000)
	p.Cost = domain.NewAmount(11000)
	if err := s.UpdateProduct(p); err != nil {
		t.Fatalf("UpdateProduct failed: %v", err)
	}

	// 1. Verify in DB directly
	var dbProd domain.Product
	if err := db.First(&dbProd, "id = ?", p.ID).Error; err != nil {
		t.Fatalf("Failed to reload product from DB: %v", err)
	}
	if dbProd.Stock != initialStock {
		t.Errorf("Expected stock to remain %.2f, got %.2f", initialStock, dbProd.Stock)
	}
	if dbProd.Price != domain.NewAmount(18000) {
		t.Errorf("Expected updated price 18000, got %s", dbProd.Price.String())
	}
	if dbProd.Cost != domain.NewAmount(11000) {
		t.Errorf("Expected updated cost 11000, got %s", dbProd.Cost.String())
	}

	// 2. Verify via service (cache invalidated and refreshed)
	freshProd, err := s.GetProductByID(p.ID)
	if err != nil {
		t.Fatalf("GetProductByID after update failed: %v", err)
	}
	if freshProd.Price != domain.NewAmount(18000) {
		t.Errorf("Expected fresh price 18000, got %s", freshProd.Price.String())
	}
	if freshProd.Stock != initialStock {
		t.Errorf("Expected fresh stock %.2f, got %.2f", initialStock, freshProd.Stock)
	}
}

func TestEdge_DeleteProduct_WithStockMovement(t *testing.T) {
	s, db, cleanup := setupProductEdgeTestDB(t)
	defer cleanup()

	productID := "prod_" + uuid.New().String()
	p := &domain.Product{
		ID:      productID,
		Name:    "Mechanical Keyboard RGB",
		Barcode: "7766554433",
		Price:   domain.NewAmount(45000),
		Cost:    domain.NewAmount(30000),
		Stock:   15,
	}
	if err := s.CreateProduct(p); err != nil {
		t.Fatalf("CreateProduct failed: %v", err)
	}

	// Log stock movements for this product
	if err := s.LogStockMovement(productID, p.Name, "in", 15, "Initial stock received"); err != nil {
		t.Fatalf("LogStockMovement 1 failed: %v", err)
	}
	if err := s.LogStockMovement(productID, p.Name, "sale", -2, "Invoice #101"); err != nil {
		t.Fatalf("LogStockMovement 2 failed: %v", err)
	}

	// Delete product
	if err := s.DeleteProduct(productID); err != nil {
		t.Fatalf("DeleteProduct failed: %v", err)
	}

	// 1. Verify product is gone from DB
	var dbProd domain.Product
	err := db.First(&dbProd, "id = ?", productID).Error
	if err == nil {
		t.Fatal("Expected product to be deleted from DB")
	}

	// 2. Verify GetProductByID fails
	_, err = s.GetProductByID(productID)
	if err == nil {
		t.Fatal("Expected GetProductByID to fail for deleted product")
	}

	// 3. Verify stock movements are preserved in audit trail
	movements, err := s.GetStockMovements()
	if err != nil {
		t.Fatalf("GetStockMovements failed: %v", err)
	}
	foundCount := 0
	for _, m := range movements {
		if m.ProductID == productID {
			foundCount++
		}
	}
	if foundCount != 2 {
		t.Errorf("Expected 2 audit stock movements preserved, found %d", foundCount)
	}
}

func TestEdge_LogStockMovement_AuditTrailCreated(t *testing.T) {
	s, _, cleanup := setupProductEdgeTestDB(t)
	defer cleanup()

	productID := "prod_audit_test"
	productName := "Audit Trail Item"

	err := s.LogStockMovement(productID, productName, "restock", 50.0, "PO-2026-001 Received")
	if err != nil {
		t.Fatalf("LogStockMovement failed: %v", err)
	}

	movements, err := s.GetStockMovements()
	if err != nil {
		t.Fatalf("GetStockMovements failed: %v", err)
	}

	if len(movements) != 1 {
		t.Fatalf("Expected 1 stock movement, got %d", len(movements))
	}

	m := movements[0]
	if m.ProductID != productID {
		t.Errorf("Expected ProductID %q, got %q", productID, m.ProductID)
	}
	if m.ProductName != productName {
		t.Errorf("Expected ProductName %q, got %q", productName, m.ProductName)
	}
	if m.Type != "restock" {
		t.Errorf("Expected Type 'restock', got %q", m.Type)
	}
	if m.Qty != 50.0 {
		t.Errorf("Expected Qty 50.0, got %.2f", m.Qty)
	}
	if m.Reason != "PO-2026-001 Received" {
		t.Errorf("Expected Reason 'PO-2026-001 Received', got %q", m.Reason)
	}
	if m.Timestamp <= 0 {
		t.Errorf("Expected positive timestamp, got %d", m.Timestamp)
	}
}
