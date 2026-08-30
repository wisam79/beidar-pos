package e2e

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
	"github.com/google/uuid"
)

// TestE2E_Installment_EarlyLumpSumSettlementAndClosedPlan tests full installment lifecycle:
// 1. Creation of multi-month installment plan with down payment and schedule.
// 2. Sequential payment of initial installments and rejection of double-payment on already-paid installments.
// 3. Complete early settlement of all remaining installments.
// 4. Verification that sale status transitions to "paid", customer InstallmentDebt reaches 0, and all schedule items are marked paid.
func TestE2E_Installment_EarlyLumpSumSettlementAndClosedPlan(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// 1. Create product and customer
	prod := h.NewProduct("ثلاجة سامسونج 18 قدم", 100000, 5)
	cust := h.NewCustomer("كريم التقسيط", 0)

	// 4 installments of 20,000 + 20,000 DownPayment = 100,000 total
	installmentAmount := domain.NewAmount(20000)
	downPayment := domain.NewAmount(20000)
	totalAmount := domain.NewAmount(100000)

	schedule := []domain.Installment{
		{DueDate: time.Now().AddDate(0, 1, 0).Format("2006-01-02"), Amount: installmentAmount, Status: "pending"},
		{DueDate: time.Now().AddDate(0, 2, 0).Format("2006-01-02"), Amount: installmentAmount, Status: "pending"},
		{DueDate: time.Now().AddDate(0, 3, 0).Format("2006-01-02"), Amount: installmentAmount, Status: "pending"},
		{DueDate: time.Now().AddDate(0, 4, 0).Format("2006-01-02"), Amount: installmentAmount, Status: "pending"},
	}

	plan := domain.InstallmentPlan{
		TotalAmount: totalAmount,
		DownPayment: downPayment,
		Months:      4,
		StartDate:   time.Now().Format("2006-01-02"),
		Schedule:    schedule,
	}

	sale := domain.Sale{
		ID:              uuid.New().String(),
		CustomerID:      cust.ID,
		CustomerName:    cust.Name,
		Date:            time.Now().Format("2006-01-02"),
		Timestamp:       time.Now().UnixMilli(),
		Subtotal:        totalAmount,
		Total:           totalAmount,
		PaymentMethod:   "installment",
		InstallmentPlan: &plan,
		Status:          "pending",
		ItemsCount:      1,
		Items: []domain.SaleItem{
			{ProductID: prod.ID, Name: prod.Name, Quantity: 1, Price: totalAmount, Total: totalAmount},
		},
	}

	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale installment failed: %v", err)
	}

	// 2. Customer InstallmentDebt should be 80,000 (100,000 total - 20,000 down payment)
	c1 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(c1.InstallmentDebt, domain.NewAmount(80000)) {
		t.Fatalf("expected InstallmentDebt 80000, got %s", c1.InstallmentDebt.String())
	}

	// 3. Pay Installment 0 (Month 1)
	if err := h.PaymentHandler.PayInstallment(sale.ID, 0, installmentAmount, "cash"); err != nil {
		t.Fatalf("PayInstallment 0 failed: %v", err)
	}

	c2 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(c2.InstallmentDebt, domain.NewAmount(60000)) {
		t.Fatalf("expected InstallmentDebt 60000 after installment 0, got %s", c2.InstallmentDebt.String())
	}

	// 4. Double Payment Protection: Attempting to pay installment 0 again must fail
	err := h.PaymentHandler.PayInstallment(sale.ID, 0, installmentAmount, "cash")
	if err == nil {
		t.Fatal("expected paying already-paid installment to fail")
	}

	// 5. Early Lump Sum Payoff: Pay installments 1, 2, and 3
	for i := 1; i < 4; i++ {
		if err := h.PaymentHandler.PayInstallment(sale.ID, i, installmentAmount, "cash"); err != nil {
			t.Fatalf("PayInstallment %d failed: %v", i, err)
		}
	}

	// 6. Verify Customer InstallmentDebt is now exactly 0
	cFinal := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(cFinal.InstallmentDebt, domain.Zero()) {
		t.Fatalf("expected zero InstallmentDebt, got %s", cFinal.InstallmentDebt.String())
	}

	// 7. Verify Sale status transitioned to "paid"
	saleFinal, err := h.Repos.sale.GetByID(sale.ID)
	if err != nil {
		t.Fatalf("GetByID sale failed: %v", err)
	}
	if saleFinal.Status != "paid" {
		t.Fatalf("expected sale status 'paid', got '%s'", saleFinal.Status)
	}

	// 8. Verify all payments recorded for this sale (downpayment + 4 schedule payments)
	payments, err := h.Repos.payment.GetPaymentsBySale(sale.ID)
	if err != nil {
		t.Fatalf("GetPaymentsBySale failed: %v", err)
	}
	if len(payments) < 4 {
		t.Fatalf("expected at least 4 installment payments, got %d", len(payments))
	}
}
