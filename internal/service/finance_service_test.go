package service_test

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/pkg/logger"
	"os"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupFinanceTestDB(t *testing.T) (service.FinanceService, *gorm.DB, func()) {
	logger.InitLogger(logger.INFO, false)
	dbFileName := "test_finance_" + uuid.New().String()[:8] + ".db"
	os.Remove(dbFileName)

	db, err := gorm.Open(sqlite.Open(dbFileName), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}

	if err := db.AutoMigrate(
		&domain.Product{}, &domain.Supplier{}, &domain.Expense{}, &domain.Category{},
		&domain.StockMovement{}, &domain.AppPreferences{}, &domain.Shift{}, &domain.CashMovement{},
		&domain.PurchaseOrder{}, &domain.PurchaseOrderItem{},
	); err != nil {
		t.Fatalf("Failed to migrate test DB: %v", err)
	}

	db.Create(&domain.AppPreferences{ID: 1, StoreName: "Test Store", Currency: "IQD"})

	prefRepo := repository.NewPreferencesRepository(db)
	expenseRepo := repository.NewExpenseRepository(db)
	shiftRepo := repository.NewShiftRepository(db)
	purchaseRepo := repository.NewPurchaseOrderRepository(db)
	supplierRepo := repository.NewSupplierRepository(db)
	productRepo := repository.NewProductRepository(db)

	productService := service.NewProductService(productRepo)
	financeService := service.NewFinanceService(
		expenseRepo, shiftRepo, purchaseRepo, supplierRepo, productRepo, prefRepo, productService,
	)

	return financeService, db, func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
		os.Remove(dbFileName)
	}
}

func TestExpenseCRUD(t *testing.T) {
	s, _, cleanup := setupFinanceTestDB(t)
	defer cleanup()

	expense := domain.Expense{
		Title:    "Office Rent",
		Amount:   domain.NewAmount(500000),
		Date:     time.Now().Format("2006-01-02"),
		Category: "Rent",
	}

	if err := s.SaveExpense(expense); err != nil {
		t.Fatalf("SaveExpense failed: %v", err)
	}

	expenses, err := s.GetExpenses()
	if err != nil {
		t.Fatalf("GetExpenses failed: %v", err)
	}
	if len(expenses) != 1 {
		t.Errorf("Expected 1 expense, got %d", len(expenses))
	}
	if expenses[0].Title != "Office Rent" {
		t.Errorf("Expected Title 'Office Rent', got '%s'", expenses[0].Title)
	}

	if err := s.DeleteExpense(expenses[0].ID); err != nil {
		t.Fatalf("DeleteExpense failed: %v", err)
	}

	expenses, _ = s.GetExpenses()
	if len(expenses) != 0 {
		t.Errorf("Expected 0 expenses after deletion, got %d", len(expenses))
	}
}

func TestCategoryCascade(t *testing.T) {
	s, db, cleanup := setupFinanceTestDB(t)
	defer cleanup()

	cat := domain.Category{
		Name: "Electronics",
	}
	if err := s.SaveCategory(cat); err != nil {
		t.Fatalf("SaveCategory failed: %v", err)
	}

	cats, _ := s.GetCategories()
	if len(cats) != 1 {
		t.Fatalf("Expected 1 category, got %d", len(cats))
	}
	catID := cats[0].ID

	product := domain.Product{
		ID:       uuid.New().String(),
		Name:     "Test TV",
		Barcode:  "12345678",
		Price:    domain.NewAmount(300000),
		Category: "Electronics",
		Stock:    5,
	}
	db.Create(&product)

	err := s.DeleteCategory(catID, false)
	if err == nil {
		t.Error("Expected error deleting category with products without force")
	}

	err = s.DeleteCategory(catID, true)
	if err != nil {
		t.Fatalf("DeleteCategory with force=true failed: %v", err)
	}

	var p domain.Product
	db.First(&p, "id = ?", product.ID)
	if p.Category != "Uncategorized" {
		t.Errorf("Expected category 'Uncategorized', got '%s'", p.Category)
	}
}

func TestShiftManagement(t *testing.T) {
	s, _, cleanup := setupFinanceTestDB(t)
	defer cleanup()

	shift, err := s.OpenShift("staff-1", "Ahmad", domain.NewAmount(150000))
	if err != nil {
		t.Fatalf("OpenShift failed: %v", err)
	}

	if shift.OpeningBalance != domain.NewAmount(150000) {
		t.Errorf("OpeningBalance wrong, got %s", shift.OpeningBalance.String())
	}

	_, err = s.AddCashMovement(shift.ID, "cash_in", "Refill change", "staff-1", "Ahmad", domain.NewAmount(50000))
	if err != nil {
		t.Fatalf("AddCashMovement failed: %v", err)
	}

	_, err = s.AddCashMovement(shift.ID, "cash_out", "Coffee", "staff-1", "Ahmad", domain.NewAmount(10000))
	if err != nil {
		t.Fatalf("AddCashMovement failed: %v", err)
	}

	activeShift, err := s.GetActiveShift()
	if err != nil {
		t.Fatalf("GetActiveShift failed: %v", err)
	}
	expected := domain.NewAmount(190000)
	if activeShift.ExpectedBalance != expected {
		t.Errorf("Expected balance wrong. Got %s, want %s", activeShift.ExpectedBalance.String(), expected.String())
	}

	closedShift, err := s.CloseShift(shift.ID, domain.NewAmount(185000), "Closed on time")
	if err != nil {
		t.Fatalf("CloseShift failed: %v", err)
	}

	if closedShift.Status != "closed" {
		t.Errorf("Expected status 'closed', got '%s'", closedShift.Status)
	}
	expectedVariance := domain.NewAmount(-5000)
	if closedShift.Variance != expectedVariance {
		t.Errorf("Expected variance %s, got %s", expectedVariance.String(), closedShift.Variance.String())
	}
}

func TestPurchaseOrderFlow(t *testing.T) {
	s, db, cleanup := setupFinanceTestDB(t)
	defer cleanup()

	supplier := domain.Supplier{
		ID:      uuid.New().String(),
		Name:    "Global Supplier",
		Balance: domain.Zero(),
	}
	db.Create(&supplier)

	product := domain.Product{
		ID:      uuid.New().String(),
		Name:    "Keyboard",
		Barcode: "998877",
		Price:   domain.NewAmount(15000),
		Cost:    domain.NewAmount(10000),
		Stock:   10,
	}
	db.Create(&product)

	po := domain.PurchaseOrder{
		SupplierID: supplier.ID,
		Items: []domain.PurchaseOrderItem{
			{
				ProductID: product.ID,
				Quantity:  20,
				UnitCost:  domain.NewAmount(10000),
			},
		},
	}

	createdPO, err := s.CreatePurchaseOrder(po)
	if err != nil {
		t.Fatalf("CreatePurchaseOrder failed: %v", err)
	}

	if createdPO.TotalAmount != domain.NewAmount(200000) {
		t.Errorf("PO TotalAmount wrong. Got %s, want 200000.00", createdPO.TotalAmount.String())
	}
	if createdPO.Status != domain.POStatusPending {
		t.Errorf("Expected status pending, got '%s'", createdPO.Status)
	}

	receiveItems := []domain.PurchaseOrderItem{
		{
			ProductID:   product.ID,
			ReceivedQty: 15,
		},
	}
	err = s.ReceivePurchaseOrder(createdPO.ID, receiveItems)
	if err != nil {
		t.Fatalf("ReceivePurchaseOrder failed: %v", err)
	}

	var p domain.Product
	db.First(&p, "id = ?", product.ID)
	if p.Stock != 25 {
		t.Errorf("Expected stock 25, got %.2f", p.Stock)
	}

	fetchedPO, _ := s.GetPurchaseOrder(createdPO.ID)
	if fetchedPO.Status != domain.POStatusPartial {
		t.Errorf("Expected status partial, got '%s'", fetchedPO.Status)
	}

	err = s.PayPurchaseOrder(createdPO.ID, domain.NewAmount(100000), "cash")
	if err != nil {
		t.Fatalf("PayPurchaseOrder failed: %v", err)
	}

	var sup domain.Supplier
	db.First(&sup, "id = ?", supplier.ID)
	if sup.Balance != domain.NewAmount(-100000) {
		t.Errorf("Expected supplier balance -100000, got %s", sup.Balance.String())
	}
}

func TestPurchaseOrder_CancelAndStats(t *testing.T) {
	s, db, cleanup := setupFinanceTestDB(t)
	defer cleanup()

	supplier := domain.Supplier{
		ID:      uuid.New().String(),
		Name:    "Global Supplier",
		Balance: domain.Zero(),
	}
	db.Create(&supplier)

	product := domain.Product{
		ID:      uuid.New().String(),
		Name:    "Keyboard",
		Barcode: "998877",
		Price:   domain.NewAmount(15000),
		Cost:    domain.NewAmount(10000),
		Stock:   10,
	}
	db.Create(&product)

	po := domain.PurchaseOrder{
		SupplierID: supplier.ID,
		Items: []domain.PurchaseOrderItem{
			{
				ProductID: product.ID,
				Quantity:  20,
				UnitCost:  domain.NewAmount(10000),
			},
		},
	}

	createdPO, err := s.CreatePurchaseOrder(po)
	if err != nil {
		t.Fatalf("CreatePurchaseOrder failed: %v", err)
	}

	// 1. Get purchase order stats
	stats, err := s.GetPurchaseOrderStats()
	if err != nil {
		t.Errorf("GetPurchaseOrderStats failed: %v", err)
	}
	if stats == nil {
		t.Errorf("Expected non-nil stats")
	}

	// 2. Try to cancel non-existent PO
	err = s.CancelPurchaseOrder("non-existent-id")
	if err == nil {
		t.Error("Expected error canceling non-existent PO")
	}

	// 3. Cancel pending PO
	err = s.CancelPurchaseOrder(createdPO.ID)
	if err != nil {
		t.Errorf("CancelPurchaseOrder failed: %v", err)
	}

	cancelledPO, err := s.GetPurchaseOrder(createdPO.ID)
	if err != nil {
		t.Fatalf("GetPurchaseOrder failed: %v", err)
	}
	if cancelledPO.Status != domain.POStatusCancelled {
		t.Errorf("Expected status cancelled, got %s", cancelledPO.Status)
	}

	// 4. Try to receive a cancelled PO
	receiveItems := []domain.PurchaseOrderItem{
		{
			ProductID:   product.ID,
			ReceivedQty: 10,
		},
	}
	err = s.ReceivePurchaseOrder(createdPO.ID, receiveItems)
	if err == nil {
		t.Error("Expected error receiving cancelled PO")
	}

	// 5. Try to cancel a received PO
	po2 := domain.PurchaseOrder{
		SupplierID: supplier.ID,
		Items: []domain.PurchaseOrderItem{
			{
				ProductID: product.ID,
				Quantity:  10,
				UnitCost:  domain.NewAmount(10000),
			},
		},
	}
	createdPO2, err := s.CreatePurchaseOrder(po2)
	if err != nil {
		t.Fatalf("CreatePurchaseOrder failed: %v", err)
	}

	err = s.ReceivePurchaseOrder(createdPO2.ID, []domain.PurchaseOrderItem{
		{
			ProductID:   product.ID,
			ReceivedQty: 10,
		},
	})
	if err != nil {
		t.Fatalf("ReceivePurchaseOrder failed: %v", err)
	}

	err = s.CancelPurchaseOrder(createdPO2.ID)
	if err == nil {
		t.Error("Expected error canceling fully received PO")
	}

	// 6. Try to receive an already received PO
	err = s.ReceivePurchaseOrder(createdPO2.ID, []domain.PurchaseOrderItem{
		{
			ProductID:   product.ID,
			ReceivedQty: 5,
		},
	})
	if err == nil {
		t.Error("Expected error receiving already received PO")
	}
}