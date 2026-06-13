package service_test

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"os"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupBackupTestDB(t *testing.T) (service.BackupService, *gorm.DB, func()) {
	dbFileName := "test_backup_" + uuid.New().String()[:8] + ".db"
	os.Remove(dbFileName)

	db, err := gorm.Open(sqlite.Open(dbFileName), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}

	// Set global DB for ResetDatabase/InitDB to work
	repository.SetTestDB(db)

	db.AutoMigrate(
		&domain.Product{}, &domain.Sale{}, &domain.SaleItem{}, &domain.Customer{}, &domain.Payment{},
		&domain.StockMovement{}, &domain.Shift{}, &domain.CashMovement{}, &domain.Staff{},
		&domain.AppPreferences{}, &domain.LoginAttempt{}, &domain.Supplier{}, &domain.Category{},
		&domain.Expense{}, &domain.ParkedSale{}, &domain.PurchaseOrder{}, &domain.PurchaseOrderItem{},
	)

	backupRepo := repository.NewBackupRepository(db)
	productRepo := repository.NewProductRepository(db)
	backupService := service.NewBackupService(backupRepo, productRepo)

	return backupService, db, func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
		os.Remove(dbFileName)
		repository.SetTestDB(nil)
	}
}

func TestCSVExportImport(t *testing.T) {
	backupService, db, cleanup := setupBackupTestDB(t)
	defer cleanup()

	// Create test products
	db.Create(&domain.Product{
		ID:       "prod_1",
		Name:     "Product 1",
		Barcode:  "111111",
		Price:    1000,
		Cost:     500,
		Stock:    10,
		MinStock: 2,
		Category: "Cat A",
		Supplier: "Sup A",
	})

	// Export CSV
	exportResult, err := backupService.ExportProductsCSV()
	if err != nil {
		t.Fatalf("Failed to export products to CSV: %v", err)
	}

	if exportResult.Count != 1 {
		t.Errorf("Expected count 1, got %d", exportResult.Count)
	}

	if !strings.Contains(exportResult.Data, "Product 1") {
		t.Errorf("Expected CSV data to contain Product 1, got %s", exportResult.Data)
	}

	// Template test
	template := backupService.GetCSVTemplate()
	if !strings.Contains(template, "الباركود") {
		t.Errorf("Expected CSV template to contain Barcode header, got %s", template)
	}

	// Import CSV
	csvImportData := `الباركود,اسم المنتج,الوصف,الفئة,المورد,التكلفة,السعر,المخزون,الحد الأدنى
222222,Product 2,Desc 2,Cat B,Sup B,600,1200,20,5`

	importResult, err := backupService.ImportProductsCSV(csvImportData, false)
	if err != nil {
		t.Fatalf("Failed to import CSV: %v", err)
	}

	if !importResult.Success {
		t.Errorf("Expected import success, errors: %v", importResult.Errors)
	}

	if importResult.Imported != 1 {
		t.Errorf("Expected 1 imported product, got %d", importResult.Imported)
	}

	// Verify imported product in DB
	var p domain.Product
	if err := db.First(&p, "barcode = ?", "222222").Error; err != nil {
		t.Fatalf("Failed to find imported product: %v", err)
	}
	if p.Name != "Product 2" {
		t.Errorf("Expected Name 'Product 2', got %s", p.Name)
	}
}

func TestDatabaseExportImport(t *testing.T) {
	backupService, db, cleanup := setupBackupTestDB(t)
	defer cleanup()

	db.Create(&domain.Customer{ID: "cust_1", Name: "Customer 1", Phone: "123456"})
	db.Create(&domain.Product{ID: "prod_1", Name: "Product 1", Price: 100})

	exportResult, err := backupService.ExportDatabase()
	if err != nil {
		t.Fatalf("Failed to export DB: %v", err)
	}

	if len(exportResult.Customers) != 1 {
		t.Errorf("Expected 1 customer in export, got %d", len(exportResult.Customers))
	}

	// Reset DB
	err = backupService.ResetDatabase()
	if err != nil {
		t.Fatalf("Failed to reset DB: %v", err)
	}

	// Check if empty
	var custCount int64
	db.Model(&domain.Customer{}).Count(&custCount)
	if custCount != 0 {
		t.Errorf("Expected 0 customers after reset, got %d", custCount)
	}

	// Import back
	err = backupService.ImportDatabase(*exportResult)
	if err != nil {
		t.Fatalf("Failed to import DB: %v", err)
	}

	db.Model(&domain.Customer{}).Count(&custCount)
	if custCount != 1 {
		t.Errorf("Expected 1 customer after import, got %d", custCount)
	}
}
