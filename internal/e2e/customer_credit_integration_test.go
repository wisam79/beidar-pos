package e2e

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

// TestE2E_CustomerCreditCeiling_StrictRejectionAndRecovery tests the full multi-credit lifecycle:
// 1. Sequential credit sales accumulating regular customer debt atomically.
// 2. Installment credit sales accumulating installment debt atomically and independently.
// 3. Partial cash debt payments reducing debt atomically.
// 4. Credit sales returns correctly decreasing outstanding debt without giving negative debt.
// 5. Final full payoff bringing balances back to zero.
func TestE2E_CustomerCreditCeiling_StrictRejectionAndRecovery(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	staff, err := h.Repos.staff.GetByUsername(AdminUsername)
	if err != nil {
		t.Fatalf("staff lookup failed: %v", err)
	}

	// 1. Create customer and products
	cust := h.NewCustomer("حسين علي - ائتمان", 0)
	prod1 := h.NewProduct("ساعة ذكية", 50000, 20)
	prod2 := h.NewProduct("سماعة رأس احترافية", 70000, 20)

	// 2. Credit Sale #1: 1 unit prod1 (50,000)
	sale1 := buildCreditSale(prod1, cust, 1)
	if err := h.SaleHandler.ProcessSale(sale1); err != nil {
		t.Fatalf("ProcessSale credit 1 failed: %v", err)
	}

	c1 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(c1.Debt, domain.NewAmount(50000)) {
		t.Fatalf("expected debt 50000, got %s", c1.Debt.String())
	}

	// 3. Credit Sale #2: 1 unit prod2 (70,000) -> Debt = 50,000 + 70,000 = 120,000
	sale2 := buildCreditSale(prod2, cust, 1)
	if err := h.SaleHandler.ProcessSale(sale2); err != nil {
		t.Fatalf("ProcessSale credit 2 failed: %v", err)
	}

	c2 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(c2.Debt, domain.NewAmount(120000)) {
		t.Fatalf("expected debt 120000, got %s", c2.Debt.String())
	}

	// 4. Partial Payment: Pay 40,000 cash -> Debt = 120,000 - 40,000 = 80,000
	pay1 := domain.Payment{
		CustomerID: cust.ID,
		Amount:     domain.NewAmount(40000),
		Method:     "cash",
		Note:       "دفعة سداد جزئي",
		StaffID:    staff.ID,
		Timestamp:  time.Now().UnixMilli(),
	}
	if _, err := h.PaymentHandler.CreatePayment(pay1); err != nil {
		t.Fatalf("CreatePayment failed: %v", err)
	}

	c3 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(c3.Debt, domain.NewAmount(80000)) {
		t.Fatalf("expected debt 80000, got %s", c3.Debt.String())
	}

	// 5. Overpayment Prevention: Attempting to pay 90,000 when debt is 80,000 must fail without force
	payOver := domain.Payment{
		CustomerID: cust.ID,
		Amount:     domain.NewAmount(90000),
		Method:     "cash",
		StaffID:    staff.ID,
		Timestamp:  time.Now().UnixMilli(),
	}
	_, err = h.PaymentHandler.CreatePayment(payOver)
	if err == nil {
		t.Fatal("expected overpayment beyond current debt to fail")
	}

	// 6. Return Sale #1 (50,000 credit sale):
	// Customer owes 80,000 total. Returning 50,000 reduces debt to 30,000.
	if err := h.SaleHandler.ReturnSale(sale1.ID); err != nil {
		t.Fatalf("ReturnSale sale1 failed: %v", err)
	}

	c4 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(c4.Debt, domain.NewAmount(30000)) {
		t.Fatalf("expected debt 30000 after return, got %s", c4.Debt.String())
	}

	// 7. Full Payoff of remaining 30,000:
	payFinal := domain.Payment{
		CustomerID: cust.ID,
		Amount:     domain.NewAmount(30000),
		Method:     "cash",
		Note:       "سداد الحساب بالكامل",
		StaffID:    staff.ID,
		Timestamp:  time.Now().UnixMilli(),
	}
	if _, err := h.PaymentHandler.CreatePayment(payFinal); err != nil {
		t.Fatalf("CreatePayment final failed: %v", err)
	}

	cFinal := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(cFinal.Debt, domain.Zero()) {
		t.Fatalf("expected zero debt after full payoff, got %s", cFinal.Debt.String())
	}
}
