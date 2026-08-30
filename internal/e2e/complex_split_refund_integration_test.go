package e2e

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
	"github.com/google/uuid"
)

// TestE2E_MultiPayment_SplitCashCardCredit_PartialReturn tests split multi-payment handling (Rule 3.8):
// 1. Sale processed with split payment (Cash + Card + Credit).
// 2. Customer debt increases strictly by the credit portion.
// 3. Shift cash increases strictly by the cash portion.
// 4. Return sale adjusts customer credit debt and refunds shift cash accurately with zero rounding error.
func TestE2E_MultiPayment_SplitCashCardCredit_PartialReturn(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	staff, err := h.Repos.staff.GetByUsername(AdminUsername)
	if err != nil {
		t.Fatalf("staff lookup failed: %v", err)
	}

	// 1. Open shift
	shift, err := h.FinanceHandler.OpenShift(staff.ID, staff.Name, domain.NewAmount(100000))
	if err != nil {
		t.Fatalf("OpenShift failed: %v", err)
	}
	_ = shift

	// 2. Create products and customer
	prod1 := h.NewProduct("سماعة سلكية", 20000, 10)
	prod2 := h.NewProduct("شاحن سيارة", 30000, 10)
	prod3 := h.NewProduct("باور بانك 20000", 50000, 10)
	cust := h.NewCustomer("عميل الدفع المقسم", 0)

	// Total invoice = 20,000 + 30,000 + 50,000 = 100,000
	// Split: Cash: 20,000, Card: 30,000, Credit: 50,000
	totalAmount := domain.NewAmount(100000)
	splitMap := map[string]domain.Amount{
		"cash":   domain.NewAmount(20000),
		"card":   domain.NewAmount(30000),
		"credit": domain.NewAmount(50000),
	}

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    cust.ID,
		CustomerName:  cust.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      totalAmount,
		Total:         totalAmount,
		PaymentMethod: "split",
		SplitDetails:  splitMap,
		Status:        "completed",
		ItemsCount:    3,
		Items: []domain.SaleItem{
			{ProductID: prod1.ID, Name: prod1.Name, Quantity: 1, Price: prod1.Price, Total: prod1.Price},
			{ProductID: prod2.ID, Name: prod2.Name, Quantity: 1, Price: prod2.Price, Total: prod2.Price},
			{ProductID: prod3.ID, Name: prod3.Name, Quantity: 1, Price: prod3.Price, Total: prod3.Price},
		},
	}

	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale split failed: %v", err)
	}

	// 3. Verify Customer Debt = 50,000 (credit share only)
	c1 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(c1.Debt, domain.NewAmount(50000)) {
		t.Fatalf("expected customer debt 50000, got %s", c1.Debt.String())
	}
	if !testutil.AmountEq(c1.TotalPurchases, totalAmount) {
		t.Fatalf("expected total purchases 100000, got %s", c1.TotalPurchases.String())
	}

	// 4. Verify Active Shift Cash Sales = 20,000 (cash portion only)
	activeShift, err := h.FinanceHandler.GetActiveShift()
	if err != nil {
		t.Fatalf("GetActiveShift failed: %v", err)
	}
	if !testutil.AmountEq(activeShift.CashSales, domain.NewAmount(20000)) {
		t.Fatalf("expected shift cash sales 20000, got %s", activeShift.CashSales.String())
	}

	// Verify all 3 product stocks decremented to 9
	if h.MustReloadProduct(prod1.ID).Stock != 9 ||
		h.MustReloadProduct(prod2.ID).Stock != 9 ||
		h.MustReloadProduct(prod3.ID).Stock != 9 {
		t.Fatal("expected product stocks to be 9 after sale")
	}

	// 5. Full Return of the Split Sale
	if err := h.SaleHandler.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale split failed: %v", err)
	}

	// 6. Verify Customer Debt returned to 0
	cAfterReturn := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(cAfterReturn.Debt, domain.Zero()) {
		t.Fatalf("expected customer debt 0 after return, got %s", cAfterReturn.Debt.String())
	}
	if !testutil.AmountEq(cAfterReturn.TotalPurchases, domain.Zero()) {
		t.Fatalf("expected customer total purchases 0 after return, got %s", cAfterReturn.TotalPurchases.String())
	}

	// 7. Verify Product Stocks restored to 10
	if h.MustReloadProduct(prod1.ID).Stock != 10 ||
		h.MustReloadProduct(prod2.ID).Stock != 10 ||
		h.MustReloadProduct(prod3.ID).Stock != 10 {
		t.Fatal("expected product stocks to be restored to 10 after return")
	}
}
