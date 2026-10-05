package service_test

import (
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// failFirstCreatePaymentRepo decorates a real PaymentRepository so that only the
// FIRST Create of a transaction fails, reproducing what a full disk or a corrupt
// page does at one specific ledger write.
//
// Failing only the first write matters: a split return writes the credit-overpay
// refund first and the invoice's own cash/card refunds afterwards. If every
// write failed, the later (already correct) error handling would abort the
// transaction anyway and the test would pass even with the first write's error
// still swallowed.
type failFirstCreatePaymentRepo struct {
	domain.PaymentRepository
	calls *int32
}

func (f *failFirstCreatePaymentRepo) Create(p *domain.Payment) error {
	if atomic.AddInt32(f.calls, 1) == 1 {
		return errors.New("simulated payment ledger failure")
	}
	return f.PaymentRepository.Create(p)
}

func (f *failFirstCreatePaymentRepo) WithTx(tx domain.Tx) domain.PaymentRepository {
	return &failFirstCreatePaymentRepo{
		PaymentRepository: f.PaymentRepository.WithTx(tx),
		calls:             f.calls,
	}
}

// newReturnIntegritySaleService wires a sale service onto the test DB, optionally
// with a payment ledger that rejects every write.
func newReturnIntegritySaleService(t *testing.T, db *gorm.DB, breakPayments bool) domain.SaleService {
	t.Helper()

	prefRepo := repository.NewPreferencesRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	productRepo := repository.NewProductRepository(db)
	shiftRepo := repository.NewShiftRepository(db)
	saleRepo := repository.NewSaleRepository(db)
	realPaymentRepo := repository.NewPaymentRepository(db)
	auditRepo := repository.NewAuditRepository(db)

	var paymentRepo domain.PaymentRepository = realPaymentRepo
	if breakPayments {
		paymentRepo = &failFirstCreatePaymentRepo{PaymentRepository: realPaymentRepo, calls: new(int32)}
	}

	productService := service.NewProductService(productRepo)
	return service.NewSaleService(saleRepo, productRepo, customerRepo, paymentRepo, shiftRepo, prefRepo, productService, auditRepo)
}

func setupReturnIntegrity(t *testing.T) (domain.SaleService, *gorm.DB, func()) {
	t.Helper()
	db, cleanup := testutil.SetupDB(t,
		&domain.Product{}, &domain.Sale{}, &domain.SaleItem{}, &domain.Customer{}, &domain.Payment{},
		&domain.StockMovement{}, &domain.Shift{}, &domain.CashMovement{}, &domain.Staff{},
		&domain.AppPreferences{}, &domain.LoginAttempt{}, &domain.Supplier{}, &domain.Category{},
		&domain.ParkedSale{},
	)
	testutil.SeedPreferences(t, db)
	return newReturnIntegritySaleService(t, db, false), db, cleanup
}

// splitSaleWithPaidOffCredit creates a cash/card/credit sale, then clears the
// customer's debt so the credit leg becomes an overpayment at return time — the
// exact case where cash leaves the drawer beyond the invoice's own cash leg.
func splitSaleWithPaidOffCredit(t *testing.T, saleService domain.SaleService, db *gorm.DB) (saleID, customerID, productID string) {
	t.Helper()

	fflOpenShift(t, db, "shift-overpay")
	customer := createTestCustomer(t, db, "Overpay Customer", 0)
	product := createTestProduct(t, db, "Overpay Item", 100, 10)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      domain.NewAmount(100.00),
		Total:         domain.NewAmount(100.00),
		PaymentMethod: "split",
		Status:        "pending",
		SplitDetails: map[string]domain.Amount{
			"cash":   domain.NewAmount(60.00),
			"card":   domain.NewAmount(30.00),
			"credit": domain.NewAmount(10.00),
		},
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  1,
			Price:     domain.NewAmount(100.00),
			Total:     domain.NewAmount(100.00),
		}},
	}
	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale: %v", err)
	}
	if !amountEq(refreshCustomer(t, db, customer.ID).Debt, domain.NewAmount(10.00)) {
		t.Fatalf("credit leg did not create 10 debt")
	}

	// The customer settles the debt before the return, so the credit leg has
	// nothing left to cancel and its overpaid part is paid back in cash.
	if err := db.Model(&domain.Customer{}).Where("id = ?", customer.ID).Update("debt", 0).Error; err != nil {
		t.Fatalf("clear customer debt: %v", err)
	}

	return sale.ID, customer.ID, product.ID
}

// TestReturnSplit_CreditOverpay_LeavesDrawer asserts that cash handed back for
// an overpaid credit leg is deducted from the shift's expected balance. Before
// the fix the value stayed zero for split sales, so shift close reported a
// phantom surplus of the cash that actually left the drawer.
func TestReturnSplit_CreditOverpay_LeavesDrawer(t *testing.T) {
	saleService, db, cleanup := setupReturnIntegrity(t)
	defer cleanup()

	saleID, _, _ := splitSaleWithPaidOffCredit(t, saleService, db)

	if err := saleService.ReturnSale(saleID); err != nil {
		t.Fatalf("ReturnSale: %v", err)
	}

	var cashOut domain.Amount
	for _, p := range fflPaymentsBySale(t, db, saleID) {
		if p.Method == "cash" && p.Amount.Cents() < 0 {
			cashOut = cashOut.Add(p.Amount)
		}
	}
	// -60 returns the invoice's cash leg and -10 pays back the credit
	// overpayment: both leave the drawer.
	if !amountEq(cashOut, domain.NewAmount(-70.00)) {
		t.Errorf("cash refunds total = %s, want -70.00", cashOut.String())
	}

	// 60 in, 70 out. The repository floors every shift counter at zero, so the
	// observable proof is total_sales: the invoice was fully returned, so the
	// shift must no longer count any of it. Before the fix the overpaid 10 was
	// left out of the refund total and 10.00 of sales stayed counted.
	shift := fflLoadShift(t, db, "shift-overpay")
	if !amountEq(shift.TotalSales, domain.Zero()) {
		t.Errorf("shift total sales = %s, want 0 after a full return", shift.TotalSales.String())
	}
	if !amountEq(shift.ExpectedBalance, domain.Zero()) {
		t.Errorf("shift expected balance = %s, want 0", shift.ExpectedBalance.String())
	}
}

// TestReturnSplit_CreditOverpay_FailedLedgerWriteRollsBack asserts that a failed
// refund-payment insert aborts the whole return instead of committing a returned
// sale whose disbursed cash was never recorded in the ledger.
func TestReturnSplit_CreditOverpay_FailedLedgerWriteRollsBack(t *testing.T) {
	healthyService, db, cleanup := setupReturnIntegrity(t)
	defer cleanup()

	saleID, customerID, productID := splitSaleWithPaidOffCredit(t, healthyService, db)

	breakingService := newReturnIntegritySaleService(t, db, true)
	if err := breakingService.ReturnSale(saleID); err == nil {
		t.Fatal("expected ReturnSale to fail when the payment ledger write fails")
	}

	var sale domain.Sale
	if err := db.First(&sale, "id = ?", saleID).Error; err != nil {
		t.Fatalf("reload sale: %v", err)
	}
	if sale.Status == "returned" {
		t.Error("sale must not be marked returned when the refund payment could not be written")
	}

	if debt := refreshCustomer(t, db, customerID).Debt; !amountEq(debt, domain.Zero()) {
		t.Errorf("customer debt = %s, want 0 — the whole return must roll back", debt.String())
	}

	var product domain.Product
	if err := db.First(&product, "id = ?", productID).Error; err != nil {
		t.Fatalf("reload product: %v", err)
	}
	if product.Stock != 9 {
		t.Errorf("product stock = %v, want 9 — the stock restore must roll back too", product.Stock)
	}
}

// failUpdateShiftRepo decorates a real ShiftRepository so UpdateShiftSales —
// the call that keeps a shift's cash in step with the payment ledger — fails.
type failUpdateShiftRepo struct {
	domain.ShiftRepository
}

func (f failUpdateShiftRepo) UpdateShiftSales(_, _ domain.Amount, _, _ bool) error {
	return errors.New("simulated shift update failure")
}

func (f failUpdateShiftRepo) WithTx(tx domain.Tx) domain.ShiftRepository {
	return failUpdateShiftRepo{ShiftRepository: f.ShiftRepository.WithTx(tx)}
}

// TestDeletePayment_ShiftUpdateFailureRollsBack asserts that deleting a
// standalone cash payment aborts when the shift cannot be brought back in line.
// Before the fix the error was discarded, so the payment row was deleted while
// the shift kept counting the cash that no longer exists.
func TestDeletePayment_ShiftUpdateFailureRollsBack(t *testing.T) {
	db, cleanup := testutil.SetupDB(t,
		&domain.Product{}, &domain.Sale{}, &domain.SaleItem{}, &domain.Customer{}, &domain.Payment{},
		&domain.StockMovement{}, &domain.Shift{}, &domain.CashMovement{}, &domain.Staff{},
		&domain.AppPreferences{}, &domain.LoginAttempt{}, &domain.Supplier{}, &domain.Category{},
	)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	fflOpenShift(t, db, "shift-delete")
	customer := createTestCustomer(t, db, "Debt Payer", 50)

	paymentRepo := repository.NewPaymentRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	shiftRepo := repository.NewShiftRepository(db)
	prefRepo := repository.NewPreferencesRepository(db)

	// A standalone cash payment (no sale) reduces the customer debt on creation.
	standalone := service.NewPaymentService(paymentRepo, customerRepo, repository.NewSaleRepository(db), shiftRepo, prefRepo)
	created, err := standalone.CreatePayment(domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(20.00),
		Method:     "cash",
		Timestamp:  time.Now().UnixMilli(),
	})
	if err != nil {
		t.Fatalf("CreatePayment: %v", err)
	}

	// Same service, but the shift no longer accepts the reversal.
	breaking := service.NewPaymentService(paymentRepo, customerRepo, repository.NewSaleRepository(db),
		failUpdateShiftRepo{ShiftRepository: shiftRepo}, prefRepo)
	if err := breaking.DeletePayment(created.ID); err == nil {
		t.Fatal("expected DeletePayment to fail when the shift update fails")
	}

	var stillThere domain.Payment
	if err := db.First(&stillThere, "id = ?", created.ID).Error; err != nil {
		t.Errorf("payment row must survive the failed shift update: %v", err)
	}
}
