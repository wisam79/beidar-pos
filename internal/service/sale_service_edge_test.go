package service_test

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
	"beidar-desktop/pkg/auth"
	pkgerrors "beidar-desktop/pkg/errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupSaleEdgeTestDB(t *testing.T) (service.SaleService, *gorm.DB, func()) {
	t.Helper()
	db, cleanup := testutil.SetupFullDB(t)
	testutil.SeedPreferences(t, db)

	prefRepo := repository.NewPreferencesRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	productRepo := repository.NewProductRepository(db)
	shiftRepo := repository.NewShiftRepository(db)
	saleRepo := repository.NewSaleRepository(db)
	paymentRepo := repository.NewPaymentRepository(db)
	auditRepo := repository.NewAuditRepository(db)

	productService := service.NewProductService(productRepo)
	saleService := service.NewSaleService(saleRepo, productRepo, customerRepo, paymentRepo, shiftRepo, prefRepo, productService, auditRepo)

	return saleService, db, cleanup
}

// TestEdge_ProcessSale_ConcurrentStockDepletion tests 2+ goroutines selling the last available
// unit of a product, ensuring exactly one succeeds while others fail with insufficient stock.
func TestEdge_ProcessSale_ConcurrentStockDepletion(t *testing.T) {
	saleService, db, cleanup := setupSaleEdgeTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Limited Item", 100.0, 1.0)
	customer := testutil.NewCustomer(t, db, "Buyer", 0)

	const goroutines = 5
	var wg sync.WaitGroup
	var successCount int64
	var failCount int64

	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			sale := domain.Sale{
				ID:            uuid.New().String(),
				CustomerID:    customer.ID,
				CustomerName:  customer.Name,
				PaymentMethod: "cash",
				Items: []domain.SaleItem{
					{
						ProductID: product.ID,
						Name:      product.Name,
						Quantity:  1.0,
						Price:     product.Price,
					},
				},
			}
			err := saleService.ProcessSale(&sale)
			if err == nil {
				atomic.AddInt64(&successCount, 1)
			} else {
				atomic.AddInt64(&failCount, 1)
			}
		}()
	}
	wg.Wait()

	if successCount != 1 {
		t.Fatalf("Expected exactly 1 success, got %d", successCount)
	}
	if failCount != goroutines-1 {
		t.Fatalf("Expected %d failures, got %d", goroutines-1, failCount)
	}

	p := testutil.MustRefreshProduct(t, db, product.ID)
	if p.Stock != 0 {
		t.Fatalf("Expected product stock to be 0, got %f", p.Stock)
	}
}

// TestEdge_ProcessSale_SplitPayment_DebtAccuracy tests that a split payment (cash + credit)
// correctly adds only the credit portion to customer debt and registers both payments.
func TestEdge_ProcessSale_SplitPayment_DebtAccuracy(t *testing.T) {
	saleService, db, cleanup := setupSaleEdgeTestDB(t)
	defer cleanup()

	customer := testutil.NewCustomer(t, db, "Split Customer", 50.0) // initial debt 50.0 (5000 cents)
	product := testutil.NewProduct(t, db, "Split Product", 100.0, 10.0)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		PaymentMethod: "split",
		SplitDetails: map[string]domain.Amount{
			"cash":   domain.NewAmount(60), // 60.00
			"credit": domain.NewAmount(40), // 40.00
		},
		Items: []domain.SaleItem{
			{
				ProductID: product.ID,
				Name:      product.Name,
				Quantity:  1.0,
				Price:     product.Price,
			},
		},
	}

	err := saleService.ProcessSale(&sale)
	if err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	c := testutil.MustRefreshCustomer(t, db, customer.ID)
	expectedDebt := domain.NewAmount(50 + 40) // 90.00 (9000 cents)
	if c.Debt != expectedDebt {
		t.Fatalf("Expected customer debt %s, got %s", expectedDebt.String(), c.Debt.String())
	}
	if c.TotalPurchases != domain.NewAmount(100) {
		t.Fatalf("Expected total purchases 100, got %s", c.TotalPurchases.String())
	}

	var payments []domain.Payment
	if err := db.Where("sale_id = ?", sale.ID).Find(&payments).Error; err != nil {
		t.Fatalf("Failed to fetch payments: %v", err)
	}
	if len(payments) != 2 {
		t.Fatalf("Expected 2 payments, got %d", len(payments))
	}
	var totalCash, totalCredit domain.Amount
	for _, p := range payments {
		if p.Method == "cash" {
			totalCash = totalCash.Add(p.Amount)
		} else if p.Method == "credit" {
			totalCredit = totalCredit.Add(p.Amount)
		}
	}
	if totalCash != domain.NewAmount(60) {
		t.Errorf("Expected cash payment 60, got %s", totalCash.String())
	}
	if totalCredit != domain.NewAmount(40) {
		t.Errorf("Expected credit payment 40, got %s", totalCredit.String())
	}
}

// TestEdge_ProcessSale_VATCalculation_ComplexItems tests a multi-item sale with different prices,
// verifying precise VAT calculation without floating-point errors.
func TestEdge_ProcessSale_VATCalculation_ComplexItems(t *testing.T) {
	saleService, db, cleanup := setupSaleEdgeTestDB(t)
	defer cleanup()

	// Update preferences with 15% VAT
	if err := db.Model(&domain.AppPreferences{}).Where("id = 1").Update("tax_rate", 15.0).Error; err != nil {
		t.Fatalf("Failed to set tax rate: %v", err)
	}

	customer := testutil.NewCustomer(t, db, "VAT Customer", 0)
	p1 := testutil.NewProduct(t, db, "Item 1", 33.33, 10.0) // 3333 cents
	p2 := testutil.NewProduct(t, db, "Item 2", 12.75, 10.0) // 1275 cents
	p3 := testutil.NewProduct(t, db, "Item 3", 99.99, 10.0) // 9999 cents

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		PaymentMethod: "cash",
		Items: []domain.SaleItem{
			{ProductID: p1.ID, Name: p1.Name, Quantity: 3.0, Price: p1.Price}, // 3333 * 3 = 9999
			{ProductID: p2.ID, Name: p2.Name, Quantity: 4.0, Price: p2.Price}, // 1275 * 4 = 5100
			{ProductID: p3.ID, Name: p3.Name, Quantity: 1.0, Price: p3.Price}, // 9999 * 1 = 9999
		},
	}

	err := saleService.ProcessSale(&sale)
	if err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Subtotal = 9999 + 5100 + 9999 = 25098 cents (250.98)
	expectedSubtotal := domain.Amount(25098)
	if sale.Subtotal != expectedSubtotal {
		t.Errorf("Expected subtotal %s (%d cents), got %s (%d cents)", expectedSubtotal.String(), expectedSubtotal.Cents(), sale.Subtotal.String(), sale.Subtotal.Cents())
	}

	// VAT = 25098 * 0.15 = 3764.7 -> rounded to 3765 cents
	expectedVAT := expectedSubtotal.Percentage(15.0)
	if sale.VAT != expectedVAT {
		t.Errorf("Expected VAT %s (%d cents), got %s (%d cents)", expectedVAT.String(), expectedVAT.Cents(), sale.VAT.String(), sale.VAT.Cents())
	}

	expectedTotal := expectedSubtotal.Add(expectedVAT)
	if sale.Total != expectedTotal {
		t.Errorf("Expected total %s (%d cents), got %s (%d cents)", expectedTotal.String(), expectedTotal.Cents(), sale.Total.String(), sale.Total.Cents())
	}
}

// TestEdge_ProcessSale_ZeroQuantityItem_Rejected tests that a sale item with 0 quantity is rejected with validation error.
func TestEdge_ProcessSale_ZeroQuantityItem_Rejected(t *testing.T) {
	saleService, db, cleanup := setupSaleEdgeTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Product Z", 10.0, 10.0)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		PaymentMethod: "cash",
		Items: []domain.SaleItem{
			{ProductID: product.ID, Name: product.Name, Quantity: 0, Price: product.Price},
		},
	}

	err := saleService.ProcessSale(&sale)
	if err == nil {
		t.Fatal("Expected error for 0 quantity item, got nil")
	}

	var appErr *pkgerrors.AppError
	if errors.As(err, &appErr) {
		if appErr.Code != "SALES_INVALID_QUANTITY" {
			t.Errorf("Expected error code SALES_INVALID_QUANTITY, got %s", appErr.Code)
		}
	}
}

// TestEdge_ProcessSale_NegativePriceItem_Rejected tests that a sale item with negative price is rejected.
func TestEdge_ProcessSale_NegativePriceItem_Rejected(t *testing.T) {
	saleService, db, cleanup := setupSaleEdgeTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Normal Item", 100.0, 10.0)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		PaymentMethod: "cash",
		Items: []domain.SaleItem{
			{
				ProductID: product.ID,
				Name:      product.Name,
				Quantity:  1.0,
				Price:     domain.NewAmount(-100), // Negative price
			},
		},
	}

	err := saleService.ProcessSale(&sale)
	if err == nil {
		t.Fatal("Expected error for negative price item, got nil")
	}
}

// TestEdge_ProcessSale_InstallmentWithoutCustomer_Rejected tests that an installment sale without valid CustomerID is rejected.
func TestEdge_ProcessSale_InstallmentWithoutCustomer_Rejected(t *testing.T) {
	saleService, db, cleanup := setupSaleEdgeTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Installment Item", 100.0, 10.0)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    "", // Missing customer ID
		PaymentMethod: "installment",
		Items: []domain.SaleItem{
			{ProductID: product.ID, Name: product.Name, Quantity: 1.0, Price: product.Price},
		},
	}

	err := saleService.ProcessSale(&sale)
	if err == nil {
		t.Fatal("Expected error for installment sale without customer, got nil")
	}

	var appErr *pkgerrors.AppError
	if errors.As(err, &appErr) {
		if appErr.Code != "INVALID_PAYMENT" {
			t.Errorf("Expected error code INVALID_PAYMENT, got %s", appErr.Code)
		}
	}
}

// TestEdge_ProcessSale_DiscountExceedsTotal tests that a discount exceeding subtotal is capped/handled safely without negative total.
func TestEdge_ProcessSale_DiscountExceedsTotal(t *testing.T) {
	saleService, db, cleanup := setupSaleEdgeTestDB(t)
	defer cleanup()

	auth.Set(&domain.Staff{Role: domain.RoleAdmin}, nil)
	defer auth.Clear()

	product := testutil.NewProduct(t, db, "Discount Item", 100.0, 10.0)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		PaymentMethod: "cash",
		Discount:      domain.NewAmount(150), // Exceeds product price 100
		Items: []domain.SaleItem{
			{ProductID: product.ID, Name: product.Name, Quantity: 1.0, Price: product.Price},
		},
	}

	err := saleService.ProcessSale(&sale)
	if err == nil {
		t.Fatal("Expected error when discount exceeds total, got nil")
	}
}

// TestEdge_ReturnSale_SplitPayment_DebtReconciliation tests that full return of a split payment
// sale deducts customer debt and refunds cash correctly.
func TestEdge_ReturnSale_SplitPayment_DebtReconciliation(t *testing.T) {
	saleService, db, cleanup := setupSaleEdgeTestDB(t)
	defer cleanup()

	customer := testutil.NewCustomer(t, db, "Split Return Cust", 0)
	product := testutil.NewProduct(t, db, "Returnable Product", 100.0, 10.0)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		PaymentMethod: "split",
		SplitDetails: map[string]domain.Amount{
			"cash":   domain.NewAmount(60),
			"credit": domain.NewAmount(40),
		},
		Items: []domain.SaleItem{
			{ProductID: product.ID, Name: product.Name, Quantity: 1.0, Price: product.Price},
		},
	}

	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Customer debt should now be 40
	c := testutil.MustRefreshCustomer(t, db, customer.ID)
	if c.Debt != domain.NewAmount(40) {
		t.Fatalf("Expected customer debt to be 40, got %s", c.Debt.String())
	}

	// Now return the sale in full
	if err := saleService.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale failed: %v", err)
	}

	// Customer debt must be reconciled back to 0
	cAfter := testutil.MustRefreshCustomer(t, db, customer.ID)
	if cAfter.Debt != domain.Zero() {
		t.Errorf("Expected customer debt to return to 0, got %s", cAfter.Debt.String())
	}

	// Product stock must be restored to 10
	p := testutil.MustRefreshProduct(t, db, product.ID)
	if p.Stock != 10.0 {
		t.Errorf("Expected product stock restored to 10, got %f", p.Stock)
	}

	// Check refund payment for cash portion (-60)
	var refundPayments []domain.Payment
	if err := db.Where("sale_id = ? AND method = 'cash' AND amount < 0", sale.ID).Find(&refundPayments).Error; err != nil {
		t.Fatalf("Failed to fetch refund payments: %v", err)
	}
	if len(refundPayments) == 0 {
		t.Error("Expected refund payment for cash leg")
	} else if refundPayments[0].Amount != domain.NewAmount(-60) {
		t.Errorf("Expected cash refund of -60, got %s", refundPayments[0].Amount.String())
	}
}

// TestEdge_ReturnSalePartial_ExceedOriginalQty tests that partial return requesting more than sold quantity is rejected.
func TestEdge_ReturnSalePartial_ExceedOriginalQty(t *testing.T) {
	saleService, db, cleanup := setupSaleEdgeTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Partial Item", 50.0, 10.0)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		PaymentMethod: "cash",
		Items: []domain.SaleItem{
			{ProductID: product.ID, Name: product.Name, Quantity: 2.0, Price: product.Price},
		},
	}

	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Attempt to return 3 units when only 2 were purchased
	err := saleService.ReturnSalePartial(sale.ID, product.ID, 3.0)
	if err == nil {
		t.Fatal("Expected error when returning quantity exceeding purchased amount, got nil")
	}

	var appErr *pkgerrors.AppError
	if errors.As(err, &appErr) {
		if appErr.Code != "RETURN_QUANTITY_EXCEEDS_REMAINING" {
			t.Errorf("Expected error code RETURN_QUANTITY_EXCEEDS_REMAINING, got %s", appErr.Code)
		}
	}
}

// TestEdge_ReturnSale_AlreadyReturned_Rejected tests that a return on an already-returned sale is rejected.
func TestEdge_ReturnSale_AlreadyReturned_Rejected(t *testing.T) {
	saleService, db, cleanup := setupSaleEdgeTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Single Item", 50.0, 10.0)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		PaymentMethod: "cash",
		Items: []domain.SaleItem{
			{ProductID: product.ID, Name: product.Name, Quantity: 1.0, Price: product.Price},
		},
	}

	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// First return succeeds
	if err := saleService.ReturnSale(sale.ID); err != nil {
		t.Fatalf("First ReturnSale failed: %v", err)
	}

	// Second return must be rejected
	err := saleService.ReturnSale(sale.ID)
	if err == nil {
		t.Fatal("Expected error on second ReturnSale, got nil")
	}

	var appErr *pkgerrors.AppError
	if errors.As(err, &appErr) {
		if appErr.Code != "ALREADY_RETURNED" {
			t.Errorf("Expected error code ALREADY_RETURNED, got %s", appErr.Code)
		}
	}
}
