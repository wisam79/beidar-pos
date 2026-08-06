package e2e

import (
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
	"beidar-desktop/pkg/auth"
)

func TestE2E_CreatePaymentReducesDebt(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("شاشة", 150000, 4)
	customer := h.NewCustomer("زبون دين", 0)

	sale := buildCreditSale(product, customer, 1)
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}
	if got := h.MustReloadCustomer(customer.ID).Debt; !testutil.AmountEq(got, domain.NewAmount(150000)) {
		t.Fatalf("setup: debt = %s, want 150000", got.String())
	}

	payment, err := h.PaymentHandler.CreatePayment(domain.Payment{
		SaleID:     sale.ID,
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(50000),
		Method:     "cash",
		StaffID:    auth.CurrentStaffID(),
	})
	if err != nil {
		t.Fatalf("CreatePayment failed: %v", err)
	}
	if payment.ID == 0 {
		t.Fatal("expected payment ID to be assigned")
	}

	if got := h.MustReloadCustomer(customer.ID).Debt; !testutil.AmountEq(got, domain.NewAmount(100000)) {
		t.Errorf("debt after payment = %s, want 100000", got.String())
	}

	// Payments are retrievable by sale and customer. The credit sale itself
	// creates one ledger row (method=credit); the manual payment is a second row.
	bySale, err := h.PaymentHandler.GetPaymentsBySale(sale.ID)
	if err != nil {
		t.Fatalf("GetPaymentsBySale failed: %v", err)
	}
	if len(bySale) != 2 {
		t.Errorf("payments by sale = %d, want 2", len(bySale))
	}
	var foundCashPayment bool
	for _, p := range bySale {
		if p.Method == "cash" && testutil.AmountEq(p.Amount, domain.NewAmount(50000)) {
			foundCashPayment = true
		}
	}
	if !foundCashPayment {
		t.Error("expected a cash payment of 50000 in the payment ledger")
	}

	byCustomer, err := h.PaymentHandler.GetPaymentsByCustomer(customer.ID)
	if err != nil {
		t.Fatalf("GetPaymentsByCustomer failed: %v", err)
	}
	if len(byCustomer) != 2 {
		t.Errorf("payments by customer = %d, want 2", len(byCustomer))
	}
}

func TestE2E_OverpaymentRequiresForcePermission(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	customer := h.NewCustomer("زبون دفعة زائدة", 1000)

	_, err := h.PaymentHandler.CreatePayment(domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(2000),
		Method:     "cash",
	})
	if err == nil {
		t.Fatal("overpayment should be rejected")
	}

	// Manager can force the overpayment.
	if err := h.PaymentHandler.CreatePaymentForced(domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(2000),
		Method:     "cash",
		StaffID:    auth.CurrentStaffID(),
	}); err != nil {
		t.Fatalf("CreatePaymentForced failed: %v", err)
	}
}

func TestE2E_InstallmentPlanSplitsAndLastInstallmentBalances(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	plan, err := h.PaymentHandler.CalculateInstallmentPlan(
		domain.NewAmount(1000000), domain.NewAmount(250000), 3,
	)
	if err != nil {
		t.Fatalf("CalculateInstallmentPlan failed: %v", err)
	}
	if plan.Months != 3 {
		t.Errorf("months = %d, want 3", plan.Months)
	}
	if !testutil.AmountEq(plan.DownPayment, domain.NewAmount(250000)) {
		t.Errorf("downPayment = %s, want 250000", plan.DownPayment.String())
	}
	if len(plan.Schedule) != 3 {
		t.Fatalf("schedule length = %d, want 3", len(plan.Schedule))
	}

	// The sum of installments must equal the remaining balance exactly.
	var sum domain.Amount
	for _, inst := range plan.Schedule {
		sum = sum.Add(inst.Amount)
	}
	remaining := domain.NewAmount(1000000).Sub(domain.NewAmount(250000))
	if !testutil.AmountEq(sum, remaining) {
		t.Errorf("installments sum = %s, want remaining %s", sum.String(), remaining.String())
	}
}

func TestE2E_InstallmentSaleAndPayment(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("براد", 600000, 2)
	customer := h.NewCustomer("زبون أقساط", 0)

	price := product.Price
	total := price
	sale := domain.Sale{
		ID:            newSaleID(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		StaffID:       auth.CurrentStaffID(),
		Date:          "2026-01-15",
		Timestamp:     1768464000000,
		Subtotal:      total,
		Total:         total,
		PaymentMethod: "installment",
		Status:        "pending",
		ItemsCount:    1,
		InstallmentPlan: &domain.InstallmentPlan{
			TotalAmount: total,
			DownPayment: domain.NewAmount(100000),
			Months:      5,
			Schedule: []domain.Installment{
				{Number: 1, DueDate: "2026-02-15", Amount: domain.NewAmount(100000), Status: "pending"},
				{Number: 2, DueDate: "2026-03-15", Amount: domain.NewAmount(100000), Status: "pending"},
				{Number: 3, DueDate: "2026-04-15", Amount: domain.NewAmount(100000), Status: "pending"},
				{Number: 4, DueDate: "2026-05-15", Amount: domain.NewAmount(100000), Status: "pending"},
				{Number: 5, DueDate: "2026-06-15", Amount: domain.NewAmount(100000), Status: "pending"},
			},
		},
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  1,
			Price:     price,
			Total:     total,
		}},
	}
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale installment failed: %v", err)
	}

	// Pay the first installment.
	if err := h.PaymentHandler.PayInstallment(sale.ID, 0, domain.NewAmount(100000), "cash"); err != nil {
		t.Fatalf("PayInstallment failed: %v", err)
	}

	summary, err := h.PaymentHandler.GetInstallmentSummary(sale.ID)
	if err != nil {
		t.Fatalf("GetInstallmentSummary failed: %v", err)
	}
	if summary.Total != 5 {
		t.Errorf("total installments = %d, want 5", summary.Total)
	}
	if summary.Paid != 1 {
		t.Errorf("paid installments = %d, want 1", summary.Paid)
	}
	if !testutil.AmountEq(summary.Remaining, domain.NewAmount(400000)) {
		t.Errorf("remaining = %s, want 400000", summary.Remaining.String())
	}

	// Installment sales are listed.
	instSales, err := h.SaleHandler.GetInstallmentSales()
	if err != nil {
		t.Fatalf("GetInstallmentSales failed: %v", err)
	}
	found := false
	for _, s := range instSales {
		if s.ID == sale.ID {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("installment sale %s not found in GetInstallmentSales", sale.ID)
	}
}
