package e2e

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

// TestE2E_Financial_CustomerLedgerStatementHistoricalAudit tests chronological financial ledger consistency (Rule 3.8):
// Drives a multi-step customer transaction timeline:
// 1. Initial balance (0).
// 2. Credit Sale #1 (+100,000) -> Debt = 100,000.
// 3. Partial Cash Payment (-40,000) -> Debt = 60,000.
// 4. Credit Sale #2 (+80,000) -> Debt = 140,000.
// 5. Full Return of Sale #1 (-100,000) -> Debt = 40,000.
// 6. Full Cash Payoff (-40,000) -> Debt = 0.
// Verifies that at every step, the running debt balance is mathematically exact with zero floating-point error.
func TestE2E_Financial_CustomerLedgerStatementHistoricalAudit(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	staff, err := h.Repos.staff.GetByUsername(AdminUsername)
	if err != nil {
		t.Fatalf("staff lookup failed: %v", err)
	}

	// 1. Create customer and products
	cust := h.NewCustomer("مؤسسة الهدى التجارية", 0)
	prod1 := h.NewProduct("شاشة تلفزيون 55 بوصة", 100000, 20)
	prod2 := h.NewProduct("مكيف هواء سبليت", 80000, 20)

	// Step 2: Credit Sale #1 (+100,000)
	sale1 := buildCreditSale(prod1, cust, 1)
	if err := h.SaleHandler.ProcessSale(sale1); err != nil {
		t.Fatalf("ProcessSale credit 1 failed: %v", err)
	}
	cAfterSale1 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(cAfterSale1.Debt, domain.NewAmount(100000)) {
		t.Fatalf("Step 2 mismatch: expected debt 100000, got %s", cAfterSale1.Debt.String())
	}

	// Step 3: Partial Cash Payment (-40,000)
	pay1 := domain.Payment{
		CustomerID: cust.ID,
		Amount:     domain.NewAmount(40000),
		Method:     "cash",
		Note:       "دفعة تحت الحساب",
		StaffID:    staff.ID,
		Timestamp:  time.Now().UnixMilli(),
	}
	if _, err := h.PaymentHandler.CreatePayment(pay1); err != nil {
		t.Fatalf("CreatePayment 1 failed: %v", err)
	}
	cAfterPay1 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(cAfterPay1.Debt, domain.NewAmount(60000)) {
		t.Fatalf("Step 3 mismatch: expected debt 60000, got %s", cAfterPay1.Debt.String())
	}

	// Step 4: Credit Sale #2 (+80,000)
	sale2 := buildCreditSale(prod2, cust, 1)
	if err := h.SaleHandler.ProcessSale(sale2); err != nil {
		t.Fatalf("ProcessSale credit 2 failed: %v", err)
	}
	cAfterSale2 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(cAfterSale2.Debt, domain.NewAmount(140000)) {
		t.Fatalf("Step 4 mismatch: expected debt 140000, got %s", cAfterSale2.Debt.String())
	}

	// Step 5: Full Return of Sale #1 (-100,000) -> Debt = 140,000 - 100,000 = 40,000
	if err := h.SaleHandler.ReturnSale(sale1.ID); err != nil {
		t.Fatalf("ReturnSale sale1 failed: %v", err)
	}
	cAfterReturn1 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(cAfterReturn1.Debt, domain.NewAmount(40000)) {
		t.Fatalf("Step 5 mismatch: expected debt 40000, got %s", cAfterReturn1.Debt.String())
	}

	// Step 6: Full Cash Payoff (-40,000)
	pay2 := domain.Payment{
		CustomerID: cust.ID,
		Amount:     domain.NewAmount(40000),
		Method:     "cash",
		Note:       "تسوية الحساب بالكامل",
		StaffID:    staff.ID,
		Timestamp:  time.Now().UnixMilli(),
	}
	if _, err := h.PaymentHandler.CreatePayment(pay2); err != nil {
		t.Fatalf("CreatePayment 2 failed: %v", err)
	}
	cFinal := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(cFinal.Debt, domain.Zero()) {
		t.Fatalf("Step 6 mismatch: expected zero debt, got %s", cFinal.Debt.String())
	}

	// Step 7: Verify customer payments history
	payments, err := h.PaymentHandler.GetPaymentsByCustomer(cust.ID)
	if err != nil {
		t.Fatalf("GetPaymentsByCustomer failed: %v", err)
	}
	if len(payments) < 2 {
		t.Fatalf("expected at least 2 payments for customer, got %d", len(payments))
	}
}
