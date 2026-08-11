package service_test

import (
	"errors"
	"strings"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
	pkgerrors "beidar-desktop/pkg/errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupFinanceEdgeTestDB(t *testing.T) (domain.FinanceService, *gorm.DB, func()) {
	t.Helper()
	db, cleanup := testutil.SetupFullDB(t)
	testutil.SeedPreferences(t, db)

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

	return financeService, db, cleanup
}

func TestEdge_OpenShift_WhileAnotherIsOpen(t *testing.T) {
	s, _, cleanup := setupFinanceEdgeTestDB(t)
	defer cleanup()

	// 1. Open first active shift
	shift1, err := s.OpenShift("staff-1", "Ahmad Cashier", domain.NewAmount(100000))
	if err != nil {
		t.Fatalf("OpenShift 1 failed: %v", err)
	}
	if shift1.Status != "open" {
		t.Errorf("Expected shift status 'open', got %q", shift1.Status)
	}

	// 2. Attempt to open another shift while first is still active -> must fail
	shift2, err := s.OpenShift("staff-2", "Ali Cashier", domain.NewAmount(50000))
	if err == nil {
		t.Fatalf("Expected OpenShift to fail when another shift is active, got shift: %+v", shift2)
	}

	if !strings.Contains(err.Error(), "يوجد شفت مفتوح بالفعل") {
		t.Errorf("Expected error to mention active shift, got: %v", err)
	}
}

func TestEdge_CloseShift_VarianceCalculation(t *testing.T) {
	s, db, cleanup := setupFinanceEdgeTestDB(t)
	defer cleanup()

	t.Run("NegativeVariance_Shortage", func(t *testing.T) {
		// Opening balance = 100,000 IQD
		shift, err := s.OpenShift("staff-1", "Ahmad Cashier", domain.NewAmount(100000))
		if err != nil {
			t.Fatalf("OpenShift failed: %v", err)
		}

		// Add cash_in 20,000 IQD
		_, err = s.AddCashMovement(shift.ID, "cash_in", "Drawer refill", "staff-1", "Ahmad Cashier", domain.NewAmount(20000))
		if err != nil {
			t.Fatalf("AddCashMovement cash_in failed: %v", err)
		}

		// Add cash_out 10,000 IQD
		_, err = s.AddCashMovement(shift.ID, "cash_out", "Office supplies", "staff-1", "Ahmad Cashier", domain.NewAmount(10000))
		if err != nil {
			t.Fatalf("AddCashMovement cash_out failed: %v", err)
		}

		// Simulate cash sales of 30,000 IQD directly on shift record
		if err := db.Model(&domain.Shift{}).Where("id = ?", shift.ID).Update("cash_sales", domain.NewAmount(30000).Cents()).Error; err != nil {
			t.Fatalf("Failed to update cash_sales: %v", err)
		}

		// Expected balance = 100,000 + 30,000 + 20,000 - 10,000 = 140,000 IQD
		// Actual counted cash = 135,000 IQD (Shortage of -5,000 IQD)
		closingCash := domain.NewAmount(135000)
		closedShift, err := s.CloseShift(shift.ID, closingCash, "End of morning shift")
		if err != nil {
			t.Fatalf("CloseShift failed: %v", err)
		}

		expectedBalance := domain.NewAmount(140000)
		if closedShift.ExpectedBalance != expectedBalance {
			t.Errorf("Expected balance wrong. Want %s, got %s", expectedBalance.String(), closedShift.ExpectedBalance.String())
		}

		expectedVariance := domain.NewAmount(-5000)
		if closedShift.Variance != expectedVariance {
			t.Errorf("Variance wrong. Want %s (shortage), got %s", expectedVariance.String(), closedShift.Variance.String())
		}

		if closedShift.Status != "closed" {
			t.Errorf("Expected shift status 'closed', got %q", closedShift.Status)
		}
		if closedShift.CloseTime <= 0 {
			t.Errorf("Expected positive CloseTime timestamp, got %d", closedShift.CloseTime)
		}
	})

	t.Run("PositiveVariance_Overage", func(t *testing.T) {
		// Opening balance = 50,000 IQD
		shift, err := s.OpenShift("staff-2", "Sarah Cashier", domain.NewAmount(50000))
		if err != nil {
			t.Fatalf("OpenShift failed: %v", err)
		}

		// Add cash_in 10,000 IQD
		_, err = s.AddCashMovement(shift.ID, "cash_in", "Change refill", "staff-2", "Sarah Cashier", domain.NewAmount(10000))
		if err != nil {
			t.Fatalf("AddCashMovement cash_in failed: %v", err)
		}

		// Expected balance = 50,000 + 10,000 = 60,000 IQD
		// Actual counted cash = 65,000 IQD (Overage of +5,000 IQD)
		closingCash := domain.NewAmount(65000)
		closedShift, err := s.CloseShift(shift.ID, closingCash, "End of evening shift")
		if err != nil {
			t.Fatalf("CloseShift failed: %v", err)
		}

		expectedBalance := domain.NewAmount(60000)
		if closedShift.ExpectedBalance != expectedBalance {
			t.Errorf("Expected balance wrong. Want %s, got %s", expectedBalance.String(), closedShift.ExpectedBalance.String())
		}

		expectedVariance := domain.NewAmount(5000)
		if closedShift.Variance != expectedVariance {
			t.Errorf("Variance wrong. Want +%s (overage), got %s", expectedVariance.String(), closedShift.Variance.String())
		}
	})
}

func TestEdge_AddCashMovement_ToClosedShift(t *testing.T) {
	s, _, cleanup := setupFinanceEdgeTestDB(t)
	defer cleanup()

	// 1. Open and immediately close shift
	shift, err := s.OpenShift("staff-1", "Ahmad Cashier", domain.NewAmount(50000))
	if err != nil {
		t.Fatalf("OpenShift failed: %v", err)
	}

	_, err = s.CloseShift(shift.ID, domain.NewAmount(50000), "Closed for the day")
	if err != nil {
		t.Fatalf("CloseShift failed: %v", err)
	}

	// 2. Attempt to add cash movement to closed shift -> must be rejected
	move, err := s.AddCashMovement(shift.ID, "cash_in", "Late deposit", "staff-1", "Ahmad Cashier", domain.NewAmount(10000))
	if err == nil {
		t.Fatalf("Expected AddCashMovement to fail for closed shift, got movement: %+v", move)
	}

	if !strings.Contains(err.Error(), "لا يمكن إضافة حركة لشفت مغلق") {
		t.Errorf("Expected error to mention closed shift, got: %v", err)
	}

	// 3. Attempt to add cash movement to non-existent shift -> must be rejected
	_, err = s.AddCashMovement("non-existent-shift-id", "cash_out", "Random", "staff-1", "Ahmad Cashier", domain.NewAmount(5000))
	if err == nil {
		t.Fatal("Expected AddCashMovement to fail for non-existent shift")
	}
	if !strings.Contains(err.Error(), "الشفت غير موجود") {
		t.Errorf("Expected error 'الشفت غير موجود', got: %v", err)
	}
}

func TestEdge_ReceivePurchaseOrder_PartialReceive(t *testing.T) {
	s, db, cleanup := setupFinanceEdgeTestDB(t)
	defer cleanup()

	// Setup supplier & product
	supplier := domain.Supplier{
		ID:   uuid.New().String(),
		Name: "Al-Baraka Wholesale",
	}
	if err := db.Create(&supplier).Error; err != nil {
		t.Fatalf("Failed to create supplier: %v", err)
	}

	product := domain.Product{
		ID:      uuid.New().String(),
		Name:    "Wireless Mouse",
		Barcode: "6900112233",
		Price:   domain.NewAmount(15000),
		Cost:    domain.NewAmount(10000),
		Stock:   10,
	}
	if err := db.Create(&product).Error; err != nil {
		t.Fatalf("Failed to create product: %v", err)
	}

	// Create purchase order for 5 items
	po := domain.PurchaseOrder{
		SupplierID: supplier.ID,
		Items: []domain.PurchaseOrderItem{
			{
				ProductID: product.ID,
				Quantity:  5,
				UnitCost:  domain.NewAmount(10000),
			},
		},
	}

	createdPO, err := s.CreatePurchaseOrder(po)
	if err != nil {
		t.Fatalf("CreatePurchaseOrder failed: %v", err)
	}
	if createdPO.Status != domain.POStatusPending {
		t.Fatalf("Expected PO status pending, got %q", createdPO.Status)
	}

	// Partially receive 3 items out of 5
	receiveItems := []domain.PurchaseOrderItem{
		{
			ProductID:   product.ID,
			ReceivedQty: 3,
		},
	}
	if err := s.ReceivePurchaseOrder(createdPO.ID, receiveItems); err != nil {
		t.Fatalf("ReceivePurchaseOrder failed: %v", err)
	}

	// 1. Verify product stock increased by 3 (from 10 to 13)
	var updatedProd domain.Product
	if err := db.First(&updatedProd, "id = ?", product.ID).Error; err != nil {
		t.Fatalf("Failed to fetch product: %v", err)
	}
	if updatedProd.Stock != 13 {
		t.Errorf("Expected product stock 13, got %.2f", updatedProd.Stock)
	}

	// 2. Verify PO status is POStatusPartial
	fetchedPO, err := s.GetPurchaseOrder(createdPO.ID)
	if err != nil {
		t.Fatalf("GetPurchaseOrder failed: %v", err)
	}
	if fetchedPO.Status != domain.POStatusPartial {
		t.Errorf("Expected PO status %q, got %q", domain.POStatusPartial, fetchedPO.Status)
	}

	// 3. Verify PO item received qty is 3
	if len(fetchedPO.Items) != 1 {
		t.Fatalf("Expected 1 PO item, got %d", len(fetchedPO.Items))
	}
	if fetchedPO.Items[0].ReceivedQty != 3 {
		t.Errorf("Expected ReceivedQty 3, got %.2f", fetchedPO.Items[0].ReceivedQty)
	}

	// 4. Verify StockMovement record was created
	var movements []domain.StockMovement
	if err := db.Where("product_id = ?", product.ID).Find(&movements).Error; err != nil {
		t.Fatalf("Failed to fetch stock movements: %v", err)
	}
	if len(movements) != 1 {
		t.Fatalf("Expected 1 stock movement, got %d", len(movements))
	}
	if movements[0].Type != "restock" || movements[0].Qty != 3 {
		t.Errorf("Stock movement mismatch: Type=%s, Qty=%.2f", movements[0].Type, movements[0].Qty)
	}
}

func TestEdge_ReceivePurchaseOrder_OverReceive(t *testing.T) {
	s, db, cleanup := setupFinanceEdgeTestDB(t)
	defer cleanup()

	supplier := domain.Supplier{
		ID:   uuid.New().String(),
		Name: "Tech Supplies Co",
	}
	if err := db.Create(&supplier).Error; err != nil {
		t.Fatalf("Failed to create supplier: %v", err)
	}

	product := domain.Product{
		ID:      uuid.New().String(),
		Name:    "USB-C Hub",
		Barcode: "5544332211",
		Price:   domain.NewAmount(25000),
		Cost:    domain.NewAmount(18000),
		Stock:   10,
	}
	if err := db.Create(&product).Error; err != nil {
		t.Fatalf("Failed to create product: %v", err)
	}

	// Purchase order for 5 units
	po := domain.PurchaseOrder{
		SupplierID: supplier.ID,
		Items: []domain.PurchaseOrderItem{
			{
				ProductID: product.ID,
				Quantity:  5,
				UnitCost:  domain.NewAmount(18000),
			},
		},
	}

	createdPO, err := s.CreatePurchaseOrder(po)
	if err != nil {
		t.Fatalf("CreatePurchaseOrder failed: %v", err)
	}

	// Attempt to receive 12 units (more than 5 ordered)
	receiveItems := []domain.PurchaseOrderItem{
		{
			ProductID:   product.ID,
			ReceivedQty: 12,
		},
	}
	if err := s.ReceivePurchaseOrder(createdPO.ID, receiveItems); err != nil {
		t.Fatalf("ReceivePurchaseOrder failed: %v", err)
	}

	// 1. Stock must increase only by remaining ordered quantity (5), not 12
	var updatedProd domain.Product
	if err := db.First(&updatedProd, "id = ?", product.ID).Error; err != nil {
		t.Fatalf("Failed to fetch product: %v", err)
	}
	if updatedProd.Stock != 15 {
		t.Errorf("Expected stock 15 (10 + 5 capped), got %.2f", updatedProd.Stock)
	}

	// 2. PO status must be received and ReceivedQty capped at 5
	fetchedPO, err := s.GetPurchaseOrder(createdPO.ID)
	if err != nil {
		t.Fatalf("GetPurchaseOrder failed: %v", err)
	}
	if fetchedPO.Status != domain.POStatusReceived {
		t.Errorf("Expected PO status %q, got %q", domain.POStatusReceived, fetchedPO.Status)
	}
	if fetchedPO.Items[0].ReceivedQty != 5 {
		t.Errorf("Expected ReceivedQty capped at 5, got %.2f", fetchedPO.Items[0].ReceivedQty)
	}

	// 3. Subsequent receive on already received PO must fail
	err = s.ReceivePurchaseOrder(createdPO.ID, []domain.PurchaseOrderItem{
		{
			ProductID:   product.ID,
			ReceivedQty: 1,
		},
	})
	if err == nil {
		t.Fatal("Expected receive on fully received PO to fail")
	}
	if !strings.Contains(err.Error(), "تم استلام هذا الأمر بالكامل مسبقاً") {
		t.Errorf("Expected error 'تم استلام هذا الأمر بالكامل مسبقاً', got: %v", err)
	}
}

func TestEdge_PayPurchaseOrder_ExceedsTotalAmount(t *testing.T) {
	s, db, cleanup := setupFinanceEdgeTestDB(t)
	defer cleanup()

	supplier := domain.Supplier{
		ID:      uuid.New().String(),
		Name:    "Hardware Distributor",
		Balance: domain.Zero(),
	}
	if err := db.Create(&supplier).Error; err != nil {
		t.Fatalf("Failed to create supplier: %v", err)
	}

	product := domain.Product{
		ID:      uuid.New().String(),
		Name:    "Gaming Monitor",
		Barcode: "7788990011",
		Price:   domain.NewAmount(200000),
		Cost:    domain.NewAmount(150000),
		Stock:   5,
	}
	if err := db.Create(&product).Error; err != nil {
		t.Fatalf("Failed to create product: %v", err)
	}

	// Create PO with TotalAmount = 2 * 150,000 = 300,000 IQD
	po := domain.PurchaseOrder{
		SupplierID: supplier.ID,
		Items: []domain.PurchaseOrderItem{
			{
				ProductID: product.ID,
				Quantity:  2,
				UnitCost:  domain.NewAmount(150000),
			},
		},
	}

	createdPO, err := s.CreatePurchaseOrder(po)
	if err != nil {
		t.Fatalf("CreatePurchaseOrder failed: %v", err)
	}
	if createdPO.TotalAmount != domain.NewAmount(300000) {
		t.Fatalf("Expected TotalAmount 300000, got %s", createdPO.TotalAmount.String())
	}

	// 1. Attempt paying more than total amount (350,000 > 300,000) -> must fail
	err = s.PayPurchaseOrder(createdPO.ID, domain.NewAmount(350000), "cash")
	if err == nil {
		t.Fatal("Expected payment exceeding total amount to fail")
	}
	if !strings.Contains(err.Error(), "المبلغ أكبر من المتبقي") {
		t.Errorf("Expected error 'المبلغ أكبر من المتبقي', got: %v", err)
	}

	// 2. Pay partial amount 200,000 IQD -> succeeds
	err = s.PayPurchaseOrder(createdPO.ID, domain.NewAmount(200000), "cash")
	if err != nil {
		t.Fatalf("PayPurchaseOrder partial failed: %v", err)
	}

	fetchedPO, _ := s.GetPurchaseOrder(createdPO.ID)
	if fetchedPO.PaidAmount != domain.NewAmount(200000) {
		t.Errorf("Expected PaidAmount 200000, got %s", fetchedPO.PaidAmount.String())
	}

	// 3. Attempt paying 150,000 IQD when remaining is only 100,000 IQD -> must fail
	err = s.PayPurchaseOrder(createdPO.ID, domain.NewAmount(150000), "cash")
	if err == nil {
		t.Fatal("Expected payment exceeding remaining amount to fail")
	}
	if !strings.Contains(err.Error(), "المبلغ أكبر من المتبقي") {
		t.Errorf("Expected error 'المبلغ أكبر من المتبقي', got: %v", err)
	}

	// 4. Pay zero or negative amount -> must fail
	err = s.PayPurchaseOrder(createdPO.ID, domain.NewAmount(0), "cash")
	if err == nil {
		t.Fatal("Expected zero payment to fail")
	}
}

func TestEdge_DeleteCategory_WithProducts_NoForce(t *testing.T) {
	s, db, cleanup := setupFinanceEdgeTestDB(t)
	defer cleanup()

	cat := domain.Category{
		Name: "Beverages",
	}
	if err := s.SaveCategory(cat); err != nil {
		t.Fatalf("SaveCategory failed: %v", err)
	}

	cats, _ := s.GetCategories()
	if len(cats) != 1 {
		t.Fatalf("Expected 1 category, got %d", len(cats))
	}
	catID := cats[0].ID

	// Create product under this category
	product := domain.Product{
		ID:       uuid.New().String(),
		Name:     "Orange Soda",
		Barcode:  "123000999",
		Price:    domain.NewAmount(1000),
		Cost:     domain.NewAmount(600),
		Category: "Beverages",
		Stock:    20,
	}
	if err := db.Create(&product).Error; err != nil {
		t.Fatalf("Failed to create product: %v", err)
	}

	// Attempt to delete category without force -> must fail with AppError CATEGORY_HAS_PRODUCTS
	err := s.DeleteCategory(catID, false)
	if err == nil {
		t.Fatal("Expected DeleteCategory without force to fail when category has products")
	}

	var appErr *pkgerrors.AppError
	if errors.As(err, &appErr) {
		if appErr.Code != "CATEGORY_HAS_PRODUCTS" {
			t.Errorf("Expected AppError code 'CATEGORY_HAS_PRODUCTS', got %q", appErr.Code)
		}
	} else {
		t.Errorf("Expected *pkgerrors.AppError, got %T: %v", err, err)
	}

	// Verify category still exists in DB
	remainingCats, _ := s.GetCategories()
	if len(remainingCats) != 1 {
		t.Errorf("Category should not have been deleted, count: %d", len(remainingCats))
	}
}

func TestEdge_DeleteCategory_WithProducts_Force(t *testing.T) {
	s, db, cleanup := setupFinanceEdgeTestDB(t)
	defer cleanup()

	cat := domain.Category{
		Name: "Stationery",
	}
	if err := s.SaveCategory(cat); err != nil {
		t.Fatalf("SaveCategory failed: %v", err)
	}

	cats, _ := s.GetCategories()
	if len(cats) != 1 {
		t.Fatalf("Expected 1 category, got %d", len(cats))
	}
	catID := cats[0].ID

	// Create products under this category
	product1 := domain.Product{
		ID:       uuid.New().String(),
		Name:     "Notebook A5",
		Barcode:  "99881122",
		Price:    domain.NewAmount(2500),
		Cost:     domain.NewAmount(1500),
		Category: "Stationery",
		Stock:    50,
	}
	product2 := domain.Product{
		ID:       uuid.New().String(),
		Name:     "Gel Pen Blue",
		Barcode:  "99881133",
		Price:    domain.NewAmount(500),
		Cost:     domain.NewAmount(250),
		Category: "Stationery",
		Stock:    100,
	}
	if err := db.Create(&product1).Error; err != nil {
		t.Fatalf("Failed to create product 1: %v", err)
	}
	if err := db.Create(&product2).Error; err != nil {
		t.Fatalf("Failed to create product 2: %v", err)
	}

	// Delete category with force = true
	if err := s.DeleteCategory(catID, true); err != nil {
		t.Fatalf("DeleteCategory with force=true failed: %v", err)
	}

	// 1. Verify category is deleted
	remainingCats, _ := s.GetCategories()
	if len(remainingCats) != 0 {
		t.Errorf("Expected 0 categories after force delete, got %d", len(remainingCats))
	}

	// 2. Verify products were reassigned to 'Uncategorized'
	var p1, p2 domain.Product
	if err := db.First(&p1, "id = ?", product1.ID).Error; err != nil {
		t.Fatalf("Failed to reload product 1: %v", err)
	}
	if p1.Category != "Uncategorized" {
		t.Errorf("Expected product 1 category 'Uncategorized', got %q", p1.Category)
	}

	if err := db.First(&p2, "id = ?", product2.ID).Error; err != nil {
		t.Fatalf("Failed to reload product 2: %v", err)
	}
	if p2.Category != "Uncategorized" {
		t.Errorf("Expected product 2 category 'Uncategorized', got %q", p2.Category)
	}
}
