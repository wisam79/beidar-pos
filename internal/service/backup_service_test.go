package service_test

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
	"strings"
	"testing"

	"gorm.io/gorm"
)

func setupBackupTestDB(t *testing.T) (service.BackupService, *gorm.DB, func()) {
	db, cleanup := testutil.SetupDB(t,
		&domain.Product{}, &domain.Sale{}, &domain.SaleItem{}, &domain.Customer{}, &domain.Payment{},
		&domain.StockMovement{}, &domain.Shift{}, &domain.CashMovement{}, &domain.Staff{},
		&domain.AppPreferences{}, &domain.LoginAttempt{}, &domain.Supplier{}, &domain.Category{},
		&domain.Expense{}, &domain.ParkedSale{}, &domain.PurchaseOrder{}, &domain.PurchaseOrderItem{},
	)

	// Set global DB for ResetDatabase/InitDB to work
	repository.SetTestDB(db)

	backupRepo := repository.NewBackupRepository(db)
	productRepo := repository.NewProductRepository(db)
	backupService := service.NewBackupService(backupRepo, productRepo)

	return backupService, db, func() {
		cleanup()
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

func TestBackupOperations(t *testing.T) {
	backupService, db, cleanup := setupBackupTestDB(t)
	defer cleanup()

	// Seed some data so export is not empty
	db.Create(&domain.Customer{ID: "cust_backup", Name: "Customer Backup"})

	// 1. GetBackupDir
	dir, err := service.GetBackupDir()
	if err != nil {
		t.Fatalf("Expected no error from GetBackupDir, got %v", err)
	}
	if dir == "" {
		t.Errorf("Expected valid backup dir path")
	}

	// 2. CreateBackup
	res, err := backupService.CreateBackup()
	if err != nil {
		t.Fatalf("Expected no error from CreateBackup, got %v", err)
	}
	if !res.Success {
		t.Errorf("Expected backup to succeed, error: %s", res.Error)
	}
	if res.Path == "" {
		t.Errorf("Expected backup path to be set")
	}

	// 3. ListBackups
	list, err := backupService.ListBackups()
	if err != nil {
		t.Fatalf("Expected no error from ListBackups, got %v", err)
	}
	if len(list) < 1 {
		t.Errorf("Expected at least 1 backup in list")
	}

	// 4. RestoreBackup
	err = backupService.RestoreBackup(res.Path)
	if err != nil {
		t.Fatalf("Expected no error from RestoreBackup, got %v", err)
	}

	// 5. CleanOldBackups (with 0 days to delete all)
	deleted, err := backupService.CleanOldBackups(0)
	if err != nil {
		t.Fatalf("Expected no error from CleanOldBackups, got %v", err)
	}
	// Note: cutoff logic might not delete immediate backups depending on timezone, but let's test deletion explicitly.

	// 6. DeleteBackup
	err = backupService.DeleteBackup(res.Path)
	if err != nil && deleted == 0 { // If clean didn't delete it, delete manually
		t.Fatalf("Expected no error from DeleteBackup, got %v", err)
	}
}

func TestImageStorageMigration(t *testing.T) {
	backupService, db, cleanup := setupBackupTestDB(t)
	defer cleanup()

	payload := strings.Repeat("A", 300)
	base64Image := "data:image/png;base64," + payload
	db.Create(&domain.Product{
		ID:    "prod_img_1",
		Name:  "Product With Image",
		Image: base64Image,
	})

	// Run migration
	migrated, err := backupService.MigrateImagesToFilesystem()
	if err != nil {
		t.Fatalf("Expected no error from MigrateImagesToFilesystem, got %v", err)
	}
	if migrated != 1 {
		t.Errorf("Expected 1 image migrated, got %d", migrated)
	}

	// Run stats
	stats, err := backupService.GetImageStorageStats()
	if err != nil {
		t.Fatalf("Expected no error from GetImageStorageStats, got %v", err)
	}
	if stats.TotalImages < 1 {
		t.Errorf("Expected at least 1 image in stats, got %d", stats.TotalImages)
	}
	if stats.Base64Count != 0 {
		t.Errorf("Expected 0 base64 images remaining, got %d", stats.Base64Count)
	}
}
