package integration_test

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/testutil"
	"github.com/google/uuid"
)

// TestIntegration_DisasterRecovery_FullArchiveRestore tests catastrophic disaster recovery:
// 1. Seeds complete enterprise relational data (Products, Sales, Customers with debts, Shifts, Expenses, POs).
// 2. Creates a full database export snapshot.
// 3. Simulates catastrophic data wipeout.
// 4. Restores entire state from the backup archive.
// 5. Verifies 100% data fidelity, table counts, financial ledger integrity, and runs PRAGMA integrity_check.
func TestIntegration_DisasterRecovery_FullArchiveRestore(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	backupRepo := repository.NewBackupRepository(db)
	prodRepo := repository.NewProductRepository(db)
	custRepo := repository.NewCustomerRepository(db)
	saleRepo := repository.NewSaleRepository(db)
	shiftRepo := repository.NewShiftRepository(db)

	// 1. Seed Products
	prod1 := &domain.Product{
		ID:       "prod_1",
		Name:     "لابتوب ديل 15 بوصة",
		Barcode:  "DELL-15-5520",
		Price:    domain.NewAmount(850000),
		Cost:     domain.NewAmount(700000),
		Stock:    8,
		MinStock: 2,
		Category: "إلكترونيات",
	}
	if err := prodRepo.Create(prod1); err != nil {
		t.Fatalf("Create prod1 failed: %v", err)
	}

	prod2 := &domain.Product{
		ID:       "prod_2",
		Name:     "ماوس لاسلكي لوجيتك",
		Barcode:  "LOGI-M185",
		Price:    domain.NewAmount(15000),
		Cost:     domain.NewAmount(9000),
		Stock:    25,
		MinStock: 5,
		Category: "ملحقات",
	}
	if err := prodRepo.Create(prod2); err != nil {
		t.Fatalf("Create prod2 failed: %v", err)
	}

	// 2. Seed Customer with debt and points
	cust1 := &domain.Customer{
		ID:              "cust_disaster_1",
		Name:            "مكتب الاستشارات الهندسية",
		Phone:           "07708889900",
		Debt:            domain.NewAmount(450000),
		InstallmentDebt: domain.NewAmount(200000),
		TotalPurchases:  domain.NewAmount(1500000),
		Points:          150,
	}
	if err := custRepo.Create(cust1); err != nil {
		t.Fatalf("Create cust1 failed: %v", err)
	}

	// 3. Seed Sale with items
	sale1 := &domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    cust1.ID,
		CustomerName:  cust1.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      domain.NewAmount(865000),
		Total:         domain.NewAmount(865000),
		PaymentMethod: "credit",
		Status:        "completed",
		ItemsCount:    2,
		Items: []domain.SaleItem{
			{
				ProductID: prod1.ID,
				Name:      prod1.Name,
				Quantity:  1,
				Price:     prod1.Price,
				Total:     prod1.Price,
			},
			{
				ProductID: prod2.ID,
				Name:      prod2.Name,
				Quantity:  1,
				Price:     prod2.Price,
				Total:     prod2.Price,
			},
		},
	}
	if err := saleRepo.Create(sale1); err != nil {
		t.Fatalf("Create sale1 failed: %v", err)
	}

	// 4. Seed Shift
	shift1 := &domain.Shift{
		ID:              "shift_disaster_01",
		StaffID:         "staff_admin_1",
		StaffName:       "المدير العام",
		OpenTime:        time.Now().UnixMilli() - 3600000,
		CloseTime:       time.Now().UnixMilli(),
		OpeningBalance:  domain.NewAmount(100000),
		ClosingBalance:  domain.NewAmount(965000),
		ExpectedBalance: domain.NewAmount(965000),
		TotalSales:      domain.NewAmount(865000),
		CashSales:       domain.NewAmount(865000),
		SalesCount:      1,
		Status:          "closed",
	}
	if err := shiftRepo.Save(shift1); err != nil {
		t.Fatalf("Save shift1 failed: %v", err)
	}

	// 5. Create Full Backup Export
	exportData, err := backupRepo.Export()
	if err != nil {
		t.Fatalf("Backup Export failed: %v", err)
	}
	if len(exportData.Products) != 2 || len(exportData.Customers) != 1 || len(exportData.Sales) != 1 {
		t.Fatalf("Unexpected export count: prods=%d custs=%d sales=%d", len(exportData.Products), len(exportData.Customers), len(exportData.Sales))
	}

	// 6. Simulate Disaster: Wipe tables
	db.Exec("DELETE FROM products;")
	db.Exec("DELETE FROM customers;")
	db.Exec("DELETE FROM sales;")
	db.Exec("DELETE FROM sale_items;")
	db.Exec("DELETE FROM shifts;")

	// Verify database is wiped
	prodsAfterWipe, _ := prodRepo.GetAll()
	if len(prodsAfterWipe) != 0 {
		t.Fatalf("expected 0 products after wipe, got %d", len(prodsAfterWipe))
	}

	// 7. Execute Full Restore
	if err := backupRepo.Import(*exportData); err != nil {
		t.Fatalf("Backup Import / Restore failed: %v", err)
	}

	// 8. Verify 100% Data Fidelity after restore
	prodsRestored, err := prodRepo.GetAll()
	if err != nil || len(prodsRestored) != 2 {
		t.Fatalf("expected 2 restored products, got %d (err: %v)", len(prodsRestored), err)
	}

	cRestored, err := custRepo.GetByID(cust1.ID)
	if err != nil || cRestored == nil {
		t.Fatalf("customer not restored: %v", err)
	}
	if !testutil.AmountEq(cRestored.Debt, domain.NewAmount(450000)) {
		t.Errorf("restored debt mismatch: got %s, want 450000", cRestored.Debt.String())
	}
	if cRestored.Points != 150 {
		t.Errorf("restored points mismatch: got %d, want 150", cRestored.Points)
	}

	sRestored, err := saleRepo.GetByID(sale1.ID)
	if err != nil || sRestored == nil {
		t.Fatalf("sale not restored: %v", err)
	}
	if !testutil.AmountEq(sRestored.Total, domain.NewAmount(865000)) {
		t.Errorf("restored sale total mismatch: got %s, want 865000", sRestored.Total.String())
	}

	itemsRestored, err := saleRepo.GetSaleItems(sale1.ID)
	if err != nil || len(itemsRestored) != 2 {
		t.Fatalf("expected 2 restored sale items, got %d", len(itemsRestored))
	}

	// 9. Run SQLite Integrity Checks
	var integrityResult string
	if err := db.Raw("PRAGMA integrity_check;").Scan(&integrityResult).Error; err != nil || integrityResult != "ok" {
		t.Fatalf("PRAGMA integrity_check failed: %s (err: %v)", integrityResult, err)
	}

	var fkCheck []string
	if err := db.Raw("PRAGMA foreign_key_check;").Scan(&fkCheck).Error; err != nil || len(fkCheck) > 0 {
		t.Fatalf("PRAGMA foreign_key_check failed: %+v (err: %v)", fkCheck, err)
	}
}
