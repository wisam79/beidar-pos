package service_test

import (
	"errors"
	"sync"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/testutil"
	pkgerrors "beidar-desktop/pkg/errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// helpers prefixed with ffl to avoid any collision with existing test helpers.

func fflPaymentsBySale(t *testing.T, db *gorm.DB, saleID string) []domain.Payment {
	t.Helper()
	var payments []domain.Payment
	if err := db.Where("sale_id = ?", saleID).Order("id").Find(&payments).Error; err != nil {
		t.Fatalf("load payments for sale %s: %v", saleID, err)
	}
	return payments
}

func fflRefundPayments(t *testing.T, db *gorm.DB, saleID string) []domain.Payment {
	t.Helper()
	var refunds []domain.Payment
	for _, p := range fflPaymentsBySale(t, db, saleID) {
		if p.Amount.Cents() < 0 {
			refunds = append(refunds, p)
		}
	}
	return refunds
}

func fflRefundSum(t *testing.T, db *gorm.DB, saleID string) domain.Amount {
	t.Helper()
	var sum domain.Amount
	for _, p := range fflRefundPayments(t, db, saleID) {
		sum = sum.Add(p.Amount)
	}
	return sum
}

func fflOpenShift(t *testing.T, db *gorm.DB, id string) {
	t.Helper()
	shift := &domain.Shift{
		ID:              id,
		StaffID:         "staff-1",
		StaffName:       "Test Cashier",
		OpenTime:        time.Now().UnixMilli(),
		OpeningBalance:  domain.Zero(),
		ExpectedBalance: domain.Zero(),
		TotalSales:      domain.Zero(),
		CashSales:       domain.Zero(),
		Status:          "open",
	}
	if err := db.Create(shift).Error; err != nil {
		t.Fatalf("open shift: %v", err)
	}
}

func fflLoadShift(t *testing.T, db *gorm.DB, id string) domain.Shift {
	t.Helper()
	var shift domain.Shift
	if err := db.First(&shift, "id = ?", id).Error; err != nil {
		t.Fatalf("load shift %s: %v", id, err)
	}
	return shift
}

func fflWantErr(t *testing.T, err error, code string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected AppError %q but got nil", code)
	}
	var appErr *pkgerrors.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected AppError %q, got %v", code, err)
	}
	if appErr.Code != code {
		t.Fatalf("expected code %q, got %q", code, appErr.Code)
	}
}

// ─── 1. installment full return ────────────────────────────────────────────

func TestFinancialFlow_InstallmentFullReturn_RefundsOnlyPaid(t *testing.T) {
	saleService, paymentService, db, cleanup := setupTestDB(t)
	defer cleanup()

	customer := createTestCustomer(t, db, "Inst Customer", 0)
	product := createTestProduct(t, db, "Inst Item", 300000, 10)

	plan, err := paymentService.CalculateInstallmentPlan(domain.NewAmount(300000), domain.NewAmount(50000), 3)
	if err != nil {
		t.Fatalf("CalculateInstallmentPlan: %v", err)
	}

	sale := domain.Sale{
		ID:              uuid.New().String(),
		CustomerID:      customer.ID,
		CustomerName:    customer.Name,
		Date:            time.Now().Format("2006-01-02"),
		Timestamp:       time.Now().UnixMilli(),
		Subtotal:        domain.NewAmount(300000),
		Total:           domain.NewAmount(300000),
		PaymentMethod:   "installment",
		Status:          "pending",
		InstallmentPlan: plan,
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  1,
			Price:     domain.NewAmount(300000),
			Total:     domain.NewAmount(300000),
		}},
	}
	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale: %v", err)
	}

	// The positive payment ledger must equal the invoice total — the down
	// payment must not be double-counted on top of the financed amount.
	var ledger domain.Amount
	for _, p := range fflPaymentsBySale(t, db, sale.ID) {
		if p.Amount > 0 {
			ledger = ledger.Add(p.Amount)
		}
	}
	if !amountEq(ledger, domain.NewAmount(300000)) {
		t.Errorf("payment ledger = %s, want 300000", ledger.String())
	}

	if !amountEq(refreshCustomer(t, db, customer.ID).InstallmentDebt, domain.NewAmount(250000)) {
		t.Fatalf("installment debt not seeded after down payment")
	}

	first := plan.Schedule[0].Amount
	if err := paymentService.PayInstallment(sale.ID, 0, first, "cash"); err != nil {
		t.Fatalf("PayInstallment: %v", err)
	}

	if err := saleService.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale: %v", err)
	}

	// Refund = down(50k) + settled installment. Assert sum + expected == 0.
	wantRefund := domain.NewAmount(50000).Add(first)
	if got := fflRefundSum(t, db, sale.ID); !amountEq(got.Add(wantRefund), domain.Zero()) {
		t.Errorf("refund = %s, want -%s", got.String(), wantRefund.String())
	}

	if c := refreshCustomer(t, db, customer.ID); c.InstallmentDebt != domain.Zero() {
		t.Errorf("installment debt after return = %s, want 0", c.InstallmentDebt.String())
	}

	if len(fflRefundPayments(t, db, sale.ID)) != 1 {
		t.Errorf("expected exactly 1 refund, got %d", len(fflRefundPayments(t, db, sale.ID)))
	}

	var updated domain.Sale
	db.First(&updated, "id = ?", sale.ID)
	if updated.Status != "returned" {
		t.Errorf("status = %q, want returned", updated.Status)
	}

	var p domain.Product
	db.First(&p, "id = ?", product.ID)
	if p.Stock != 10 {
		t.Errorf("stock = %.2f, want 10", p.Stock)
	}
}

// ─── 2. split full return ────────────────────────────────────────────────────────

func TestFinancialFlow_SplitFullReturn_RefundsNonCreditOnly(t *testing.T) {
	saleService, _, db, cleanup := setupTestDB(t)
	defer cleanup()

	customer := createTestCustomer(t, db, "Split Customer", 0)
	product := createTestProduct(t, db, "Split Item", 100, 10)

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

	if err := saleService.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale: %v", err)
	}

	if c := refreshCustomer(t, db, customer.ID); c.Debt != domain.Zero() {
		t.Errorf("debt after split return = %s, want 0", c.Debt.String())
	}

	refunds := fflRefundPayments(t, db, sale.ID)
	if len(refunds) != 2 {
		t.Fatalf("expected 2 refunds, got %d", len(refunds))
	}
	for _, r := range refunds {
		if r.Method == "credit" {
			t.Errorf("refund created for credit leg: %+v", r)
		}
		if r.Method == "cash" && !amountEq(r.Amount.Add(domain.NewAmount(60.00)), domain.Zero()) {
			t.Errorf("cash refund = %s", r.Amount.String())
		}
		if r.Method == "card" && !amountEq(r.Amount.Add(domain.NewAmount(30.00)), domain.Zero()) {
			t.Errorf("card refund = %s", r.Amount.String())
		}
	}

	var updated domain.Sale
	db.First(&updated, "id = ?", sale.ID)
	if updated.Status != "returned" {
		t.Errorf("status = %q, want returned", updated.Status)
	}
}

// ─── 3. delete a payment bound to a sale is rejected ─────────────────────────

// A payment that belongs to an invoice can never be deleted; the whole invoice
// must be returned instead. Deleting must be refused and must not touch debt.
func TestFinancialFlow_DeletePayment_RejectsBoundPayment(t *testing.T) {
	saleService, paymentService, db, cleanup := setupTestDB(t)
	defer cleanup()

	customer := createTestCustomer(t, db, "Delete Payment", 0)
	product := createTestProduct(t, db, "Del Item", 100, 10)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      domain.NewAmount(100),
		Total:         domain.NewAmount(100),
		PaymentMethod: "cash",
		Status:        "completed",
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  1,
			Price:     domain.NewAmount(100),
			Total:     domain.NewAmount(100),
		}},
	}
	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale: %v", err)
	}

	// Use an existing bound payment if ProcessSale created one, else insert one.
	bound := fflPaymentsBySale(t, db, sale.ID)
	if len(bound) == 0 {
		p := domain.Payment{
			SaleID:     sale.ID,
			CustomerID: customer.ID,
			Amount:     domain.NewAmount(100),
			Method:     "cash",
			Timestamp:  time.Now().UnixMilli(),
		}
		if err := db.Create(&p).Error; err != nil {
			t.Fatalf("create bound payment: %v", err)
		}
		bound = []domain.Payment{p}
	}

	debtBefore := refreshCustomer(t, db, customer.ID).Debt

	fflWantErr(t, paymentService.DeletePayment(bound[0].ID), "CANNOT_DELETE_SALE_PAYMENT")

	// The bound payment must still exist and customer debt unchanged.
	var still domain.Payment
	if err := db.First(&still, "id = ?", bound[0].ID).Error; err != nil {
		t.Fatalf("bound payment was deleted: %v", err)
	}
	if c := refreshCustomer(t, db, customer.ID); c.Debt != debtBefore {
		t.Errorf("debt changed after rejected delete: %s -> %s", debtBefore.String(), c.Debt.String())
	}
}

// ─── 4. partial return must not inflate the shift sales count ────────────────

func TestFinancialFlow_PartialReturn_KeepsShiftSalesCount(t *testing.T) {
	saleService, _, db, cleanup := setupTestDB(t)
	defer cleanup()

	fflOpenShift(t, db, "shift-count")
	customer := createTestCustomer(t, db, "Shift Cust", 0)
	product := createTestProduct(t, db, "Shift Item", 5000, 10)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      domain.NewAmount(10000),
		Total:         domain.NewAmount(10000),
		PaymentMethod: "cash",
		Status:        "completed",
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  2,
			Price:     domain.NewAmount(5000),
			Total:     domain.NewAmount(10000),
		}},
	}
	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale: %v", err)
	}
	if got := fflLoadShift(t, db, "shift-count").SalesCount; got != 1 {
		t.Fatalf("sales count after sale = %d, want 1", got)
	}

	if err := saleService.ReturnSalePartial(sale.ID, product.ID, 1); err != nil {
		t.Fatalf("ReturnSalePartial: %v", err)
	}

	// Returning part of a sale must not bump the shift's sales count.
	if got := fflLoadShift(t, db, "shift-count").SalesCount; got != 1 {
		t.Errorf("sales count after partial return = %d, want 1", got)
	}
}

// ─── 5. stats exclude pending and returned invoices ──────────────────────────

func TestStats_ExcludePendingAndReturned(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Sale{}, &domain.Product{})
	defer cleanup()

	today := time.Now().Format("2006-01-02")
	seeded := []domain.Sale{
		{ID: uuid.New().String(), Date: today, Status: "completed", Total: domain.NewAmount(100)},
		{ID: uuid.New().String(), Date: today, Status: "partial_return", Total: domain.NewAmount(75)},
		{ID: uuid.New().String(), Date: today, Status: "paid", Total: domain.NewAmount(50)},
		{ID: uuid.New().String(), Date: today, Status: "returned", Total: domain.NewAmount(1000)},
		{ID: uuid.New().String(), Date: today, Status: "pending", Total: domain.NewAmount(200)},
	}
	for _, s := range seeded {
		if err := db.Create(&s).Error; err != nil {
			t.Fatalf("seed sale: %v", err)
		}
	}

	stats := repository.NewStatsRepository(db)
	totalRevenue, totalOrders, dailyRevenue, dailyOrders, _, _, err := stats.GetBasicStats(today)
	if err != nil {
		t.Fatalf("GetBasicStats: %v", err)
	}

	// Fully-paid installment sales (status "paid") still count as revenue.
	if !amountEq(totalRevenue, domain.NewAmount(225)) {
		t.Errorf("total revenue = %s, want 225", totalRevenue.String())
	}
	if totalOrders != 3 {
		t.Errorf("total orders = %d, want 3", totalOrders)
	}
	if !amountEq(dailyRevenue, domain.NewAmount(225)) {
		t.Errorf("daily revenue = %s, want 225", dailyRevenue.String())
	}
	if dailyOrders != 3 {
		t.Errorf("daily orders = %d, want 3", dailyOrders)
	}
}

// ─── 6. concurrent double return is atomic ──────────────────────────────────

func TestConcurrentReturn_IsAtomic(t *testing.T) {
	saleService, _, db, cleanup := setupTestDB(t)
	defer cleanup()

	customer := createTestCustomer(t, db, "Concurrent Cust", 0)
	product := createTestProduct(t, db, "Conc Item", 100, 10)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      domain.NewAmount(100),
		Total:         domain.NewAmount(100),
		PaymentMethod: "cash",
		Status:        "completed",
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  1,
			Price:     domain.NewAmount(100),
			Total:     domain.NewAmount(100),
		}},
	}
	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale: %v", err)
	}

	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = saleService.ReturnSale(sale.ID)
		}()
	}
	wg.Wait()

	// Stock restored exactly once; refund recorded exactly once.
	var p domain.Product
	db.First(&p, "id = ?", product.ID)
	if p.Stock != 10 {
		t.Errorf("stock = %.2f, want 10 (double return must be guarded)", p.Stock)
	}
	refunds := fflRefundPayments(t, db, sale.ID)
	if len(refunds) != 1 {
		t.Errorf("expected 1 refund after concurrent returns, got %d", len(refunds))
	}

	if c := refreshCustomer(t, db, customer.ID); c.Debt != domain.Zero() {
		t.Errorf("debt after concurrent return = %s, want 0", c.Debt.String())
	}
}
