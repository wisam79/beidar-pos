package service_test

import (
	"math"
	"sync"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"

	"github.com/google/uuid"
)

// Test 1: TestSale_MultiCurrencyExchangeRate_NoRoundingDrift
func TestSale_MultiCurrencyExchangeRate_NoRoundingDrift(t *testing.T) {
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

	// Simulated exchange rate: 1 USD = 1532.5 IQD
	exchangeRate := 1532.5

	usdPrices := []float64{12.99, 5.49, 100.00, 0.99, 49.95, 3.33, 7.77, 19.99, 88.88, 2.50}

	var items []domain.SaleItem
	var calculatedSubtotalCents int64

	for i, usdPrice := range usdPrices {
		iqdFloat := usdPrice * exchangeRate
		iqdCents := int64(math.Round(iqdFloat * 100.0))
		amount := domain.Amount(iqdCents)

		p := &domain.Product{
			ID:      uuid.New().String(),
			Name:    "USD Converted Item",
			Barcode: uuid.New().String()[:8],
			Price:   amount,
			Cost:    domain.NewAmount(100),
			Stock:   100,
		}
		if err := db.Create(p).Error; err != nil {
			t.Fatalf("failed to create item %d: %v", i, err)
		}

		calculatedSubtotalCents += amount.Cents()
		items = append(items, domain.SaleItem{
			ProductID: p.ID,
			Quantity:  1,
			Price:     amount,
		})
	}

	sale := &domain.Sale{
		ID:            uuid.New().String(),
		PaymentMethod: "cash",
		Items:         items,
	}

	err := saleSvc.ProcessSale(sale)
	if err != nil {
		t.Fatalf("failed to process multi-currency sale: %v", err)
	}

	// Assert line-item sum matches processed sale subtotal with 0 lost cents
	if sale.Subtotal.Cents() != calculatedSubtotalCents {
		t.Errorf("expected subtotal cents %d, got %d (drift detected!)", calculatedSubtotalCents, sale.Subtotal.Cents())
	}
}

// Test 2: TestShift_ReopenClosedShift_Vetoed
func TestShift_ReopenClosedShift_Vetoed(t *testing.T) {
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

	// 1. Open shift
	shift, err := finSvc.OpenShift("staff-cashier", "Cashier", domain.NewAmount(100.00))
	if err != nil {
		t.Fatalf("failed to open shift: %v", err)
	}

	// 2. Close shift
	closedShift, errClose := finSvc.CloseShift(shift.ID, domain.NewAmount(100.00), "normal close")
	if errClose != nil {
		t.Fatalf("failed to close shift: %v", errClose)
	}

	if closedShift.Status != "closed" {
		t.Fatalf("expected status 'closed', got %s", closedShift.Status)
	}

	// 3. Attempt to close an ALREADY closed shift (re-close attack/mutation)
	_, errReclose := finSvc.CloseShift(shift.ID, domain.NewAmount(200.00), "re-close attempt")
	if errReclose == nil {
		t.Errorf("expected error when attempting to close an already closed shift, but got nil!")
	}

	// 4. Verify in DB that status and expected balance remain intact
	var dbShift domain.Shift
	if err := db.First(&dbShift, "id = ?", shift.ID).Error; err != nil {
		t.Fatalf("failed to reload shift: %v", err)
	}
	if dbShift.Status != "closed" {
		t.Errorf("expected DB shift status 'closed', got %s", dbShift.Status)
	}
}

// Test 3: TestCustomer_LoyaltyPointsRedemption_Boundary
func TestCustomer_LoyaltyPointsRedemption_Boundary(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	custRepo := repository.NewCustomerRepository(db)

	cust := testutil.NewCustomer(t, db, "VIP Points Customer", 0.0)
	cust.Points = 100
	if err := db.Save(cust).Error; err != nil {
		t.Fatalf("failed to update customer points: %v", err)
	}

	// Launch 5 concurrent point reduction operations (-30 points each = 150 points total, but balance is 100)
	var wg sync.WaitGroup
	var successCount int
	var mu sync.Mutex

	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := custRepo.AdjustPoints(cust.ID, -30)
			if err == nil {
				mu.Lock()
				successCount++
				mu.Unlock()
			}
		}()
	}

	wg.Wait()

	// Refresh customer from DB
	refreshed := testutil.MustRefreshCustomer(t, db, cust.ID)

	// Points must NEVER go below zero
	if refreshed.Points < 0 {
		t.Errorf("CRITICAL: customer points went below zero! Current points: %d", refreshed.Points)
	}

	t.Logf("Concurrent points redemption: initial=100, final=%d, successful operations=%d", refreshed.Points, successCount)
}
