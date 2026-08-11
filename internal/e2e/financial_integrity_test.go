package e2e

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
	"beidar-desktop/pkg/auth"

	"github.com/google/uuid"
)

// TestE2E_FullSaleLifecycle_CashToReturn drives the complete lifecycle of a cash sale:
// sale creation -> stock decremented -> active shift updated -> full return ->
// stock restored -> shift cash refunded -> ledger refund recorded.
func TestE2E_FullSaleLifecycle_CashToReturn(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	staff, err := h.Repos.staff.GetByUsername(AdminUsername)
	if err != nil {
		t.Fatalf("staff lookup failed: %v", err)
	}

	// 1. Open shift with 50,000 opening balance
	shift, err := h.FinanceHandler.OpenShift(staff.ID, staff.Name, domain.NewAmount(50000))
	if err != nil {
		t.Fatalf("OpenShift failed: %v", err)
	}

	product := h.NewProduct("سماعة بلوتوث", 15000, 10)
	customer := h.NewCustomer("زبون دورة البيع", 0)

	// 2. Process cash sale of 2 units (Total = 30,000)
	sale := buildSale(product, customer, 2, "cash")
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Verify product stock reduced from 10 to 8
	pReloaded := h.MustReloadProduct(product.ID)
	if pReloaded.Stock != 8 {
		t.Errorf("stock after sale = %v, want 8", pReloaded.Stock)
	}

	// Customer purchases incremented, debt unchanged (0)
	cReloaded := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(cReloaded.TotalPurchases, domain.NewAmount(30000)) {
		t.Errorf("total purchases = %s, want 30000", cReloaded.TotalPurchases.String())
	}
	if !testutil.AmountEq(cReloaded.Debt, domain.Zero()) {
		t.Errorf("debt = %s, want 0", cReloaded.Debt.String())
	}

	// Active shift reflects cash sales
	activeShift, err := h.FinanceHandler.GetActiveShift()
	if err != nil {
		t.Fatalf("GetActiveShift failed: %v", err)
	}
	if !testutil.AmountEq(activeShift.CashSales, domain.NewAmount(30000)) {
		t.Errorf("shift cash sales = %s, want 30000", activeShift.CashSales.String())
	}
	if !testutil.AmountEq(activeShift.ExpectedBalance, domain.NewAmount(80000)) {
		t.Errorf("shift expected balance = %s, want 80000", activeShift.ExpectedBalance.String())
	}

	// 3. Full Return of the sale
	if err := h.SaleHandler.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale failed: %v", err)
	}

	// Stock restored to 10
	pAfterReturn := h.MustReloadProduct(product.ID)
	if pAfterReturn.Stock != 10 {
		t.Errorf("stock after return = %v, want 10", pAfterReturn.Stock)
	}

	// Customer purchases decremented back to 0
	cAfterReturn := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(cAfterReturn.TotalPurchases, domain.Zero()) {
		t.Errorf("total purchases after return = %s, want 0", cAfterReturn.TotalPurchases.String())
	}

	// Shift cash refunded back to opening balance (50,000)
	activeAfterReturn, err := h.FinanceHandler.GetActiveShift()
	if err != nil {
		t.Fatalf("GetActiveShift after return failed: %v", err)
	}
	if !testutil.AmountEq(activeAfterReturn.CashSales, domain.Zero()) {
		t.Errorf("shift cash sales after return = %s, want 0", activeAfterReturn.CashSales.String())
	}
	if !testutil.AmountEq(activeAfterReturn.ExpectedBalance, domain.NewAmount(50000)) {
		t.Errorf("shift expected balance after return = %s, want 50000", activeAfterReturn.ExpectedBalance.String())
	}

	// Sale status marked "returned"
	saleReloaded, err := h.SaleHandler.GetSale(sale.ID)
	if err != nil {
		t.Fatalf("GetSale failed: %v", err)
	}
	if saleReloaded.Status != "returned" {
		t.Errorf("sale status = %q, want returned", saleReloaded.Status)
	}

	// Refund ledger row recorded
	payments, err := h.PaymentHandler.GetPaymentsBySale(sale.ID)
	if err != nil {
		t.Fatalf("GetPaymentsBySale failed: %v", err)
	}
	var hasNegativeRefund bool
	for _, p := range payments {
		if p.Amount.IsNegative() && testutil.AmountEq(p.Amount, -sale.Total) {
			hasNegativeRefund = true
		}
	}
	if !hasNegativeRefund {
		t.Errorf("expected a negative refund payment of -%s on the ledger", sale.Total.String())
	}

	// Close shift cleanly
	closed, err := h.FinanceHandler.CloseShift(shift.ID, domain.NewAmount(50000), "إغلاق بعد المرتجع")
	if err != nil {
		t.Fatalf("CloseShift failed: %v", err)
	}
	if !testutil.AmountEq(closed.Variance, domain.Zero()) {
		t.Errorf("shift variance = %s, want 0", closed.Variance.String())
	}
}

// TestE2E_InstallmentLifecycle_CreateToFullPayoff creates an installment sale,
// processes payments one by one, verifies atomic installment debt decrements,
// and ensures final transition of the sale to "paid".
func TestE2E_InstallmentLifecycle_CreateToFullPayoff(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	staff, _ := h.Repos.staff.GetByUsername(AdminUsername)
	shift, err := h.FinanceHandler.OpenShift(staff.ID, staff.Name, domain.Zero())
	if err != nil {
		t.Fatalf("OpenShift failed: %v", err)
	}

	product := h.NewProduct("ثلاجة ذكية", 400000, 4)
	customer := h.NewCustomer("زبون أقساط كامل", 0)

	// Down payment = 100,000; 3 installments of 100,000 each = Total 400,000
	down := domain.NewAmount(100000)
	monthly := []domain.Amount{
		domain.NewAmount(100000),
		domain.NewAmount(100000),
		domain.NewAmount(100000),
	}
	sale := buildInstallmentSale(product, customer, down, monthly)
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale installment failed: %v", err)
	}

	// Stock decremented
	if got := h.MustReloadProduct(product.ID).Stock; got != 3 {
		t.Errorf("stock after sale = %v, want 3", got)
	}

	// Customer regular debt = 0, installment debt = 300,000 (financed portion)
	c := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.Debt, domain.Zero()) {
		t.Errorf("regular debt = %s, want 0", c.Debt.String())
	}
	if !testutil.AmountEq(c.InstallmentDebt, domain.NewAmount(300000)) {
		t.Errorf("installment debt = %s, want 300000", c.InstallmentDebt.String())
	}

	// Down payment recorded into active shift
	active, _ := h.FinanceHandler.GetActiveShift()
	if !testutil.AmountEq(active.CashSales, domain.NewAmount(100000)) {
		t.Errorf("shift cash sales after down payment = %s, want 100000", active.CashSales.String())
	}

	// Pay installment 0
	if err := h.PaymentHandler.PayInstallment(sale.ID, 0, monthly[0], "cash"); err != nil {
		t.Fatalf("PayInstallment(0) failed: %v", err)
	}
	c = h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.InstallmentDebt, domain.NewAmount(200000)) {
		t.Errorf("installment debt after inst 0 = %s, want 200000", c.InstallmentDebt.String())
	}

	// Pay installment 1
	if err := h.PaymentHandler.PayInstallment(sale.ID, 1, monthly[1], "cash"); err != nil {
		t.Fatalf("PayInstallment(1) failed: %v", err)
	}
	c = h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.InstallmentDebt, domain.NewAmount(100000)) {
		t.Errorf("installment debt after inst 1 = %s, want 100000", c.InstallmentDebt.String())
	}

	// Pay installment 2 (final)
	if err := h.PaymentHandler.PayInstallment(sale.ID, 2, monthly[2], "cash"); err != nil {
		t.Fatalf("PayInstallment(2) failed: %v", err)
	}
	c = h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.InstallmentDebt, domain.Zero()) {
		t.Errorf("installment debt after payoff = %s, want 0", c.InstallmentDebt.String())
	}

	// Sale marked as paid
	reloadedSale, err := h.SaleHandler.GetSale(sale.ID)
	if err != nil {
		t.Fatalf("GetSale failed: %v", err)
	}
	if reloadedSale.Status != "paid" {
		t.Errorf("sale status = %q, want paid", reloadedSale.Status)
	}

	// Installment summary verified
	summary, err := h.PaymentHandler.GetInstallmentSummary(sale.ID)
	if err != nil {
		t.Fatalf("GetInstallmentSummary failed: %v", err)
	}
	if summary.Total != 3 || summary.Paid != 3 {
		t.Errorf("summary total/paid = %d/%d, want 3/3", summary.Total, summary.Paid)
	}
	if !testutil.AmountEq(summary.Remaining, domain.Zero()) {
		t.Errorf("summary remaining = %s, want 0", summary.Remaining.String())
	}

	// Shift collected all 400,000 cash
	active, _ = h.FinanceHandler.GetActiveShift()
	if !testutil.AmountEq(active.CashSales, domain.NewAmount(400000)) {
		t.Errorf("shift cash sales after full payoff = %s, want 400000", active.CashSales.String())
	}

	_, _ = h.FinanceHandler.CloseShift(shift.ID, domain.NewAmount(400000), "إغلاق")
}

// TestE2E_CreditSale_PartialReturn_DebtRecalculation tests partial returns on a
// multi-item credit sale, verifying precise stock restoration and debt reductions.
func TestE2E_CreditSale_PartialReturn_DebtRecalculation(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	p1 := h.NewProduct("كيبورد", 10000, 10)
	p2 := h.NewProduct("ماوس ألعاب", 25000, 10)
	customer := h.NewCustomer("زبون آجل متعدد", 20000)

	// Multi-item credit sale:
	// - 2 units of p1 (20,000)
	// - 2 units of p2 (50,000)
	// Total = 70,000
	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		StaffID:       auth.CurrentStaffID(),
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      domain.NewAmount(70000),
		Total:         domain.NewAmount(70000),
		PaymentMethod: "credit",
		Status:        "pending",
		ItemsCount:    4,
		Items: []domain.SaleItem{
			{ProductID: p1.ID, Name: p1.Name, Quantity: 2, Price: p1.Price, Total: domain.NewAmount(20000)},
			{ProductID: p2.ID, Name: p2.Name, Quantity: 2, Price: p2.Price, Total: domain.NewAmount(50000)},
		},
	}
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Debt: initial (20,000) + sale (70,000) = 90,000
	c := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.Debt, domain.NewAmount(90000)) {
		t.Fatalf("debt after sale = %s, want 90000", c.Debt.String())
	}
	if got := h.MustReloadProduct(p1.ID).Stock; got != 8 {
		t.Errorf("p1 stock = %v, want 8", got)
	}
	if got := h.MustReloadProduct(p2.ID).Stock; got != 8 {
		t.Errorf("p2 stock = %v, want 8", got)
	}

	// 1. Partial return 1: 1 unit of p1 (10,000 value)
	if err := h.SaleHandler.ReturnSalePartial(sale.ID, p1.ID, 1); err != nil {
		t.Fatalf("ReturnSalePartial(p1) failed: %v", err)
	}

	// p1 stock restored to 9
	if got := h.MustReloadProduct(p1.ID).Stock; got != 9 {
		t.Errorf("p1 stock after return = %v, want 9", got)
	}

	// Customer debt reduced by 10,000 to 80,000
	c = h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.Debt, domain.NewAmount(80000)) {
		t.Errorf("debt after 1st return = %s, want 80000", c.Debt.String())
	}

	// 2. Partial return 2: 1 unit of p2 (25,000 value)
	if err := h.SaleHandler.ReturnSalePartial(sale.ID, p2.ID, 1); err != nil {
		t.Fatalf("ReturnSalePartial(p2) failed: %v", err)
	}

	// p2 stock restored to 9
	if got := h.MustReloadProduct(p2.ID).Stock; got != 9 {
		t.Errorf("p2 stock after return = %v, want 9", got)
	}

	// Customer debt reduced by 25,000 to 55,000
	c = h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.Debt, domain.NewAmount(55000)) {
		t.Errorf("debt after 2nd return = %s, want 55000", c.Debt.String())
	}

	// Sale status is partial_return
	reloadedSale, err := h.SaleHandler.GetSale(sale.ID)
	if err != nil {
		t.Fatalf("GetSale failed: %v", err)
	}
	if reloadedSale.Status != "partial_return" {
		t.Errorf("sale status = %q, want partial_return", reloadedSale.Status)
	}
}

// TestE2E_PurchaseOrder_FullWorkflow exercises the complete purchase order workflow:
// Create PO -> Receive items (stock increases) -> Pay PO in installments (supplier stats).
func TestE2E_PurchaseOrder_FullWorkflow(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	if err := h.CRMHandler.SaveSupplier(domain.Supplier{Name: "مورد التقنية الحديثة", Phone: "07700000003"}); err != nil {
		t.Fatalf("SaveSupplier failed: %v", err)
	}
	suppliers, err := h.CRMHandler.GetSuppliers()
	if err != nil || len(suppliers) == 0 {
		t.Fatalf("GetSuppliers failed: %v", err)
	}
	supplierID := suppliers[0].ID

	product := domain.Product{
		ID:       newSaleID(),
		Name:     "محرك كهربائي",
		Price:    domain.NewAmount(50000),
		Cost:     domain.NewAmount(30000),
		Stock:    5,
		Category: "محركات",
	}
	if err := h.ProductHandler.CreateProduct(product); err != nil {
		t.Fatalf("CreateProduct failed: %v", err)
	}

	// 1. Create Purchase Order for 10 units at 30,000 each = 300,000
	po, err := h.FinanceHandler.CreatePurchaseOrder(domain.PurchaseOrder{
		SupplierID: supplierID,
		Note:       "أمر شراء المحركات",
		Items: []domain.PurchaseOrderItem{
			{ProductID: product.ID, ProductName: product.Name, Quantity: 10, UnitCost: domain.NewAmount(30000)},
		},
	})
	if err != nil {
		t.Fatalf("CreatePurchaseOrder failed: %v", err)
	}
	if po.Status != domain.POStatusPending {
		t.Errorf("status = %q, want pending", po.Status)
	}

	// Stock is still 5 before receiving
	if got := h.MustReloadProduct(product.ID).Stock; got != 5 {
		t.Errorf("stock before receive = %v, want 5", got)
	}

	// 2. Receive the order (10 units)
	if err := h.FinanceHandler.ReceivePurchaseOrder(po.ID, []domain.PurchaseOrderItem{
		{ProductID: product.ID, ProductName: product.Name, Quantity: 10, ReceivedQty: 10, UnitCost: domain.NewAmount(30000)},
	}); err != nil {
		t.Fatalf("ReceivePurchaseOrder failed: %v", err)
	}

	// Stock increased from 5 to 15
	if got := h.MustReloadProduct(product.ID).Stock; got != 15 {
		t.Errorf("stock after receive = %v, want 15", got)
	}

	// 3. Pay the PO in two legs (100,000 cash + 200,000 bank)
	if err := h.FinanceHandler.PayPurchaseOrder(po.ID, domain.NewAmount(100000), "cash"); err != nil {
		t.Fatalf("PayPurchaseOrder leg 1 failed: %v", err)
	}
	if err := h.FinanceHandler.PayPurchaseOrder(po.ID, domain.NewAmount(200000), "bank"); err != nil {
		t.Fatalf("PayPurchaseOrder leg 2 failed: %v", err)
	}

	// 4. Verify PO stats
	stats, err := h.FinanceHandler.GetPurchaseOrderStats()
	if err != nil {
		t.Fatalf("GetPurchaseOrderStats failed: %v", err)
	}
	if stats.TotalOrders != 1 {
		t.Errorf("total orders = %d, want 1", stats.TotalOrders)
	}
	if !testutil.AmountEq(stats.TotalValue, domain.NewAmount(300000)) {
		t.Errorf("total value = %s, want 300000", stats.TotalValue.String())
	}
	if !testutil.AmountEq(stats.TotalPaid, domain.NewAmount(300000)) {
		t.Errorf("total paid = %s, want 300000", stats.TotalPaid.String())
	}
	if !testutil.AmountEq(stats.TotalUnpaid, domain.Zero()) {
		t.Errorf("total unpaid = %s, want 0", stats.TotalUnpaid.String())
	}
}

// TestE2E_ExpenseAndShift_DailyReconciliation verifies daily financial reconciliation:
// Opening shift -> cash sales + movements + expenses -> Close shift with exact balance.
func TestE2E_ExpenseAndShift_DailyReconciliation(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	staff, _ := h.Repos.staff.GetByUsername(AdminUsername)
	shift, err := h.FinanceHandler.OpenShift(staff.ID, staff.Name, domain.NewAmount(100000))
	if err != nil {
		t.Fatalf("OpenShift failed: %v", err)
	}

	product := h.NewProduct("منتج تسوية", 10000, 100)
	customer := h.NewCustomer("زبون تسوية", 0)

	// Cash sale 1: 30,000 (3 units)
	if err := h.SaleHandler.ProcessSale(buildSale(product, customer, 3, "cash")); err != nil {
		t.Fatalf("sale 1 failed: %v", err)
	}
	// Cash sale 2: 20,000 (2 units)
	if err := h.SaleHandler.ProcessSale(buildSale(product, customer, 2, "cash")); err != nil {
		t.Fatalf("sale 2 failed: %v", err)
	}

	// Cash in movement: +15,000 (e.g. change added)
	if _, err := h.FinanceHandler.AddCashMovement(shift.ID, "cash_in", "صرف إضافي", staff.ID, staff.Name, domain.NewAmount(15000)); err != nil {
		t.Fatalf("cash_in movement failed: %v", err)
	}

	// Cash out movement: -5,000 (e.g. small petty cash)
	if _, err := h.FinanceHandler.AddCashMovement(shift.ID, "cash_out", "شراء مستلزمات", staff.ID, staff.Name, domain.NewAmount(5000)); err != nil {
		t.Fatalf("cash_out movement failed: %v", err)
	}

	// General expense: 12,000 (stored in expense ledger)
	if err := h.FinanceHandler.SaveExpense(domain.Expense{
		Title:    "فواتير كهرباء",
		Amount:   domain.NewAmount(12000),
		Date:     time.Now().Format("2006-01-02"),
		Category: "تشغيل",
	}); err != nil {
		t.Fatalf("SaveExpense failed: %v", err)
	}

	// Calculation:
	// Opening: 100,000
	// Cash Sales: 30,000 + 20,000 = 50,000
	// Cash In: 15,000
	// Cash Out: 5,000
	// Expected Balance = 100,000 + 50,000 + 15,000 - 5,000 = 160,000
	active, err := h.FinanceHandler.GetActiveShift()
	if err != nil {
		t.Fatalf("GetActiveShift failed: %v", err)
	}
	wantExpected := domain.NewAmount(160000)
	if !testutil.AmountEq(active.ExpectedBalance, wantExpected) {
		t.Errorf("expectedBalance = %s, want %s", active.ExpectedBalance.String(), wantExpected.String())
	}

	// Close shift with exactly 160,000
	closed, err := h.FinanceHandler.CloseShift(shift.ID, wantExpected, "تسوية يومية مطابقة")
	if err != nil {
		t.Fatalf("CloseShift failed: %v", err)
	}
	if !testutil.AmountEq(closed.Variance, domain.Zero()) {
		t.Errorf("variance = %s, want 0", closed.Variance.String())
	}
	if closed.Status != "closed" {
		t.Errorf("status = %q, want closed", closed.Status)
	}
}

// TestE2E_CustomerDebtCeiling_MultipleCredits verifies that multiple credit sales
// with fractional prices accumulate customer debt with zero precision drift,
// and partial repayments reduce the debt cleanly to zero.
func TestE2E_CustomerDebtCeiling_MultipleCredits(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	customer := h.NewCustomer("زبون الحساب الدقيق", 0)

	prices := []domain.Amount{
		domain.NewAmount(15750),
		domain.NewAmount(23500),
		domain.NewAmount(89250),
		domain.NewAmount(42000),
		domain.NewAmount(11500),
		domain.NewAmount(77500),
		domain.NewAmount(34000),
		domain.NewAmount(56250),
		domain.NewAmount(99000),
		domain.NewAmount(12500),
	}

	var expectedTotal domain.Amount
	for i, price := range prices {
		expectedTotal = expectedTotal.Add(price)
		prod := h.NewProduct(price.String(), price.Float(), 10)
		sale := buildCreditSale(prod, customer, 1)
		if err := h.SaleHandler.ProcessSale(sale); err != nil {
			t.Fatalf("ProcessSale %d failed: %v", i, err)
		}
	}

	// Exact sum of all 10 prices = 461,250
	c := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.Debt, expectedTotal) {
		t.Fatalf("accumulated debt = %s, want exact %s", c.Debt.String(), expectedTotal.String())
	}

	// 3 partial payments reduce debt cleanly to zero
	p1 := domain.NewAmount(61250)
	if _, err := h.PaymentHandler.CreatePayment(domain.Payment{
		CustomerID: customer.ID,
		Amount:     p1,
		Method:     "cash",
		StaffID:    auth.CurrentStaffID(),
	}); err != nil {
		t.Fatalf("payment 1 failed: %v", err)
	}
	if got := h.MustReloadCustomer(customer.ID).Debt; !testutil.AmountEq(got, domain.NewAmount(400000)) {
		t.Errorf("debt after pay 1 = %s, want 400000", got.String())
	}

	p2 := domain.NewAmount(150000)
	if _, err := h.PaymentHandler.CreatePayment(domain.Payment{
		CustomerID: customer.ID,
		Amount:     p2,
		Method:     "cash",
		StaffID:    auth.CurrentStaffID(),
	}); err != nil {
		t.Fatalf("payment 2 failed: %v", err)
	}
	if got := h.MustReloadCustomer(customer.ID).Debt; !testutil.AmountEq(got, domain.NewAmount(250000)) {
		t.Errorf("debt after pay 2 = %s, want 250000", got.String())
	}

	p3 := domain.NewAmount(250000)
	if _, err := h.PaymentHandler.CreatePayment(domain.Payment{
		CustomerID: customer.ID,
		Amount:     p3,
		Method:     "cash",
		StaffID:    auth.CurrentStaffID(),
	}); err != nil {
		t.Fatalf("payment 3 failed: %v", err)
	}
	if got := h.MustReloadCustomer(customer.ID).Debt; !testutil.AmountEq(got, domain.Zero()) {
		t.Errorf("debt after final payoff = %s, want 0", got.String())
	}
}

// TestE2E_SplitPaymentReturn_CorrectDebtAdjustment tests mixed payment (cash + credit)
// sales: only the credit leg adds debt, cash goes to shift, and a full return
// accurately refunds the cash portion to the shift and eliminates the debt portion.
func TestE2E_SplitPaymentReturn_CorrectDebtAdjustment(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	staff, _ := h.Repos.staff.GetByUsername(AdminUsername)
	shift, err := h.FinanceHandler.OpenShift(staff.ID, staff.Name, domain.NewAmount(50000))
	if err != nil {
		t.Fatalf("OpenShift failed: %v", err)
	}

	customer := h.NewCustomer("زبون مقسم مالي", 0)
	product := h.NewProduct("هاتف ذكي", 100000, 5)

	// Split payment: Cash 70,000 + Credit 30,000 = Total 100,000
	sale := buildSale(product, customer, 1, "split")
	sale.SplitDetails = map[string]domain.Amount{
		"cash":   domain.NewAmount(70000),
		"credit": domain.NewAmount(30000),
	}
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale split failed: %v", err)
	}

	// Stock decremented to 4
	if got := h.MustReloadProduct(product.ID).Stock; got != 4 {
		t.Errorf("stock after sale = %v, want 4", got)
	}

	// Customer debt equals only the credit leg (30,000)
	c := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.Debt, domain.NewAmount(30000)) {
		t.Errorf("debt after split sale = %s, want 30000", c.Debt.String())
	}

	// Active shift cash sales increased by cash leg only (70,000)
	active, err := h.FinanceHandler.GetActiveShift()
	if err != nil {
		t.Fatalf("GetActiveShift failed: %v", err)
	}
	if !testutil.AmountEq(active.CashSales, domain.NewAmount(70000)) {
		t.Errorf("shift cash sales = %s, want 70000", active.CashSales.String())
	}
	if !testutil.AmountEq(active.ExpectedBalance, domain.NewAmount(120000)) {
		t.Errorf("shift expected balance = %s, want 120000", active.ExpectedBalance.String())
	}

	// Return the split sale
	if err := h.SaleHandler.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale split failed: %v", err)
	}

	// Stock restored to 5
	if got := h.MustReloadProduct(product.ID).Stock; got != 5 {
		t.Errorf("stock after return = %v, want 5", got)
	}

	// Customer debt cleared back to 0
	c = h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.Debt, domain.Zero()) {
		t.Errorf("debt after return = %s, want 0", c.Debt.String())
	}

	// Shift cash refunded (70,000 subtracted)
	activeAfterReturn, _ := h.FinanceHandler.GetActiveShift()
	if !testutil.AmountEq(activeAfterReturn.CashSales, domain.Zero()) {
		t.Errorf("shift cash sales after return = %s, want 0", activeAfterReturn.CashSales.String())
	}
	if !testutil.AmountEq(activeAfterReturn.ExpectedBalance, domain.NewAmount(50000)) {
		t.Errorf("shift expected balance after return = %s, want 50000", activeAfterReturn.ExpectedBalance.String())
	}

	// Close shift with opening balance (50,000)
	closed, err := h.FinanceHandler.CloseShift(shift.ID, domain.NewAmount(50000), "إغلاق")
	if err != nil {
		t.Fatalf("CloseShift failed: %v", err)
	}
	if !testutil.AmountEq(closed.Variance, domain.Zero()) {
		t.Errorf("shift variance = %s, want 0", closed.Variance.String())
	}
}
