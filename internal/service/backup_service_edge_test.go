package service_test

import (
	"encoding/csv"
	"strings"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupBackupEdgeTestDB(t *testing.T) (domain.BackupService, *gorm.DB, func()) {
	t.Helper()
	db, cleanup := testutil.SetupFullDB(t)
	testutil.SeedPreferences(t, db)

	repository.SetTestDB(db)

	backupRepo := repository.NewBackupRepository(db)
	productRepo := repository.NewProductRepository(db)
	backupService := service.NewBackupService(backupRepo, productRepo)

	return backupService, db, func() {
		cleanup()
		repository.SetTestDB(nil)
	}
}

func TestEdge_ExportProductsCSV_FormulaInjection(t *testing.T) {
	s, db, cleanup := setupBackupEdgeTestDB(t)
	defer cleanup()

	// 1. Insert products with formula injection payloads (=, +, -, @)
	prod1 := domain.Product{
		ID:          uuid.New().String(),
		Name:        "=SUM(A1:A10)",
		Barcode:     "+123456789",
		Description: "Formula test 1",
		Category:    "General",
		Supplier:    "Main Supplier",
		Price:       domain.NewAmount(10000),
		Cost:        domain.NewAmount(7000),
		Stock:       10,
	}
	prod2 := domain.Product{
		ID:          uuid.New().String(),
		Name:        "-cmd|'/C calc'!A0",
		Barcode:     "99887766",
		Description: "@malicious_link",
		Category:    "=DDE(server,topic,item)",
		Supplier:    "+SupplierInc",
		Price:       domain.NewAmount(5000),
		Cost:        domain.NewAmount(3000),
		Stock:       5,
	}
	prod3 := domain.Product{
		ID:          uuid.New().String(),
		Name:        "Safe Standard Product",
		Barcode:     "11223344",
		Description: "Normal description",
		Category:    "Electronics",
		Supplier:    "Safe Supplier",
		Price:       domain.NewAmount(25000),
		Cost:        domain.NewAmount(18000),
		Stock:       20,
	}

	if err := db.Create(&prod1).Error; err != nil {
		t.Fatalf("Failed to create product 1: %v", err)
	}
	if err := db.Create(&prod2).Error; err != nil {
		t.Fatalf("Failed to create product 2: %v", err)
	}
	if err := db.Create(&prod3).Error; err != nil {
		t.Fatalf("Failed to create product 3: %v", err)
	}

	// 2. Export to CSV
	exportResult, err := s.ExportProductsCSV()
	if err != nil {
		t.Fatalf("ExportProductsCSV failed: %v", err)
	}
	if exportResult.Count != 3 {
		t.Fatalf("Expected 3 exported products, got %d", exportResult.Count)
	}

	// 3. Parse CSV rows and verify sanitization
	reader := csv.NewReader(strings.NewReader(exportResult.Data))
	records, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("Failed to parse exported CSV data: %v", err)
	}

	// Expected headers: ["الباركود", "اسم المنتج", "الوصف", "الفئة", "المورد", "التكلفة", "السعر", "المخزون", "الحد الأدنى"]
	if len(records) != 4 { // 1 header + 3 products
		t.Fatalf("Expected 4 CSV records (1 header + 3 data), got %d", len(records))
	}

	foundProd1 := false
	foundProd2 := false
	foundProd3 := false

	for _, row := range records[1:] {
		barcode := row[0]
		name := row[1]
		desc := row[2]
		cat := row[3]
		sup := row[4]

		if name == "'=SUM(A1:A10)" {
			foundProd1 = true
			if barcode != "'+123456789" {
				t.Errorf("Expected sanitized barcode '+123456789, got %q", barcode)
			}
		}

		if name == "'-cmd|'/C calc'!A0" {
			foundProd2 = true
			if desc != "'@malicious_link" {
				t.Errorf("Expected sanitized description '@malicious_link, got %q", desc)
			}
			if cat != "'=DDE(server,topic,item)" {
				t.Errorf("Expected sanitized category '=DDE(server,topic,item), got %q", cat)
			}
			if sup != "'+SupplierInc" {
				t.Errorf("Expected sanitized supplier '+SupplierInc, got %q", sup)
			}
		}

		if name == "Safe Standard Product" {
			foundProd3 = true
			if strings.HasPrefix(name, "'") {
				t.Errorf("Safe product name should not have leading quote, got %q", name)
			}
			if barcode != "11223344" {
				t.Errorf("Safe product barcode should not have leading quote, got %q", barcode)
			}
		}
	}

	if !foundProd1 {
		t.Error("Did not find sanitized prod1 ('=SUM(A1:A10))")
	}
	if !foundProd2 {
		t.Error("Did not find sanitized prod2 ('-cmd|'/C calc'!A0)")
	}
	if !foundProd3 {
		t.Error("Did not find safe prod3 (Safe Standard Product)")
	}
}

func TestEdge_ImportProductsCSV_MalformedHeaders(t *testing.T) {
	s, _, cleanup := setupBackupEdgeTestDB(t)
	defer cleanup()

	// 1. Completely empty CSV
	resEmpty, err := s.ImportProductsCSV("", false)
	if err != nil {
		t.Fatalf("ImportProductsCSV returned unexpected error: %v", err)
	}
	if resEmpty.Success {
		t.Error("Expected empty CSV import to fail")
	}
	if len(resEmpty.Errors) == 0 || !strings.Contains(resEmpty.Errors[0], "فارغ") {
		t.Errorf("Expected error to mention empty file, got: %v", resEmpty.Errors)
	}

	// 2. CSV with header only, no data rows
	headerOnlyCSV := "الباركود,اسم المنتج,الوصف,الفئة,المورد,التكلفة,السعر,المخزون,الحد الأدنى"
	resHeaderOnly, err := s.ImportProductsCSV(headerOnlyCSV, false)
	if err != nil {
		t.Fatalf("ImportProductsCSV returned unexpected error: %v", err)
	}
	if resHeaderOnly.Success {
		t.Error("Expected header-only CSV import to fail")
	}
	if len(resHeaderOnly.Errors) == 0 || !strings.Contains(resHeaderOnly.Errors[0], "لا يحتوي على صفوف بيانات") {
		t.Errorf("Expected error 'الملف لا يحتوي على صفوف بيانات', got: %v", resHeaderOnly.Errors)
	}

	// 3. CSV with invalid rows (empty product name, invalid negative price)
	invalidRowsCSV := `الباركود,اسم المنتج,الوصف,الفئة,المورد,التكلفة,السعر,المخزون,الحد الأدنى
1001,,No Name Item,Cat A,Sup A,500,1000,10,2
1002,Negative Price Item,Desc,Cat A,Sup A,500,-1500,10,2
1003,Valid Item,Desc,Cat A,Sup A,500,1200,10,2`

	resInvalidRows, err := s.ImportProductsCSV(invalidRowsCSV, false)
	if err != nil {
		t.Fatalf("ImportProductsCSV returned unexpected error: %v", err)
	}

	if resInvalidRows.Skipped != 2 {
		t.Errorf("Expected 2 skipped rows, got %d", resInvalidRows.Skipped)
	}
	if resInvalidRows.Imported != 1 {
		t.Errorf("Expected 1 imported valid product, got %d", resInvalidRows.Imported)
	}
	if len(resInvalidRows.Errors) < 2 {
		t.Errorf("Expected at least 2 error messages, got: %v", resInvalidRows.Errors)
	}
}
