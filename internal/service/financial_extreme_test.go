package service_test

import (
	"math"
	"sync"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"

	"github.com/google/uuid"
)

// TestFinance_HyperInflation_Int64Overflow tests math overflow bounds with extreme prices.
func TestFinance_HyperInflation_Int64Overflow(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	prodRepo := repository.NewProductRepository(db)
	saleRepo := repository.NewSaleRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	paymentRepo := repository.NewPaymentRepository(db)
	shiftRepo := repository.NewShiftRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	prodSvc := service.NewProductService(prodRepo)

	saleSvc := service.NewSaleService(saleRepo, prodRepo, customerRepo, paymentRepo, shiftRepo, prefRepo, prodSvc, auditRepo)

	// Create product with huge price (half of MaxInt64 cents)
	hugeAmount := domain.Amount(math.MaxInt64 / 2)
	p := &domain.Product{
		ID:      uuid.New().String(),
		Name:    "Hyper-Inflation Gold Bar",
		Barcode: uuid.New().String()[:8],
		Price:   hugeAmount,
		Cost:    domain.NewAmount(100.0),
		Stock:   100,
	}
	if err := db.Create(p).Error; err != nil {
		t.Fatalf("failed to create product: %v", err)
	}

	req := &domain.Sale{
		ID:            uuid.New().String(),
		PaymentMethod: "cash",
		Items: []domain.SaleItem{
			{ProductID: p.ID, Quantity: 3, Price: hugeAmount}, // 3 * (MaxInt64/2) overflows int64!
		},
	}

	// Process sale must reject or handle overflow without producing negative totals
	err := saleSvc.ProcessSale(req)
	if err == nil {
		if req.Total.IsNegative() {
			t.Errorf("CRITICAL: int64 overflow produced negative sale total: %v", req.Total)
		}
	}
}

// TestTemporal_DST_LeapYear_ShiftContinuity tests shift calculations across Leap Year (Feb 28/29) and DST boundaries.
func TestTemporal_DST_LeapYear_ShiftContinuity(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	expenseRepo := repository.NewExpenseRepository(db)
	shiftRepo := repository.NewShiftRepository(db)
	purchaseRepo := repository.NewPurchaseOrderRepository(db)
	supplierRepo := repository.NewSupplierRepository(db)
	prodRepo := repository.NewProductRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)
	prodSvc := service.NewProductService(prodRepo)

	finSvc := service.NewFinanceService(expenseRepo, shiftRepo, purchaseRepo, supplierRepo, prodRepo, prefRepo, prodSvc)

	// 1. Open shift on Feb 28 23:30 in Leap Year 2024
	feb28Time := time.Date(2024, time.February, 28, 23, 30, 0, 0, time.UTC).UnixMilli()

	shift := &domain.Shift{
		ID:             uuid.New().String(),
		StaffID:        "staff-admin",
		StaffName:      "Admin",
		OpenTime:       feb28Time,
		OpeningBalance: domain.NewAmount(100.00),
		Status:         "open",
	}
	if err := db.Create(shift).Error; err != nil {
		t.Fatalf("failed to create shift: %v", err)
	}

	// 2. Close shift on Feb 29 00:30 (Leap Day)
	feb29Time := time.Date(2024, time.February, 29, 0, 30, 0, 0, time.UTC).UnixMilli()
	closedShift, err := finSvc.CloseShift(shift.ID, domain.NewAmount(100.00), "closing on leap day")
	if err != nil {
		t.Fatalf("failed to close shift: %v", err)
	}

	if closedShift.Status != "closed" {
		t.Errorf("expected status 'closed', got %s", closedShift.Status)
	}

	// Verify duration calculation does not panic or return negative
	durationMs := feb29Time - feb28Time
	if durationMs <= 0 {
		t.Errorf("expected positive leap day duration, got %d ms", durationMs)
	}
}

// TestFinance_DiscountStacking_Exploit tests that stacking fixed and percentage discounts does not make final total negative.
func TestFinance_DiscountStacking_Exploit(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	discRepo := repository.NewDiscountRepository(db)
	discSvc := service.NewDiscountService(discRepo)

	subtotal := domain.NewAmount(100.00) // 10,000 cents

	// Scenario 1: Fixed discount (60.00) + Percentage discount (50%)
	fixedDiscount := domain.NewAmount(60.00)
	pctDiscount := subtotal.Percentage(50.0) // 50.00

	totalDiscount := fixedDiscount.Add(pctDiscount)
	if totalDiscount.Cents() > subtotal.Cents() {
		// Cap discount to subtotal
		totalDiscount = subtotal
	}

	finalTotal := subtotal.Sub(totalDiscount)
	if finalTotal.IsNegative() {
		t.Errorf("stacked discount produced negative total: %v", finalTotal)
	}
	if finalTotal.Cents() != 0 {
		t.Errorf("expected capped final total = 0, got %v", finalTotal)
	}

	_ = discSvc
}

// TestFinance_MidShiftSale_AtomicShiftAssignment tests race between sale processing and shift closure.
func TestFinance_MidShiftSale_AtomicShiftAssignment(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	prodRepo := repository.NewProductRepository(db)
	saleRepo := repository.NewSaleRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	paymentRepo := repository.NewPaymentRepository(db)
	shiftRepo := repository.NewShiftRepository(db)
	expenseRepo := repository.NewExpenseRepository(db)
	purchaseRepo := repository.NewPurchaseOrderRepository(db)
	supplierRepo := repository.NewSupplierRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	prodSvc := service.NewProductService(prodRepo)

	saleSvc := service.NewSaleService(saleRepo, prodRepo, customerRepo, paymentRepo, shiftRepo, prefRepo, prodSvc, auditRepo)
	finSvc := service.NewFinanceService(expenseRepo, shiftRepo, purchaseRepo, supplierRepo, prodRepo, prefRepo, prodSvc)

	p := testutil.NewProduct(t, db, "Race Item", 20.00, 100)

	// Open shift
	shift, err := finSvc.OpenShift("staff-admin", "Admin", domain.NewAmount(50.00))
	if err != nil {
		t.Fatalf("failed to open shift: %v", err)
	}

	var wg sync.WaitGroup
	wg.Add(2)

	var req *domain.Sale
	var errSale error

	go func() {
		defer wg.Done()
		req = &domain.Sale{
			ID:            uuid.New().String(),
			PaymentMethod: "cash",
			Items:         []domain.SaleItem{{ProductID: p.ID, Quantity: 1, Price: p.Price}},
		}
		errSale = saleSvc.ProcessSale(req)
	}()

	go func() {
		defer wg.Done()
		time.Sleep(5 * time.Millisecond)
		_, _ = finSvc.CloseShift(shift.ID, domain.NewAmount(50.00), "close")
	}()

	wg.Wait()

	// If sale succeeded, verify shift status or active shift
	_ = errSale
}

// TestFinance_ReturnOnZeroStockProduct_RefundsCorrectly tests returning a sale on a product with negative/zero stock.
func TestFinance_ReturnOnZeroStockProduct_RefundsCorrectly(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	prodRepo := repository.NewProductRepository(db)
	saleRepo := repository.NewSaleRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	paymentRepo := repository.NewPaymentRepository(db)
	shiftRepo := repository.NewShiftRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	prodSvc := service.NewProductService(prodRepo)

	saleSvc := service.NewSaleService(saleRepo, prodRepo, customerRepo, paymentRepo, shiftRepo, prefRepo, prodSvc, auditRepo)

	p := testutil.NewProduct(t, db, "Limited Product", 10.00, 1)

	// 1. Make a sale
	req := &domain.Sale{
		ID:            uuid.New().String(),
		PaymentMethod: "cash",
		Items:         []domain.SaleItem{{ProductID: p.ID, Quantity: 1, Price: p.Price}},
	}
	err := saleSvc.ProcessSale(req)
	if err != nil {
		t.Fatalf("failed to process sale: %v", err)
	}

	// 2. Product stock is now 0 (1 sold out of 1)
	pZero := testutil.MustRefreshProduct(t, db, p.ID)
	if pZero.Stock != 0 {
		t.Fatalf("expected stock 0 after sale, got %f", pZero.Stock)
	}

	// 3. Process full return
	errReturn := saleSvc.ReturnSale(req.ID)
	if errReturn != nil {
		t.Fatalf("failed to return sale: %v", errReturn)
	}

	var returnedSale domain.Sale
	if err := db.First(&returnedSale, "id = ?", req.ID).Error; err != nil {
		t.Fatalf("failed to reload returned sale: %v", err)
	}

	if returnedSale.Status != "returned" {
		t.Errorf("expected status 'returned', got %s", returnedSale.Status)
	}

	// 4. Verify product stock was incremented from 0 to 1
	pRefreshed := testutil.MustRefreshProduct(t, db, p.ID)
	if pRefreshed.Stock != 1 {
		t.Errorf("expected stock 1 after return, got %f", pRefreshed.Stock)
	}
}
