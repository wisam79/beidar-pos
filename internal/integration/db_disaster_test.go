package integration_test

import (
	"errors"
	"sync"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/testutil"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TestDB_WALMode_LockContention_Backoff tests that SQLite busy_timeout allows backoff and eventual success under write contention.
func TestDB_WALMode_LockContention_Backoff(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	// 1. Set busy_timeout to 2000ms
	if err := db.Exec("PRAGMA busy_timeout = 2000;").Error; err != nil {
		t.Fatalf("failed to set busy_timeout: %v", err)
	}

	var wg sync.WaitGroup
	wg.Add(2)

	startSignal := make(chan struct{})
	var errWorker1, errWorker2 error

	// Worker 1 holds a lock for 200ms
	go func() {
		defer wg.Done()
		<-startSignal
		errWorker1 = db.Transaction(func(tx *gorm.DB) error {
			p := &domain.Product{
				ID:      uuid.New().String(),
				Name:    "Worker 1 Product",
				Barcode: uuid.New().String()[:8],
				Price:   domain.NewAmount(10.00),
				Stock:   10,
			}
			if err := tx.Create(p).Error; err != nil {
				return err
			}
			time.Sleep(200 * time.Millisecond) // Hold lock
			return nil
		})
	}()

	// Worker 2 attempts concurrent transaction (will wait on busy_timeout and succeed)
	go func() {
		defer wg.Done()
		<-startSignal
		time.Sleep(20 * time.Millisecond) // Small delay so Worker 1 acquires lock first
		errWorker2 = db.Transaction(func(tx *gorm.DB) error {
			p := &domain.Product{
				ID:      uuid.New().String(),
				Name:    "Worker 2 Product",
				Barcode: uuid.New().String()[:8],
				Price:   domain.NewAmount(20.00),
				Stock:   20,
			}
			return tx.Create(p).Error
		})
	}()

	close(startSignal)
	wg.Wait()

	if errWorker1 != nil {
		t.Errorf("Worker 1 failed: %v", errWorker1)
	}
	if errWorker2 != nil {
		t.Errorf("Worker 2 failed (busy_timeout backoff did not work): %v", errWorker2)
	}

	var count int64
	db.Model(&domain.Product{}).Count(&count)
	if count != 2 {
		t.Errorf("expected 2 products created, got %d", count)
	}
}

// TestDB_DiskFull_TransactionRollback tests full transaction rollback on simulated I/O errors.
func TestDB_DiskFull_TransactionRollback(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	productID := uuid.New().String()
	p := &domain.Product{
		ID:    productID,
		Name:  "Initial Product",
		Price: domain.NewAmount(100.00),
		Stock: 50,
	}
	if err := db.Create(p).Error; err != nil {
		t.Fatalf("failed to create product: %v", err)
	}

	// Attempt transaction that fails mid-way due to simulated disk full / I/O error
	errSimulated := errors.New("DISK_FULL_SIMULATION_ERROR")
	errTx := db.Transaction(func(tx *gorm.DB) error {
		// Update product stock
		if err := tx.Model(&domain.Product{}).Where("id = ?", productID).Update("stock", 10).Error; err != nil {
			return err
		}

		// Create stock movement
		mov := &domain.StockMovement{
			ProductID:   productID,
			ProductName: "Initial Product",
			Qty:         -40,
			Reason:      "Sale",
			Type:        "OUT",
		}
		if err := tx.Create(mov).Error; err != nil {
			return err
		}

		// Simulate disk full failure before commit!
		return errSimulated
	})

	if !errors.Is(errTx, errSimulated) {
		t.Fatalf("expected simulated error %v, got %v", errSimulated, errTx)
	}

	// Reload product from DB — stock must be intact (50, not 10)
	var reloaded domain.Product
	if err := db.First(&reloaded, "id = ?", productID).Error; err != nil {
		t.Fatalf("failed to reload product: %v", err)
	}
	if reloaded.Stock != 50 {
		t.Errorf("expected stock to remain 50 after rollback, got %f", reloaded.Stock)
	}

	// Verify movement record was NOT created
	var countMov int64
	db.Model(&domain.StockMovement{}).Where("product_id = ?", productID).Count(&countMov)
	if countMov != 0 {
		t.Errorf("expected 0 stock movements after rollback, got %d", countMov)
	}
}

// TestDB_CascadingDelete_ConstraintVeto tests that deleting a parent entity with active dependencies is handled gracefully.
func TestDB_CascadingDelete_ConstraintVeto(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	// 1. Setup Category -> Product -> StockMovement
	catID := uuid.New().String()
	cat := &domain.Category{ID: catID, Name: "Main Category"}
	if err := db.Create(cat).Error; err != nil {
		t.Fatalf("failed to create category: %v", err)
	}

	prod := testutil.NewProduct(t, db, "Dependency Product", 50.0, 10)
	prod.Category = cat.Name
	db.Save(prod)

	mov := &domain.StockMovement{
		ProductID:   prod.ID,
		ProductName: prod.Name,
		Qty:         10,
		Reason:      "Initial Stock",
		Type:        "IN",
	}
	if err := db.Create(mov).Error; err != nil {
		t.Fatalf("failed to create stock movement: %v", err)
	}

	// 2. Use ProductRepo to attempt deleting product
	prodRepo := repository.NewProductRepository(db)

	errDelete := prodRepo.Delete(prod.ID)
	// Verify stock movement is NOT orphaned
	var movReloaded domain.StockMovement
	if err := db.First(&movReloaded, "product_id = ?", prod.ID).Error; err != nil {
		t.Errorf("stock movement was orphaned or deleted when product was removed: %v", err)
	}
	_ = errDelete
}
