package repository

import (
	"fmt"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestProductRepo_GetForUpdate_MultipleProducts(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Product{})
	defer cleanup()

	repo := NewProductRepository(db)

	p1 := &domain.Product{ID: "p-lock-1", Name: "Prod 1", Price: domain.NewAmount(10), Stock: 10, Barcode: "BC-LK-1"}
	p2 := &domain.Product{ID: "p-lock-2", Name: "Prod 2", Price: domain.NewAmount(20), Stock: 20, Barcode: "BC-LK-2"}
	p3 := &domain.Product{ID: "p-lock-3", Name: "Prod 3", Price: domain.NewAmount(30), Stock: 30, Barcode: "BC-LK-3"}

	for _, p := range []*domain.Product{p1, p2, p3} {
		if err := repo.Create(p); err != nil {
			t.Fatalf("Create product failed: %v", err)
		}
	}

	// 1. Empty IDs slice returns empty slice without error
	emptyRes, err := repo.GetForUpdate([]string{})
	if err != nil {
		t.Fatalf("GetForUpdate with empty slice failed: %v", err)
	}
	if len(emptyRes) != 0 {
		t.Errorf("Expected 0 products for empty IDs, got %d", len(emptyRes))
	}

	// 2. Lock multiple products inside transaction
	err = repo.Transaction(func(tx domain.Tx) error {
		txRepo := repo.WithTx(tx)

		products, err := txRepo.GetForUpdate([]string{"p-lock-1", "p-lock-2", "p-lock-3"})
		if err != nil {
			return fmt.Errorf("GetForUpdate failed: %w", err)
		}
		if len(products) != 3 {
			return fmt.Errorf("expected 3 products, got %d", len(products))
		}

		// Update stock under lock
		for i := range products {
			products[i].Stock += 5
			if err := txRepo.Update(&products[i]); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("Transaction failed: %v", err)
	}

	// Verify stock was updated
	reloaded, err := repo.GetByID("p-lock-1")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if reloaded.Stock != 15 {
		t.Errorf("Stock = %f, want 15", reloaded.Stock)
	}

	// 3. Partial match with nonexistent ID
	partialRes, err := repo.GetForUpdate([]string{"p-lock-1", "nonexistent-prod"})
	if err != nil {
		t.Fatalf("GetForUpdate partial failed: %v", err)
	}
	if len(partialRes) != 1 || partialRes[0].ID != "p-lock-1" {
		t.Errorf("Partial GetForUpdate mismatch: %+v", partialRes)
	}
}

func TestProductRepo_UpdateStock_Negative(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Product{})
	defer cleanup()

	repo := NewProductRepository(db)

	prod := &domain.Product{
		ID:      "prod-stock-edge",
		Name:    "Stock Item",
		Price:   domain.NewAmount(50),
		Stock:   10,
		Barcode: "BC-STK-EDGE",
	}
	if err := repo.Create(prod); err != nil {
		t.Fatalf("Create product failed: %v", err)
	}

	// 1. Valid negative stock decrement (10 -> 6)
	if err := repo.UpdateStock("prod-stock-edge", -4); err != nil {
		t.Fatalf("UpdateStock partial reduction failed: %v", err)
	}
	p1, _ := repo.GetByID("prod-stock-edge")
	if p1.Stock != 6 {
		t.Errorf("Stock = %f, want 6", p1.Stock)
	}

	// 2. Exact reduction to zero (6 -> 0)
	if err := repo.UpdateStock("prod-stock-edge", -6); err != nil {
		t.Fatalf("UpdateStock reduction to zero failed: %v", err)
	}
	p2, _ := repo.GetByID("prod-stock-edge")
	if p2.Stock != 0 {
		t.Errorf("Stock = %f, want 0", p2.Stock)
	}

	// 3. Reducing stock below zero must return ErrInsufficientStock
	err := repo.UpdateStock("prod-stock-edge", -1)
	if err != domain.ErrInsufficientStock {
		t.Errorf("Expected ErrInsufficientStock, got %v", err)
	}

	// Verify stock is unchanged and remains 0
	p3, _ := repo.GetByID("prod-stock-edge")
	if p3.Stock != 0 {
		t.Errorf("Stock after failed update = %f, want 0", p3.Stock)
	}

	// 4. UpdateStock on nonexistent product returns ErrInsufficientStock
	err = repo.UpdateStock("nonexistent-prod-id", -5)
	if err != domain.ErrInsufficientStock {
		t.Errorf("Expected ErrInsufficientStock for nonexistent product, got %v", err)
	}
}

func TestProductRepo_DuplicateBarcode(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Product{})
	defer cleanup()

	repo := NewProductRepository(db)

	p1 := &domain.Product{
		ID:      "prod-bc-1",
		Name:    "Original Barcode Product",
		Price:   domain.NewAmount(100),
		Barcode: "UNIQUE-BARCODE-999",
	}
	if err := repo.Create(p1); err != nil {
		t.Fatalf("Failed to create first product with unique barcode: %v", err)
	}

	p2 := &domain.Product{
		ID:      "prod-bc-2",
		Name:    "Duplicate Barcode Product",
		Price:   domain.NewAmount(200),
		Barcode: "UNIQUE-BARCODE-999",
	}
	err := repo.Create(p2)
	if err == nil {
		t.Fatal("Expected DB error when creating product with duplicate barcode, got nil")
	}

	// Verify only 1 product exists with that barcode
	found, err := repo.GetByBarcode("UNIQUE-BARCODE-999")
	if err != nil {
		t.Fatalf("GetByBarcode failed: %v", err)
	}
	if found.ID != "prod-bc-1" {
		t.Errorf("Expected product ID 'prod-bc-1', got %s", found.ID)
	}
}
