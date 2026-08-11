package repository

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestBackupRepo_ExportAllTables(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	repo := NewBackupRepository(db)

	// Populate data across tables
	cat := domain.Category{ID: "cat-1", Name: "Beverages"}
	if err := db.Create(&cat).Error; err != nil {
		t.Fatalf("Failed to seed category: %v", err)
	}

	sup := domain.Supplier{ID: "sup-1", Name: "Beverage Corp", Phone: "07901112233"}
	if err := db.Create(&sup).Error; err != nil {
		t.Fatalf("Failed to seed supplier: %v", err)
	}

	cust := domain.Customer{ID: "cust-1", Name: "Zaid Ali", Phone: "07801234567", Debt: domain.NewAmount(50)}
	if err := db.Create(&cust).Error; err != nil {
		t.Fatalf("Failed to seed customer: %v", err)
	}

	prod := domain.Product{
		ID:       "prod-1",
		Name:     "Green Tea",
		Barcode:  "BC-TEA-101",
		Price:    domain.NewAmount(15),
		Cost:     domain.NewAmount(8),
		Stock:    50,
		Category: "Beverages",
		Supplier: "Beverage Corp",
	}
	if err := db.Create(&prod).Error; err != nil {
		t.Fatalf("Failed to seed product: %v", err)
	}

	sale := domain.Sale{
		ID:           "sale-1",
		CustomerID:   "cust-1",
		CustomerName: "Zaid Ali",
		Total:        domain.NewAmount(30),
		Subtotal:     domain.NewAmount(30),
		Status:       "completed",
		Items: []domain.SaleItem{
			{SaleID: "sale-1", ProductID: "prod-1", Name: "Green Tea", Price: domain.NewAmount(15), Quantity: 2, Total: domain.NewAmount(30)},
		},
	}
	if err := db.Create(&sale).Error; err != nil {
		t.Fatalf("Failed to seed sale: %v", err)
	}

	exp := domain.Expense{ID: "exp-1", Title: "Electricity", Amount: domain.NewAmount(100), Date: "2026-08-01", Category: "Utilities"}
	if err := db.Create(&exp).Error; err != nil {
		t.Fatalf("Failed to seed expense: %v", err)
	}

	sm := domain.StockMovement{ProductID: "prod-1", ProductName: "Green Tea", Type: "in", Qty: 50, Timestamp: time.Now().Unix()}
	if err := db.Create(&sm).Error; err != nil {
		t.Fatalf("Failed to seed stock movement: %v", err)
	}

	staff := domain.Staff{ID: "staff-1", Name: "Cashier Ahmed", Username: "ahmed_pos", Role: domain.RoleCashier, Active: true}
	if err := db.Create(&staff).Error; err != nil {
		t.Fatalf("Failed to seed staff: %v", err)
	}

	pay := domain.Payment{SaleID: "sale-1", CustomerID: "cust-1", Amount: domain.NewAmount(30), Method: "cash", Timestamp: time.Now().Unix()}
	if err := db.Create(&pay).Error; err != nil {
		t.Fatalf("Failed to seed payment: %v", err)
	}

	parked := domain.ParkedSale{CustomerName: "Parked Order", Total: domain.NewAmount(45), ItemsJSON: `[{"id":"prod-1","qty":3}]`, ItemsCount: 3}
	if err := db.Create(&parked).Error; err != nil {
		t.Fatalf("Failed to seed parked sale: %v", err)
	}

	shift := domain.Shift{ID: "shift-1", StaffID: "staff-1", StaffName: "Cashier Ahmed", Status: "open", OpeningBalance: domain.NewAmount(200)}
	if err := db.Create(&shift).Error; err != nil {
		t.Fatalf("Failed to seed shift: %v", err)
	}

	cm := domain.CashMovement{ID: "cm-1", ShiftID: "shift-1", Type: "cash_in", Amount: domain.NewAmount(50), Reason: "Change", Timestamp: time.Now().Unix()}
	if err := db.Create(&cm).Error; err != nil {
		t.Fatalf("Failed to seed cash movement: %v", err)
	}

	po := domain.PurchaseOrder{
		ID:           "po-1",
		SupplierID:   "sup-1",
		SupplierName: "Beverage Corp",
		Status:       domain.POStatusPending,
		TotalAmount:  domain.NewAmount(160),
		Items: []domain.PurchaseOrderItem{
			{OrderID: "po-1", ProductID: "prod-1", ProductName: "Green Tea", Quantity: 20, UnitCost: domain.NewAmount(8), Total: domain.NewAmount(160)},
		},
	}
	if err := db.Create(&po).Error; err != nil {
		t.Fatalf("Failed to seed purchase order: %v", err)
	}

	prefs := domain.AppPreferences{ID: 1, StoreName: "Beidar Export Store", Currency: "IQD"}
	if err := db.Save(&prefs).Error; err != nil {
		t.Fatalf("Failed to seed preferences: %v", err)
	}

	// Execute Export
	exportData, err := repo.Export()
	if err != nil {
		t.Fatalf("Export returned unexpected error: %v", err)
	}
	if exportData == nil {
		t.Fatal("Export returned nil data")
	}

	// Verify all exported data structures
	if len(exportData.Categories) != 1 || exportData.Categories[0].Name != "Beverages" {
		t.Errorf("Categories mismatch: %+v", exportData.Categories)
	}
	if len(exportData.Suppliers) != 1 || exportData.Suppliers[0].Name != "Beverage Corp" {
		t.Errorf("Suppliers mismatch: %+v", exportData.Suppliers)
	}
	if len(exportData.Customers) != 1 || exportData.Customers[0].ID != "cust-1" {
		t.Errorf("Customers mismatch: %+v", exportData.Customers)
	}
	if len(exportData.Products) != 1 || exportData.Products[0].Barcode != "BC-TEA-101" {
		t.Errorf("Products mismatch: %+v", exportData.Products)
	}
	if len(exportData.Sales) != 1 || exportData.Sales[0].ID != "sale-1" {
		t.Errorf("Sales mismatch: %+v", exportData.Sales)
	}
	if len(exportData.Sales[0].Items) != 1 || exportData.Sales[0].Items[0].Name != "Green Tea" {
		t.Errorf("Sales items preload mismatch: %+v", exportData.Sales[0].Items)
	}
	if len(exportData.Expenses) != 1 || exportData.Expenses[0].Title != "Electricity" {
		t.Errorf("Expenses mismatch: %+v", exportData.Expenses)
	}
	if len(exportData.StockMovements) != 1 || exportData.StockMovements[0].Qty != 50 {
		t.Errorf("StockMovements mismatch: %+v", exportData.StockMovements)
	}
	if len(exportData.Staff) != 1 || exportData.Staff[0].Username != "ahmed_pos" {
		t.Errorf("Staff mismatch: %+v", exportData.Staff)
	}
	if len(exportData.Payments) != 1 || exportData.Payments[0].Method != "cash" {
		t.Errorf("Payments mismatch: %+v", exportData.Payments)
	}
	if len(exportData.ParkedSales) != 1 || exportData.ParkedSales[0].CustomerName != "Parked Order" {
		t.Errorf("ParkedSales mismatch: %+v", exportData.ParkedSales)
	}
	if len(exportData.Shifts) != 1 || exportData.Shifts[0].ID != "shift-1" {
		t.Errorf("Shifts mismatch: %+v", exportData.Shifts)
	}
	if len(exportData.CashMovements) != 1 || exportData.CashMovements[0].Reason != "Change" {
		t.Errorf("CashMovements mismatch: %+v", exportData.CashMovements)
	}
	if len(exportData.PurchaseOrders) != 1 || exportData.PurchaseOrders[0].ID != "po-1" {
		t.Errorf("PurchaseOrders mismatch: %+v", exportData.PurchaseOrders)
	}
	if len(exportData.PurchaseOrders[0].Items) != 1 || exportData.PurchaseOrders[0].Items[0].Quantity != 20 {
		t.Errorf("PurchaseOrder items preload mismatch: %+v", exportData.PurchaseOrders[0].Items)
	}
	if exportData.Preferences == nil || exportData.Preferences.StoreName != "Beidar Export Store" {
		t.Errorf("Preferences mismatch: %+v", exportData.Preferences)
	}
}

func TestBackupRepo_ImportAndVerifyIntegrity(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	repo := NewBackupRepository(db)

	exportData := domain.DatabaseExport{
		Categories: []domain.Category{
			{ID: "cat-imp-1", Name: "Electronics"},
		},
		Suppliers: []domain.Supplier{
			{ID: "sup-imp-1", Name: "Global Tech", Phone: "07700000000"},
		},
		Customers: []domain.Customer{
			{ID: "cust-imp-1", Name: "Mustafa", Phone: "07501112233", Debt: domain.NewAmount(120)},
		},
		Products: []domain.Product{
			{ID: "prod-imp-1", Name: "USB Cable", Barcode: "BC-USB-99", Price: domain.NewAmount(10), Cost: domain.NewAmount(4), Stock: 100},
		},
		Sales: []domain.Sale{
			{
				ID:           "sale-imp-1",
				CustomerID:   "cust-imp-1",
				CustomerName: "Mustafa",
				Total:        domain.NewAmount(20),
				Items: []domain.SaleItem{
					{ProductID: "prod-imp-1", Name: "USB Cable", Price: domain.NewAmount(10), Quantity: 2, Total: domain.NewAmount(20)},
				},
			},
		},
		Expenses: []domain.Expense{
			{ID: "exp-imp-1", Title: "Internet", Amount: domain.NewAmount(60), Date: "2026-08-05", Category: "Bills"},
		},
		StockMovements: []domain.StockMovement{
			{ProductID: "prod-imp-1", ProductName: "USB Cable", Type: "in", Qty: 100, Timestamp: 1700000000},
		},
		Preferences: &domain.AppPreferences{
			ID:        1,
			StoreName: "Imported Store",
			Currency:  "IQD",
		},
		Staff: []domain.Staff{
			{ID: "staff-imp-1", Name: "Sara Admin", Username: "sara_admin", Role: domain.RoleAdmin, Active: true},
		},
		Payments: []domain.Payment{
			{SaleID: "sale-imp-1", CustomerID: "cust-imp-1", Amount: domain.NewAmount(20), Method: "card"},
		},
		ParkedSales: []domain.ParkedSale{
			{CustomerName: "Walk-in", Total: domain.NewAmount(10), ItemsJSON: "[]", ItemsCount: 1},
		},
		Shifts: []domain.Shift{
			{ID: "shift-imp-1", StaffID: "staff-imp-1", StaffName: "Sara Admin", Status: "closed", OpeningBalance: domain.NewAmount(300)},
		},
		CashMovements: []domain.CashMovement{
			{ID: "cm-imp-1", ShiftID: "shift-imp-1", Type: "cash_out", Amount: domain.NewAmount(25), Reason: "Lunch"},
		},
		PurchaseOrders: []domain.PurchaseOrder{
			{
				ID:           "po-imp-1",
				SupplierID:   "sup-imp-1",
				SupplierName: "Global Tech",
				Status:       domain.POStatusReceived,
				TotalAmount:  domain.NewAmount(400),
				Items: []domain.PurchaseOrderItem{
					{ProductID: "prod-imp-1", ProductName: "USB Cable", Quantity: 100, UnitCost: domain.NewAmount(4), Total: domain.NewAmount(400)},
				},
			},
		},
	}

	if err := repo.Import(exportData); err != nil {
		t.Fatalf("Import failed: %v", err)
	}

	// Verify database row counts and field integrity
	var prodCount int64
	db.Model(&domain.Product{}).Count(&prodCount)
	if prodCount != 1 {
		t.Errorf("Product count = %d, want 1", prodCount)
	}
	var importedProd domain.Product
	if err := db.First(&importedProd, "id = ?", "prod-imp-1").Error; err != nil {
		t.Fatalf("Failed to query imported product: %v", err)
	}
	if importedProd.Barcode != "BC-USB-99" || importedProd.Stock != 100 {
		t.Errorf("Product fields mismatch: %+v", importedProd)
	}

	var saleCount int64
	db.Model(&domain.Sale{}).Count(&saleCount)
	if saleCount != 1 {
		t.Errorf("Sale count = %d, want 1", saleCount)
	}
	var importedSale domain.Sale
	if err := db.Preload("Items").First(&importedSale, "id = ?", "sale-imp-1").Error; err != nil {
		t.Fatalf("Failed to query imported sale: %v", err)
	}
	if len(importedSale.Items) != 1 || importedSale.Items[0].SaleID != "sale-imp-1" {
		t.Errorf("Sale items integrity mismatch: %+v", importedSale.Items)
	}

	var custCount int64
	db.Model(&domain.Customer{}).Count(&custCount)
	if custCount != 1 {
		t.Errorf("Customer count = %d, want 1", custCount)
	}
	var importedCust domain.Customer
	if err := db.First(&importedCust, "id = ?", "cust-imp-1").Error; err != nil {
		t.Fatalf("Failed to query imported customer: %v", err)
	}
	if importedCust.Debt != domain.NewAmount(120) {
		t.Errorf("Customer debt = %s, want 120.00", importedCust.Debt)
	}

	var po domain.PurchaseOrder
	if err := db.Preload("Items").First(&po, "id = ?", "po-imp-1").Error; err != nil {
		t.Fatalf("Failed to query imported purchase order: %v", err)
	}
	if len(po.Items) != 1 || po.Items[0].OrderID != "po-imp-1" {
		t.Errorf("Purchase order items integrity mismatch: %+v", po.Items)
	}

	var prefs domain.AppPreferences
	if err := db.First(&prefs, 1).Error; err != nil {
		t.Fatalf("Failed to query imported preferences: %v", err)
	}
	if prefs.StoreName != "Imported Store" {
		t.Errorf("Preferences StoreName = %q, want 'Imported Store'", prefs.StoreName)
	}
}

func TestBackupRepo_Reset_ClearsAllTables(t *testing.T) {
	t.Setenv("APPDATA", t.TempDir())

	db, err := InitDB()
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	sqlDB1, _ := db.DB()
	defer func() {
		if sqlDB1 != nil {
			_ = sqlDB1.Close()
		}
		_ = CloseDB()
	}()

	repo := NewBackupRepository(db)

	// Seed custom data
	prod := &domain.Product{ID: "p-reset-1", Name: "Reset Prod", Price: domain.NewAmount(25), Barcode: "BC-RESET-1"}
	if err := db.Create(prod).Error; err != nil {
		t.Fatalf("Failed to create product: %v", err)
	}
	cust := &domain.Customer{ID: "c-reset-1", Name: "Reset Customer", Phone: "0799999999"}
	if err := db.Create(cust).Error; err != nil {
		t.Fatalf("Failed to create customer: %v", err)
	}

	var preCount int64
	db.Model(&domain.Product{}).Count(&preCount)
	if preCount == 0 {
		t.Fatal("Expected product count > 0 before reset")
	}

	// Call Reset()
	if err := repo.Reset(); err != nil {
		t.Fatalf("Reset returned error: %v", err)
	}

	activeDB := GetDB()
	if activeDB == nil {
		t.Fatal("activeDB should not be nil after Reset")
	}

	// Verify tables are cleared
	var postProdCount, postCustCount int64
	if err := activeDB.Model(&domain.Product{}).Count(&postProdCount).Error; err != nil {
		t.Fatalf("Failed to count products after reset: %v", err)
	}
	if postProdCount != 0 {
		t.Errorf("Products count after reset = %d, want 0", postProdCount)
	}

	if err := activeDB.Model(&domain.Customer{}).Count(&postCustCount).Error; err != nil {
		t.Fatalf("Failed to count customers after reset: %v", err)
	}
	if postCustCount != 0 {
		t.Errorf("Customers count after reset = %d, want 0", postCustCount)
	}

	// Verify schema is intact by inserting a new record
	newProd := &domain.Product{ID: "p-after-reset", Name: "Fresh Product", Price: domain.NewAmount(10), Barcode: "BC-FRESH-1"}
	if err := activeDB.Create(newProd).Error; err != nil {
		t.Errorf("Failed to insert into table after reset (schema broken): %v", err)
	}

	// Verify default preferences were re-seeded
	var defaultPrefs domain.AppPreferences
	if err := activeDB.First(&defaultPrefs).Error; err != nil {
		t.Errorf("Default preferences missing after reset: %v", err)
	}
}

func TestBackupRepo_ImportCorruptedData(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	repo := NewBackupRepository(db)

	// Corrupted export with duplicate Customer primary keys
	corruptedData := domain.DatabaseExport{
		Customers: []domain.Customer{
			{ID: "cust-dup", Name: "Customer 1", Phone: "07800000001"},
			{ID: "cust-dup", Name: "Customer 2", Phone: "07800000002"},
		},
	}

	err := repo.Import(corruptedData)
	if err == nil {
		t.Fatal("Expected error when importing corrupted duplicate primary keys, got nil")
	}

	// Corrupted export with duplicate Product primary keys
	corruptedProducts := domain.DatabaseExport{
		Products: []domain.Product{
			{ID: "prod-dup", Name: "P1", Barcode: "BC-1", Price: domain.NewAmount(10)},
			{ID: "prod-dup", Name: "P2", Barcode: "BC-2", Price: domain.NewAmount(20)},
		},
	}

	err = repo.Import(corruptedProducts)
	if err == nil {
		t.Fatal("Expected error when importing duplicate product IDs, got nil")
	}
}
