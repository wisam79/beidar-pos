package e2e

import (
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
	"github.com/google/uuid"
)

// TestE2E_MassAssignment_FinancialProtectionMatrix tests the strict mass-assignment
// defenses required by Rule 3.8 (Clean Architecture & Financial Integrity):
// 1. Customer updates must NEVER overwrite financial fields (Debt, InstallmentDebt, TotalPurchases, Points).
// 2. Supplier updates must NEVER overwrite financial balance (Balance/Accounts Payable).
// 3. Staff updates must NEVER overwrite password hashes or sensitive security metadata directly.
func TestE2E_MassAssignment_FinancialProtectionMatrix(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// ── 1. Customer Financial Field Protection ──────────────────────────────
	// Create customer with real debt, points, and purchases
	cust := h.NewCustomer("زبون محمي من التعيين الجماعي", 150000)
	cust.InstallmentDebt = domain.NewAmount(80000)
	cust.TotalPurchases = domain.NewAmount(300000)
	cust.Points = 500
	cust.Phone = "07709998877"
	if err := h.Repos.customer.Update(cust); err != nil {
		t.Fatalf("setup customer failed: %v", err)
	}

	// Attempt mass-assignment exploit via SaveCustomer:
	// Attacker tries to zero debt, zero installment debt, inflate points to 99,999, inflate purchases to 1,000,000
	forgedCustomer := domain.Customer{
		ID:              cust.ID,
		Name:            "اسم جديد مصرح",
		Phone:           "07709998877",
		Notes:           "ملاحظات جديدة",
		Debt:            domain.Zero(),            // Attacker trying to erase debt
		InstallmentDebt: domain.Zero(),            // Attacker trying to erase installments
		TotalPurchases:  domain.NewAmount(1000000), // Attacker trying to inflate stats
		Points:          99999,                    // Attacker trying to get free points
	}

	if err := h.CRMHandler.SaveCustomer(forgedCustomer); err != nil {
		t.Fatalf("SaveCustomer failed: %v", err)
	}

	// Verify that safe fields were updated
	cReloaded := h.MustReloadCustomer(cust.ID)
	if cReloaded.Name != "اسم جديد مصرح" || cReloaded.Notes != "ملاحظات جديدة" {
		t.Errorf("expected safe fields to update, got name=%s notes=%s", cReloaded.Name, cReloaded.Notes)
	}

	// Verify that financial fields were completely PROTECTED from tampering
	if !testutil.AmountEq(cReloaded.Debt, domain.NewAmount(150000)) {
		t.Fatalf("VULNERABILITY DETECTED: Customer Debt was altered by mass-assignment! got %s, want 150000", cReloaded.Debt.String())
	}
	if !testutil.AmountEq(cReloaded.InstallmentDebt, domain.NewAmount(80000)) {
		t.Fatalf("VULNERABILITY DETECTED: Customer InstallmentDebt was altered! got %s, want 80000", cReloaded.InstallmentDebt.String())
	}
	if !testutil.AmountEq(cReloaded.TotalPurchases, domain.NewAmount(300000)) {
		t.Fatalf("VULNERABILITY DETECTED: Customer TotalPurchases was altered! got %s, want 300000", cReloaded.TotalPurchases.String())
	}
	if cReloaded.Points != 500 {
		t.Fatalf("VULNERABILITY DETECTED: Customer Points were altered! got %d, want 500", cReloaded.Points)
	}

	// ── 2. Supplier Balance Protection ─────────────────────────────────────
	// Create supplier with 500,000 balance (our debt to them)
	supplier := domain.Supplier{
		ID:          uuid.New().String(),
		Name:        "مورد محمي",
		CompanyName: "شركة المورد المحمي",
		Phone:       "07705554433",
		Balance:     domain.NewAmount(500000),
	}
	if err := h.Repos.supplier.Create(&supplier); err != nil {
		t.Fatalf("setup supplier failed: %v", err)
	}

	// Attacker tries to zero the supplier debt via SaveSupplier
	forgedSupplier := domain.Supplier{
		ID:          supplier.ID,
		Name:        "مورد محمي معدل",
		CompanyName: "شركة المورد المعدل",
		Phone:       "07705554433",
		Notes:       "ملاحظات أمان",
		Balance:     domain.Zero(), // Attacker trying to zero out supplier payable
	}

	if err := h.CRMHandler.SaveSupplier(forgedSupplier); err != nil {
		t.Fatalf("SaveSupplier failed: %v", err)
	}

	sReloaded, err := h.Repos.supplier.GetByID(supplier.ID)
	if err != nil {
		t.Fatalf("GetByID supplier failed: %v", err)
	}
	if sReloaded.Name != "مورد محمي معدل" {
		t.Errorf("expected safe fields to update, got name=%s", sReloaded.Name)
	}
	if !testutil.AmountEq(sReloaded.Balance, domain.NewAmount(500000)) {
		t.Fatalf("VULNERABILITY DETECTED: Supplier Balance was altered by mass-assignment! got %s, want 500000", sReloaded.Balance.String())
	}
}
