package e2e

import (
	"strings"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
	"beidar-desktop/pkg/auth"
	pkgerrors "beidar-desktop/pkg/errors"

	"github.com/google/uuid"
)

// assertErrCode fails t unless err is a *pkgerrors.AppError carrying the given code.
func assertErrCode(t *testing.T, err error, code string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected error with code %q, got nil", code)
	}
	appErr, ok := err.(*pkgerrors.AppError)
	if !ok {
		// Wails may wrap the error; fall back to a textual check.
		if strings.Contains(err.Error(), code) {
			return
		}
		t.Fatalf("expected error with code %q, got: %v", code, err)
	}
	if appErr.Code != code {
		t.Fatalf("expected error code %q, got %q (%v)", code, appErr.Code, err)
	}
}

// buildInstallmentSale constructs an installment sale whose schedule exactly
// finances total-down over len(monthly) installments.
func buildInstallmentSale(product *domain.Product, customer *domain.Customer, down domain.Amount, monthly []domain.Amount) domain.Sale {
	total := down
	schedule := make([]domain.Installment, len(monthly))
	for i, m := range monthly {
		total = total.Add(m)
		schedule[i] = domain.Installment{Number: i + 1, DueDate: "2026-12-01", Amount: m, Status: "pending"}
	}
	return domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		StaffID:       auth.CurrentStaffID(),
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      total,
		Total:         total,
		PaymentMethod: "installment",
		Status:        "pending",
		ItemsCount:    1,
		InstallmentPlan: &domain.InstallmentPlan{
			TotalAmount: total,
			DownPayment: down,
			Months:      len(monthly),
			StartDate:   time.Now().Format("2006-01-02"),
			Schedule:    schedule,
		},
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  1,
			Price:     product.Price,
			Total:     total,
		}},
	}
}

// TestE2E_DebtFullLifecycleToZero drives a credit customer from a pre-existing
// balance through a credit sale, partial payments, full settlement and finally
// forces an overpayment like a manager would.
func TestE2E_DebtFullLifecycleToZero(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("شاشة", 150000, 4)
	customer := h.NewCustomer("زبون دين", 10000)

	// 1. Credit sale adds the invoice total to the existing balance.
	sale := buildCreditSale(product, customer, 1)
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}
	c := h.MustReloadCustomer(customer.ID)
	wantStart := domain.NewAmount(10000).Add(domain.NewAmount(150000))
	if !testutil.AmountEq(c.Debt, wantStart) {
		t.Fatalf("debt = %s, want %s", c.Debt.String(), wantStart.String())
	}
	if c.TotalPurchases != domain.NewAmount(150000) {
		t.Errorf("totalPurchases = %s, want 150000", c.TotalPurchases.String())
	}

	// The credit sale itself creates one ledger row.
	bySale, err := h.PaymentHandler.GetPaymentsBySale(sale.ID)
	if err != nil {
		t.Fatalf("GetPaymentsBySale failed: %v", err)
	}
	if len(bySale) != 1 {
		t.Fatalf("ledger rows after credit sale = %d, want 1", len(bySale))
	}

	// 2. Partial payment reduces the debt.
	pay := func(amount domain.Amount, method string) {
		t.Helper()
		if _, err := h.PaymentHandler.CreatePayment(domain.Payment{
			SaleID:     sale.ID,
			CustomerID: customer.ID,
			Amount:     amount,
			Method:     method,
			StaffID:    auth.CurrentStaffID(),
		}); err != nil {
			t.Fatalf("CreatePayment(%s) failed: %v", amount.String(), err)
		}
	}

	pay(domain.NewAmount(50000), "cash")
	if got := h.MustReloadCustomer(customer.ID).Debt; !testutil.AmountEq(got, domain.NewAmount(110000)) {
		t.Errorf("debt = %s, want 110000", got.String())
	}

	bySale, _ = h.PaymentHandler.GetPaymentsBySale(sale.ID)
	if len(bySale) != 2 {
		t.Errorf("ledger rows after partial payment = %d, want 2", len(bySale))
	}

	// 3. Overpayment is rejected without the forced path.
	if _, err := h.PaymentHandler.CreatePayment(domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(200000),
		Method:     "cash",
	}); err == nil {
		t.Fatal("overpayment should be rejected")
	} else {
		assertErrCode(t, err, "PAYMENT_EXCEEDS_DEBT")
	}

	// 4. Settle the remaining debt exactly; it must hit zero.
	pay(domain.NewAmount(110000), "cash")
	settled := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(settled.Debt, domain.Zero()) {
		t.Errorf("debt = %s, want 0", settled.Debt.String())
	}

	// 5. A manager can force an overpayment after acknowledgement.
	if err := h.PaymentHandler.CreatePaymentForced(domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(1000),
		Method:     "cash",
		StaffID:    auth.CurrentStaffID(),
	}); err != nil {
		t.Fatalf("CreatePaymentForced failed: %v", err)
	}
	if got := h.MustReloadCustomer(customer.ID).Debt; !testutil.AmountEq(got, domain.Zero()) {
		t.Errorf("debt after forced overpay = %s, want 0", got.String())
	}
}

// TestE2E_InstallmentLifecycleToPaid proves financing maths across the whole
// lifecycle: separate installment debt, per-payment decreases, rejection paths
// and the final transition of the sale to "paid".
func TestE2E_InstallmentLifecycleToPaid(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("براد", 600000, 3)
	customer := h.NewCustomer("زبون أقساط", 0)

	down := domain.NewAmount(100000)
	monthly := []domain.Amount{
		domain.NewAmount(100000),
		domain.NewAmount(100000),
		domain.NewAmount(100000),
		domain.NewAmount(100000),
		domain.NewAmount(100000),
	}
	sale := buildInstallmentSale(product, customer, down, monthly)
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale installment failed: %v", err)
	}

	// Installment debt is the financed portion only; regular debt untouched.
	c := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.Debt, domain.Zero()) {
		t.Errorf("regular debt = %s, want 0", c.Debt.String())
	}
	if !testutil.AmountEq(c.InstallmentDebt, domain.NewAmount(500000)) {
		t.Errorf("installment debt = %s, want 500000", c.InstallmentDebt.String())
	}

	// Ledger rows: financed leg + down payment leg, not the full total twice.
	bySale, err := h.PaymentHandler.GetPaymentsBySale(sale.ID)
	if err != nil {
		t.Fatalf("GetPaymentsBySale failed: %v", err)
	}
	var rowsSum domain.Amount
	for _, p := range bySale {
		rowsSum = rowsSum.Add(p.Amount)
	}
	if !testutil.AmountEq(rowsSum, sale.Total) {
		t.Errorf("ledger sum = %s, want sale total %s", rowsSum.String(), sale.Total.String())
	}

	summary := func() (total int, paid int, remaining domain.Amount) {
		t.Helper()
		s, err := h.PaymentHandler.GetInstallmentSummary(sale.ID)
		if err != nil {
			t.Fatalf("GetInstallmentSummary failed: %v", err)
		}
		return s.Total, s.Paid, s.Remaining
	}

	pay := func(index int) {
		t.Helper()
		amt := monthly[index]
		if err := h.PaymentHandler.PayInstallment(sale.ID, index, amt, "cash"); err != nil {
			t.Fatalf("PayInstallment(%d) failed: %v", index, err)
		}
	}

	// Pay every installment; each must reduce the customer's installment debt.
	expectedDebt := domain.NewAmount(500000)
	for i := range monthly {
		pay(i)
		expectedDebt = expectedDebt.Sub(monthly[i])
		c = h.MustReloadCustomer(customer.ID)
		if !testutil.AmountEq(c.InstallmentDebt, expectedDebt) {
			t.Errorf("after paying %d: installment debt = %s, want %s", i, c.InstallmentDebt.String(), expectedDebt.String())
		}
	}

	// After all installments the sale is settled.
	total, paid, remaining := summary()
	if total != 5 || paid != 5 {
		t.Errorf("summary total/paid = %d/%d, want 5/5", total, paid)
	}
	if !testutil.AmountEq(remaining, domain.Zero()) {
		t.Errorf("remaining = %s, want 0", remaining.String())
	}
	if got := h.MustReloadCustomer(customer.ID).InstallmentDebt; !testutil.AmountEq(got, domain.Zero()) {
		t.Errorf("installment debt = %s, want 0", got.String())
	}

	sold, err := h.SaleHandler.GetSale(sale.ID)
	if err != nil {
		t.Fatalf("GetSale failed: %v", err)
	}
	if sold.Status != "paid" {
		t.Errorf("sale status = %q, want paid", sold.Status)
	}
}

// TestE2E_InstallmentPaymentRejections guards the financial integrity rules:
// exact amount only, no double payment, no out-of-range indexes, amounts must be positive.
func TestE2E_InstallmentPaymentRejections(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("غسالة", 400000, 2)
	customer := h.NewCustomer("زبون رفض", 0)

	monthly := []domain.Amount{
		domain.NewAmount(100000),
		domain.NewAmount(100000),
	}
	sale := buildInstallmentSale(product, customer, domain.NewAmount(200000), monthly)
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Wrong amount is not acceptable for installments (exact amount required).
	err := h.PaymentHandler.PayInstallment(sale.ID, 0, domain.NewAmount(99999), "cash")
	assertErrCode(t, err, "EXACT_AMOUNT_REQUIRED")

	// Already-paid installment must reject a second payment.
	if err := h.PaymentHandler.PayInstallment(sale.ID, 0, domain.NewAmount(100000), "cash"); err != nil {
		t.Fatalf("first payment failed: %v", err)
	}
	err = h.PaymentHandler.PayInstallment(sale.ID, 0, domain.NewAmount(100000), "cash")
	assertErrCode(t, err, "INSTALLMENT_ALREADY_PAID")

	// Out-of-range index and non-positive amount must be rejected.
	err = h.PaymentHandler.PayInstallment(sale.ID, 2, domain.NewAmount(100000), "cash")
	assertErrCode(t, err, "INVALID_INSTALLMENT_INDEX")
	err = h.PaymentHandler.PayInstallment(sale.ID, -1, domain.NewAmount(100000), "cash")
	assertErrCode(t, err, "INVALID_INSTALLMENT_INDEX")
	err = h.PaymentHandler.PayInstallment(sale.ID, 1, domain.NewAmount(0), "cash")
	assertErrCode(t, err, "INVALID_PAYMENT_AMOUNT")

	// A manual payment routed to an installment sale is rejected by design when
	// the amount does not exceed the customer's regular debt (an overpayment
	// check would otherwise fire first with PAYMENT_EXCEEDS_DEBT).
	_, err = h.PaymentHandler.CreatePayment(domain.Payment{
		SaleID:     sale.ID,
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(1000),
		Method:     "cash",
	})
	assertErrCode(t, err, "PAYMENT_EXCEEDS_DEBT")

	// With a debt balance available, the installment-only rule is enforced.
	customer2 := h.NewCustomer("زبون رفض بدين", 500000)
	_, err = h.PaymentHandler.CreatePayment(domain.Payment{
		SaleID:     sale.ID,
		CustomerID: customer2.ID,
		Amount:     domain.NewAmount(1000),
		Method:     "cash",
	})
	assertErrCode(t, err, "USE_PAY_INSTALLMENT")

	// No ledger rows were created by any rejected attempt. Rows present:
	// financed leg + down payment + the one installment paid legitimately above.
	bySale, err := h.PaymentHandler.GetPaymentsBySale(sale.ID)
	if err != nil {
		t.Fatalf("GetPaymentsBySale failed: %v", err)
	}
	if len(bySale) != 3 {
		t.Errorf("ledger rows = %d, want 3", len(bySale))
	}
}

// TestE2E_InstallmentReturnRefundsOnlyPaid_ClearsDebt returns a partially-paid
// installment sale. Money already received (down + paid) is refunded, the
// outstanding financed portion is written off, and stock returns.
func TestE2E_InstallmentReturnRefundsOnlyPaid_ClearsDebt(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("تكيف", 800000, 5)
	customer := h.NewCustomer("زبون أقساط مرتجع", 0)

	down := domain.NewAmount(150000)
	monthly := []domain.Amount{
		domain.NewAmount(130000),
		domain.NewAmount(130000),
		domain.NewAmount(130000),
		domain.NewAmount(130000),
		domain.NewAmount(130000),
	}
	sale := buildInstallmentSale(product, customer, down, monthly)
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}
	wantFinanced := sale.Total.Sub(down)
	if got := h.MustReloadCustomer(customer.ID).InstallmentDebt; !testutil.AmountEq(got, wantFinanced) {
		t.Fatalf("installment debt = %s, want %s", got.String(), wantFinanced.String())
	}

	// Collect exactly one installment before returning the invoice.
	if err := h.PaymentHandler.PayInstallment(sale.ID, 0, monthly[0], "cash"); err != nil {
		t.Fatalf("PayInstallment failed: %v", err)
	}
	if got := h.MustReloadCustomer(customer.ID).InstallmentDebt; !testutil.AmountEq(got, wantFinanced.Sub(monthly[0])) {
		t.Fatalf("installment debt after payment = %s, want %s", got.String(), wantFinanced.Sub(monthly[0]).String())
	}

	if err := h.SaleHandler.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale failed: %v", err)
	}

	// Full return: outstanding financed portion written off, no remaining debt.
	c := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.InstallmentDebt, domain.Zero()) {
		t.Errorf("installment debt after return = %s, want 0", c.InstallmentDebt.String())
	}
	if !testutil.AmountEq(c.Debt, domain.Zero()) {
		t.Errorf("regular debt after return = %s, want 0", c.Debt.String())
	}

	// Stock restored.
	if got := h.MustReloadProduct(product.ID).Stock; got != 5 {
		t.Errorf("stock after return = %v, want 5", got)
	}

	// The exact money received (down + paid installment) is refunded.
	bySale, err := h.PaymentHandler.GetPaymentsBySale(sale.ID)
	if err != nil {
		t.Fatalf("GetPaymentsBySale failed: %v", err)
	}
	var refundSum domain.Amount
	var sawRefund bool
	for _, p := range bySale {
		if p.Amount.IsNegative() {
			sawRefund = true
			refundSum = refundSum.Add(p.Amount)
		}
	}
	if !sawRefund {
		t.Fatal("expected a negative refund payment on the ledger")
	}
	wantRefund := down.Add(monthly[0])
	if !testutil.AmountEq(refundSum, domain.FromCents(-wantRefund.Cents())) {
		t.Errorf("refund sum = %s, want %s", refundSum.String(), domain.FromCents(-wantRefund.Cents()).String())
	}

	// Returned installment sales cannot collect further installments.
	err = h.PaymentHandler.PayInstallment(sale.ID, 1, monthly[1], "cash")
	assertErrCode(t, err, "SALE_RETURNED")
}

// TestE2E_CreditReturnAfterPartialPayment_RefundsCash ensures a partially paid
// credit invoice returns the money actually received back to the customer.
func TestE2E_CreditReturnAfterPartialPayment_RefundsCash(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("ثلاجة", 300000, 2)
	customer := h.NewCustomer("زبون مرتجع نقدي", 0)

	sale := buildCreditSale(product, customer, 1)
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}
	if _, err := h.PaymentHandler.CreatePayment(domain.Payment{
		SaleID:     sale.ID,
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(120000),
		Method:     "cash",
		StaffID:    auth.CurrentStaffID(),
	}); err != nil {
		t.Fatalf("CreatePayment failed: %v", err)
	}

	if err := h.SaleHandler.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale failed: %v", err)
	}

	c := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.Debt, domain.Zero()) {
		t.Errorf("debt after return = %s, want 0", c.Debt.String())
	}

	bySale, err := h.PaymentHandler.GetPaymentsBySale(sale.ID)
	if err != nil {
		t.Fatalf("GetPaymentsBySale failed: %v", err)
	}
	var refunds domain.Amount
	for _, p := range bySale {
		if p.Amount.IsNegative() {
			refunds = refunds.Add(p.Amount)
		}
	}
	if !testutil.AmountEq(refunds, domain.FromCents(-domain.NewAmount(120000).Cents())) {
		t.Errorf("refund sum = %s, want -120000", refunds.String())
	}
}

// TestE2E_SplitSale_DebtAndReturn verifies mixed cash+credit payments: only the
// credit leg creates customer debt, and a full return clears it.
func TestE2E_SplitSale_DebtAndReturn(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("لابتوب", 500000, 3)
	customer := h.NewCustomer("زبون مقسم", 0)

	creditLeg := domain.NewAmount(150000)
	sale := buildSale(product, customer, 1, "split")
	sale.SplitDetails = map[string]domain.Amount{
		"cash":   domain.NewAmount(350000),
		"credit": creditLeg,
	}
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale split failed: %v", err)
	}

	// Debt equals the credit leg only, not the whole invoice.
	c := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.Debt, creditLeg) {
		t.Errorf("debt = %s, want %s", c.Debt.String(), creditLeg.String())
	}
	if !testutil.AmountEq(c.InstallmentDebt, domain.Zero()) {
		t.Errorf("installment debt = %s, want 0", c.InstallmentDebt.String())
	}

	// A ledger row exists per split leg.
	bySale, err := h.PaymentHandler.GetPaymentsBySale(sale.ID)
	if err != nil {
		t.Fatalf("GetPaymentsBySale failed: %v", err)
	}
	if len(bySale) != 2 {
		t.Errorf("ledger rows = %d, want 2", len(bySale))
	}

	// Full return clears the credit leg.
	if err := h.SaleHandler.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale split failed: %v", err)
	}
	if got := h.MustReloadCustomer(customer.ID).Debt; !testutil.AmountEq(got, domain.Zero()) {
		t.Errorf("debt after return = %s, want 0", got.String())
	}
	if got := h.MustReloadProduct(product.ID).Stock; got != 3 {
		t.Errorf("stock after return = %v, want 3", got)
	}
}