package e2e

import (
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestE2E_ExpenseLifecycle(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	if err := h.FinanceHandler.SaveExpense(domain.Expense{
		Title:    "إيجار المحل",
		Amount:   domain.NewAmount(300000),
		Date:     "2026-01-10",
		Category: "إيجار",
	}); err != nil {
		t.Fatalf("SaveExpense failed: %v", err)
	}

	expenses, err := h.FinanceHandler.GetExpenses("2026-01")
	if err != nil {
		t.Fatalf("GetExpenses failed: %v", err)
	}
	if len(expenses) != 1 {
		t.Fatalf("expenses = %d, want 1", len(expenses))
	}
	if !testutil.AmountEq(expenses[0].Amount, domain.NewAmount(300000)) {
		t.Errorf("expense amount = %s, want 300000", expenses[0].Amount.String())
	}

	if err := h.FinanceHandler.DeleteExpense(expenses[0].ID); err != nil {
		t.Fatalf("DeleteExpense failed: %v", err)
	}

	expenses, _ = h.FinanceHandler.GetExpenses("2026-01")
	if len(expenses) != 0 {
		t.Errorf("expenses after delete = %d, want 0", len(expenses))
	}
}

func TestE2E_CategoryLifecycle(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	if err := h.FinanceHandler.SaveCategory(domain.Category{Name: "الكترونيات"}); err != nil {
		t.Fatalf("SaveCategory failed: %v", err)
	}

	categories, err := h.FinanceHandler.GetCategories()
	if err != nil {
		t.Fatalf("GetCategories failed: %v", err)
	}
	if len(categories) != 1 {
		t.Fatalf("categories = %d, want 1", len(categories))
	}

	if err := h.FinanceHandler.DeleteCategory(categories[0].ID, true); err != nil {
		t.Fatalf("DeleteCategory failed: %v", err)
	}
}

func TestE2E_OpenAndCloseShift(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	staff, err := h.Repos.staff.GetByUsername(AdminUsername)
	if err != nil {
		t.Fatalf("load admin failed: %v", err)
	}

	shift, err := h.FinanceHandler.OpenShift(staff.ID, staff.Name, domain.NewAmount(50000))
	if err != nil {
		t.Fatalf("OpenShift failed: %v", err)
	}

	active, err := h.FinanceHandler.GetActiveShift()
	if err != nil {
		t.Fatalf("GetActiveShift failed: %v", err)
	}
	if active == nil || active.ID != shift.ID {
		t.Fatalf("active shift mismatch: got %v", active)
	}

	// Add a cash movement in and out.
	move, err := h.FinanceHandler.AddCashMovement(shift.ID, "cash_in", "سحب للأجور", staff.ID, staff.Name, domain.NewAmount(10000))
	if err != nil {
		t.Fatalf("AddCashMovement failed: %v", err)
	}
	if move.ShiftID != shift.ID {
		t.Errorf("movement shift = %s, want %s", move.ShiftID, shift.ID)
	}

	movements, err := h.FinanceHandler.GetShiftMovements(shift.ID)
	if err != nil {
		t.Fatalf("GetShiftMovements failed: %v", err)
	}
	if len(movements) != 1 {
		t.Errorf("movements = %d, want 1", len(movements))
	}

	closed, err := h.FinanceHandler.CloseShift(shift.ID, domain.NewAmount(60000), "نهاية الوردية")
	if err != nil {
		t.Fatalf("CloseShift failed: %v", err)
	}
	if closed.Status != "closed" {
		t.Errorf("shift status = %s, want closed", closed.Status)
	}

	// Shift history reflects the closed shift.
	history, err := h.FinanceHandler.GetShiftHistory(10)
	if err != nil {
		t.Fatalf("GetShiftHistory failed: %v", err)
	}
	if len(history) < 1 {
		t.Errorf("shift history empty, want at least 1")
	}
}

func TestE2E_CloseShiftTriggersBackgroundBackupButDoesNotError(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	staff, err := h.Repos.staff.GetByUsername(AdminUsername)
	if err != nil {
		t.Fatalf("staff lookup failed: %v", err)
	}

	shift, err := h.FinanceHandler.OpenShift(staff.ID, staff.Name, domain.NewAmount(0))
	if err != nil {
		t.Fatalf("OpenShift failed: %v", err)
	}

	// CloseShift triggers a fire-and-forget background backup goroutine; it must
	// still return the closed shift without an error.
	closed, err := h.FinanceHandler.CloseShift(shift.ID, domain.NewAmount(0), "")
	if err != nil {
		t.Fatalf("CloseShift failed: %v", err)
	}
	if closed.Status != "closed" {
		t.Errorf("shift status = %s, want closed", closed.Status)
	}
}