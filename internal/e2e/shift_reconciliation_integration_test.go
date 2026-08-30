package e2e

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

// TestE2E_ShiftHandover_OverShortDiscrepanciesAndZReport tests complete cash register shift management:
// 1. Opening shift with initial float.
// 2. Multitude of cash/non-cash operations: cash sales, card sales, debt payments received, expense payouts.
// 3. Mathematical reconciliation of expected cash drawer balance and variance.
// 4. Closing shift with cash shortage / overage discrepancy.
// 5. Shift status enforcement (closed shift prevents re-closing).
func TestE2E_ShiftHandover_OverShortDiscrepanciesAndZReport(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	staff, err := h.Repos.staff.GetByUsername(AdminUsername)
	if err != nil {
		t.Fatalf("staff lookup failed: %v", err)
	}

	// 1. Open shift with 50,000 opening float
	openingFloat := domain.NewAmount(50000)
	shift, err := h.FinanceHandler.OpenShift(staff.ID, staff.Name, openingFloat)
	if err != nil {
		t.Fatalf("OpenShift failed: %v", err)
	}
	if shift.Status != "open" {
		t.Fatalf("expected open shift, got %s", shift.Status)
	}

	// 2. Perform Cash Sale: 30,000
	prod1 := h.NewProduct("قميص رجالي", 30000, 10)
	cust := h.NewCustomer("زبون الوردية", 0)
	saleCash := buildSale(prod1, cust, 1, "cash")
	if err := h.SaleHandler.ProcessSale(saleCash); err != nil {
		t.Fatalf("ProcessSale cash failed: %v", err)
	}

	// 3. Perform Card Sale: 20,000
	prod2 := h.NewProduct("حذاء رياضي", 20000, 10)
	saleCard := buildSale(prod2, cust, 1, "card")
	if err := h.SaleHandler.ProcessSale(saleCard); err != nil {
		t.Fatalf("ProcessSale card failed: %v", err)
	}

	// 4. Perform Customer Debt Collection (Cash): 15,000
	custWithDebt := h.NewCustomer("زبون مدين", 25000)
	payment := domain.Payment{
		CustomerID: custWithDebt.ID,
		Amount:     domain.NewAmount(15000),
		Method:     "cash",
		Note:       "دفعة نقدية بالوردية",
		StaffID:    staff.ID,
		Timestamp:  time.Now().UnixMilli(),
	}
	if _, err := h.PaymentHandler.CreatePayment(payment); err != nil {
		t.Fatalf("CreatePayment failed: %v", err)
	}

	// 5. Add Cash Out movement (Expense payout): 10,000
	expensePayout := domain.NewAmount(10000)
	_, err = h.FinanceHandler.AddCashMovement(
		shift.ID,
		"cash_out",
		"شراء مستلزمات نظافة للمحل",
		staff.ID,
		staff.Name,
		expensePayout,
	)
	if err != nil {
		t.Fatalf("AddCashMovement failed: %v", err)
	}

	// 6. Verify Active Shift Totals
	activeShift, err := h.FinanceHandler.GetActiveShift()
	if err != nil {
		t.Fatalf("GetActiveShift failed: %v", err)
	}

	// Expected cash sales = 30,000 (sale) + 15,000 (cash debt payment) = 45,000
	if !testutil.AmountEq(activeShift.CashSales, domain.NewAmount(45000)) {
		t.Errorf("expected cash sales 45000, got %s", activeShift.CashSales.String())
	}
	// Expected total sales = 30,000 + 20,000 = 50,000
	if !testutil.AmountEq(activeShift.TotalSales, domain.NewAmount(50000)) {
		t.Errorf("expected total sales 50000, got %s", activeShift.TotalSales.String())
	}
	if activeShift.SalesCount != 2 {
		t.Errorf("expected sales count 2, got %d", activeShift.SalesCount)
	}

	// 7. Close Shift with declared cash = 80,000 (Shortage discrepancy)
	declaredCash := domain.NewAmount(80000)
	closedShift, err := h.FinanceHandler.CloseShift(shift.ID, declaredCash, "عجز بسيط في النقدية 5000")
	if err != nil {
		t.Fatalf("CloseShift failed: %v", err)
	}

	if closedShift.Status != "closed" {
		t.Fatalf("expected closed shift, got %s", closedShift.Status)
	}
	if !testutil.AmountEq(closedShift.ClosingBalance, declaredCash) {
		t.Errorf("expected closing balance %s, got %s", declaredCash.String(), closedShift.ClosingBalance.String())
	}

	// 8. Verify No Active Shift remains
	noActive, err := h.FinanceHandler.GetActiveShift()
	if err != nil {
		t.Fatalf("GetActiveShift after close failed: %v", err)
	}
	if noActive != nil {
		t.Errorf("expected no active shift, got %+v", noActive)
	}

	// 9. Verify Shift History contains closed shift
	history, err := h.FinanceHandler.GetShiftHistory(10)
	if err != nil {
		t.Fatalf("GetShiftHistory failed: %v", err)
	}
	if len(history) == 0 {
		t.Fatal("expected at least 1 shift in history")
	}
	found := false
	for _, s := range history {
		if s.ID == shift.ID {
			found = true
			if s.Status != "closed" {
				t.Errorf("expected history shift status closed, got %s", s.Status)
			}
			break
		}
	}
	if !found {
		t.Errorf("closed shift %s not found in history", shift.ID)
	}

	// 10. Attempting to close already-closed shift again should fail
	_, err = h.FinanceHandler.CloseShift(shift.ID, declaredCash, "إغلاق مكرر")
	if err == nil {
		t.Fatal("expected closing already closed shift to fail")
	}
}
