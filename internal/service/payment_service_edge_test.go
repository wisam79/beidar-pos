package service_test

import (
	"errors"
	"sync"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
	pkgerrors "beidar-desktop/pkg/errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupPaymentEdgeTestDB(t *testing.T) (service.PaymentService, service.SaleService, *gorm.DB, func()) {
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
	paymentService := service.NewPaymentService(paymentRepo, customerRepo, saleRepo, shiftRepo, prefRepo)

	return paymentService, saleService, db, cleanup
}

// TestEdge_CreatePayment_ConcurrentDebtPayoff tests concurrent payments against customer debt,
// ensuring no race conditions or lost updates occur.
func TestEdge_CreatePayment_ConcurrentDebtPayoff(t *testing.T) {
	paymentService, _, db, cleanup := setupPaymentEdgeTestDB(t)
	defer cleanup()

	// Initial debt: 1000 (100,000 cents)
	customer := testutil.NewCustomer(t, db, "Concurrent Payer", 1000.0)

	const goroutines = 10
	var wg sync.WaitGroup
	errCh := make(chan error, goroutines)

	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			payment := domain.Payment{
				CustomerID: customer.ID,
				Amount:     domain.NewAmount(100.0), // 100.0 * 10 = 1000.0
				Method:     "cash",
			}
			_, err := paymentService.CreatePayment(payment)
			if err != nil {
				errCh <- err
			}
		}()
	}
	wg.Wait()
	close(errCh)

	for err := range errCh {
		t.Fatalf("Concurrent payment failed: %v", err)
	}

	c := testutil.MustRefreshCustomer(t, db, customer.ID)
	if c.Debt != domain.Zero() {
		t.Fatalf("Expected customer debt to be 0 after paying full amount, got %s (%d cents)", c.Debt.String(), c.Debt.Cents())
	}

	// Attempt an additional payment without allowForce, which should be rejected because debt is now 0
	overpay := domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(50.0),
		Method:     "cash",
	}
	_, err := paymentService.CreatePayment(overpay)
	if err == nil {
		t.Fatal("Expected overpayment to fail when debt is 0, got nil")
	}
	var appErr *pkgerrors.AppError
	if errors.As(err, &appErr) {
		if appErr.Code != "PAYMENT_EXCEEDS_DEBT" {
			t.Errorf("Expected error code PAYMENT_EXCEEDS_DEBT, got %s", appErr.Code)
		}
	}
}

// TestEdge_PayInstallment_OutOfOrder tests paying future installment before previous ones,
// verifying independent status tracking, installment debt decrease, and sale status.
func TestEdge_PayInstallment_OutOfOrder(t *testing.T) {
	paymentService, saleService, db, cleanup := setupPaymentEdgeTestDB(t)
	defer cleanup()

	customer := testutil.NewCustomer(t, db, "Installment Cust", 0)
	product := testutil.NewProduct(t, db, "Installment Goods", 750.0, 10.0)

	plan, err := paymentService.CalculateInstallmentPlan(domain.NewAmount(750), domain.Zero(), 3)
	if err != nil {
		t.Fatalf("CalculateInstallmentPlan failed: %v", err)
	}

	sale := domain.Sale{
		ID:              uuid.New().String(),
		CustomerID:      customer.ID,
		CustomerName:    customer.Name,
		PaymentMethod:   "installment",
		InstallmentPlan: plan,
		Items: []domain.SaleItem{
			{ProductID: product.ID, Name: product.Name, Quantity: 1.0, Price: product.Price},
		},
	}

	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	c := testutil.MustRefreshCustomer(t, db, customer.ID)
	if c.InstallmentDebt != domain.NewAmount(750) {
		t.Fatalf("Expected customer installment debt 750, got %s", c.InstallmentDebt.String())
	}

	// Pay installment index 1 (second installment) first
	inst1Amount := plan.Schedule[1].Amount
	if err := paymentService.PayInstallment(sale.ID, 1, inst1Amount, "cash"); err != nil {
		t.Fatalf("PayInstallment index 1 failed: %v", err)
	}

	// Verify sale status is still not "paid" (still pending)
	var loadedSale domain.Sale
	if err := db.First(&loadedSale, "id = ?", sale.ID).Error; err != nil {
		t.Fatalf("Failed to reload sale: %v", err)
	}
	if loadedSale.Status == "paid" {
		t.Error("Sale status should not be 'paid' when only 1 of 3 installments is paid")
	}
	if loadedSale.InstallmentPlan.Schedule[1].Status != "paid" {
		t.Errorf("Expected installment 1 to be paid, got %s", loadedSale.InstallmentPlan.Schedule[1].Status)
	}
	if loadedSale.InstallmentPlan.Schedule[0].Status != "pending" {
		t.Errorf("Expected installment 0 to be pending, got %s", loadedSale.InstallmentPlan.Schedule[0].Status)
	}

	// Verify customer installment debt reduced by 250 -> 500
	c = testutil.MustRefreshCustomer(t, db, customer.ID)
	if c.InstallmentDebt != domain.NewAmount(500) {
		t.Errorf("Expected customer installment debt 500, got %s", c.InstallmentDebt.String())
	}

	// Cannot pay index 1 again
	err = paymentService.PayInstallment(sale.ID, 1, inst1Amount, "cash")
	if err == nil {
		t.Fatal("Expected error paying already paid installment index 1, got nil")
	}

	// Pay remaining installments 0 and 2
	if err := paymentService.PayInstallment(sale.ID, 0, plan.Schedule[0].Amount, "cash"); err != nil {
		t.Fatalf("PayInstallment index 0 failed: %v", err)
	}
	if err := paymentService.PayInstallment(sale.ID, 2, plan.Schedule[2].Amount, "cash"); err != nil {
		t.Fatalf("PayInstallment index 2 failed: %v", err)
	}

	// Now all installments paid -> sale status must be "paid"
	if err := db.First(&loadedSale, "id = ?", sale.ID).Error; err != nil {
		t.Fatalf("Failed to reload sale: %v", err)
	}
	if loadedSale.Status != "paid" {
		t.Errorf("Expected sale status to be 'paid' after all installments paid, got %s", loadedSale.Status)
	}

	c = testutil.MustRefreshCustomer(t, db, customer.ID)
	if c.InstallmentDebt != domain.Zero() {
		t.Errorf("Expected customer installment debt to be 0, got %s", c.InstallmentDebt.String())
	}
}

// TestEdge_PayInstallment_PartialAmount tests that paying an incorrect/mismatched installment amount
// is rejected per business rules.
func TestEdge_PayInstallment_PartialAmount(t *testing.T) {
	paymentService, saleService, db, cleanup := setupPaymentEdgeTestDB(t)
	defer cleanup()

	customer := testutil.NewCustomer(t, db, "Partial Payer", 0)
	product := testutil.NewProduct(t, db, "Goods", 500.0, 10.0)

	plan, err := paymentService.CalculateInstallmentPlan(domain.NewAmount(500), domain.Zero(), 2)
	if err != nil {
		t.Fatalf("CalculateInstallmentPlan failed: %v", err)
	}

	sale := domain.Sale{
		ID:              uuid.New().String(),
		CustomerID:      customer.ID,
		CustomerName:    customer.Name,
		PaymentMethod:   "installment",
		InstallmentPlan: plan,
		Items: []domain.SaleItem{
			{ProductID: product.ID, Name: product.Name, Quantity: 1.0, Price: product.Price},
		},
	}

	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Installment amount required is 250. Try to pay 100.
	err = paymentService.PayInstallment(sale.ID, 0, domain.NewAmount(100), "cash")
	if err == nil {
		t.Fatal("Expected error when paying incorrect installment amount, got nil")
	}

	var appErr *pkgerrors.AppError
	if errors.As(err, &appErr) {
		if appErr.Code != "EXACT_AMOUNT_REQUIRED" {
			t.Errorf("Expected error code EXACT_AMOUNT_REQUIRED, got %s", appErr.Code)
		}
	}
}

// TestEdge_PayInstallment_AllPaid_SaleStatusUpdate tests that paying all installments
// updates sale status to completed/paid.
func TestEdge_PayInstallment_AllPaid_SaleStatusUpdate(t *testing.T) {
	paymentService, saleService, db, cleanup := setupPaymentEdgeTestDB(t)
	defer cleanup()

	customer := testutil.NewCustomer(t, db, "Complete Payer", 0)
	product := testutil.NewProduct(t, db, "Item X", 500.0, 10.0)

	plan, err := paymentService.CalculateInstallmentPlan(domain.NewAmount(500), domain.Zero(), 2)
	if err != nil {
		t.Fatalf("CalculateInstallmentPlan failed: %v", err)
	}

	sale := domain.Sale{
		ID:              uuid.New().String(),
		CustomerID:      customer.ID,
		CustomerName:    customer.Name,
		PaymentMethod:   "installment",
		InstallmentPlan: plan,
		Items: []domain.SaleItem{
			{ProductID: product.ID, Name: product.Name, Quantity: 1.0, Price: product.Price},
		},
	}

	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Pay installment 0
	if err := paymentService.PayInstallment(sale.ID, 0, plan.Schedule[0].Amount, "cash"); err != nil {
		t.Fatalf("PayInstallment 0 failed: %v", err)
	}

	var saleMid domain.Sale
	db.First(&saleMid, "id = ?", sale.ID)
	if saleMid.Status == "paid" {
		t.Error("Sale status should not be 'paid' before all installments are completed")
	}

	// Pay installment 1 (last one)
	if err := paymentService.PayInstallment(sale.ID, 1, plan.Schedule[1].Amount, "cash"); err != nil {
		t.Fatalf("PayInstallment 1 failed: %v", err)
	}

	var saleFinal domain.Sale
	db.First(&saleFinal, "id = ?", sale.ID)
	if saleFinal.Status != "paid" {
		t.Errorf("Expected final sale status to be 'paid', got %s", saleFinal.Status)
	}
}

// TestEdge_CalculateInstallmentPlan_DownPaymentExceedsTotal tests that a down payment
// exceeding the total is rejected with an error.
func TestEdge_CalculateInstallmentPlan_DownPaymentExceedsTotal(t *testing.T) {
	paymentService, _, _, cleanup := setupPaymentEdgeTestDB(t)
	defer cleanup()

	_, err := paymentService.CalculateInstallmentPlan(domain.NewAmount(1000), domain.NewAmount(1500), 3)
	if err == nil {
		t.Fatal("Expected error when down payment exceeds total, got nil")
	}
}

// TestEdge_CalculateInstallmentPlan_OneMonth tests that a 1-month installment plan produces exactly 1 schedule entry.
func TestEdge_CalculateInstallmentPlan_OneMonth(t *testing.T) {
	paymentService, _, _, cleanup := setupPaymentEdgeTestDB(t)
	defer cleanup()

	total := domain.NewAmount(1000)
	downPayment := domain.NewAmount(250)
	months := 1

	plan, err := paymentService.CalculateInstallmentPlan(total, downPayment, months)
	if err != nil {
		t.Fatalf("CalculateInstallmentPlan failed: %v", err)
	}

	if len(plan.Schedule) != 1 {
		t.Fatalf("Expected exactly 1 schedule entry, got %d", len(plan.Schedule))
	}

	expectedAmount := total.Sub(downPayment) // 750 (75000 cents)
	if plan.Schedule[0].Amount != expectedAmount {
		t.Fatalf("Expected schedule[0] amount %s, got %s", expectedAmount.String(), plan.Schedule[0].Amount.String())
	}
}

// TestEdge_CalculateInstallmentPlan_LargeAmountManyMonths tests 10M amount over 36 months,
// verifying the sum of schedule equals total - downPayment exactly with 0 lost cents.
func TestEdge_CalculateInstallmentPlan_LargeAmountManyMonths(t *testing.T) {
	paymentService, _, _, cleanup := setupPaymentEdgeTestDB(t)
	defer cleanup()

	total := domain.NewAmount(10000000)      // 10,000,000 IQD
	downPayment := domain.NewAmount(1000000) // 1,000,000 IQD
	months := 36

	plan, err := paymentService.CalculateInstallmentPlan(total, downPayment, months)
	if err != nil {
		t.Fatalf("CalculateInstallmentPlan failed: %v", err)
	}

	if len(plan.Schedule) != 36 {
		t.Fatalf("Expected 36 installments, got %d", len(plan.Schedule))
	}

	expectedRemaining := total.Sub(downPayment) // 9,000,000 IQD
	var sum domain.Amount
	for i, inst := range plan.Schedule {
		if inst.Amount <= 0 {
			t.Errorf("Installment %d has invalid amount: %s", i+1, inst.Amount.String())
		}
		sum = sum.Add(inst.Amount)
	}

	if sum != expectedRemaining {
		t.Fatalf("Sum of installments (%s) does not equal remaining amount (%s), diff: %d cents",
			sum.String(), expectedRemaining.String(), sum.Sub(expectedRemaining).Cents())
	}
}

// TestEdge_DeletePayment_UpdatesCustomerDebt tests that deleting a payment restores customer debt correctly
// and deleting a sale-linked payment is blocked.
func TestEdge_DeletePayment_UpdatesCustomerDebt(t *testing.T) {
	paymentService, _, db, cleanup := setupPaymentEdgeTestDB(t)
	defer cleanup()

	customer := testutil.NewCustomer(t, db, "Debt Customer", 1000.0)

	// Create standalone payment of 400
	payment := domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(400.0),
		Method:     "cash",
		Timestamp:  time.Now().UnixMilli(),
	}

	created, err := paymentService.CreatePayment(payment)
	if err != nil {
		t.Fatalf("CreatePayment failed: %v", err)
	}

	// Customer debt must now be 600
	c := testutil.MustRefreshCustomer(t, db, customer.ID)
	if c.Debt != domain.NewAmount(600) {
		t.Fatalf("Expected customer debt to be 600, got %s", c.Debt.String())
	}

	// Delete the standalone payment
	if err := paymentService.DeletePayment(created.ID); err != nil {
		t.Fatalf("DeletePayment failed: %v", err)
	}

	// Customer debt must be restored to 1000
	cAfter := testutil.MustRefreshCustomer(t, db, customer.ID)
	if cAfter.Debt != domain.NewAmount(1000) {
		t.Fatalf("Expected customer debt restored to 1000, got %s", cAfter.Debt.String())
	}

	// Create a payment linked to a sale and try to delete it
	salePayment := domain.Payment{
		SaleID:     "sale-xyz-123",
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(100.0),
		Method:     "cash",
		Timestamp:  time.Now().UnixMilli(),
	}
	if err := db.Create(&salePayment).Error; err != nil {
		t.Fatalf("Failed to create sale payment: %v", err)
	}

	err = paymentService.DeletePayment(salePayment.ID)
	if err == nil {
		t.Fatal("Expected error deleting payment linked to sale, got nil")
	}

	var appErr *pkgerrors.AppError
	if errors.As(err, &appErr) {
		if appErr.Code != "CANNOT_DELETE_SALE_PAYMENT" {
			t.Errorf("Expected error code CANNOT_DELETE_SALE_PAYMENT, got %s", appErr.Code)
		}
	}
}
