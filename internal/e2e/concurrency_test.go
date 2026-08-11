package e2e

import (
	"fmt"
	"sync"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
	"beidar-desktop/pkg/auth"

	"github.com/google/uuid"
)

// TestE2E_ConcurrentSales_SameProduct verifies that when 5 concurrent sales
// attempt to purchase 1 unit each from a stock of 3 units, exactly 3 succeed,
// 2 fail with insufficient stock, and the final stock is exactly 0.
func TestE2E_ConcurrentSales_SameProduct(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("عصير برتقال", 1500, 3)
	customer := h.NewCustomer("عميل متزامن", 0)

	const attempts = 5
	var wg sync.WaitGroup
	var mu sync.Mutex
	successCount := 0
	failCount := 0

	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sale := buildSale(product, customer, 1, "cash")
			err := h.SaleHandler.ProcessSale(sale)
			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				successCount++
			} else {
				failCount++
			}
		}()
	}
	wg.Wait()

	if successCount != 3 {
		t.Errorf("successCount = %d, want exactly 3", successCount)
	}
	if failCount != 2 {
		t.Errorf("failCount = %d, want exactly 2", failCount)
	}

	reloaded := h.MustReloadProduct(product.ID)
	if reloaded.Stock != 0 {
		t.Errorf("final stock = %v, want 0", reloaded.Stock)
	}
}

// TestE2E_ConcurrentPayments_SameDebt ensures that when a customer has 100 debt
// and 2 concurrent payments of 100 are made, only 1 succeeds, 1 is rejected with
// PAYMENT_EXCEEDS_DEBT, and debt hits exactly 0.
func TestE2E_ConcurrentPayments_SameDebt(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	customer := h.NewCustomer("مدين متزامن", 100000)

	const attempts = 2
	var wg sync.WaitGroup
	var mu sync.Mutex
	successCount := 0
	failCount := 0

	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := h.PaymentHandler.CreatePayment(domain.Payment{
				CustomerID: customer.ID,
				Amount:     domain.NewAmount(100000),
				Method:     "cash",
				StaffID:    auth.CurrentStaffID(),
			})
			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				successCount++
			} else {
				failCount++
			}
		}()
	}
	wg.Wait()

	if successCount != 1 {
		t.Errorf("successCount = %d, want exactly 1", successCount)
	}
	if failCount != 1 {
		t.Errorf("failCount = %d, want exactly 1", failCount)
	}

	c := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.Debt, domain.Zero()) {
		t.Errorf("final debt = %s, want 0", c.Debt.String())
	}
}

// TestE2E_ConcurrentShiftOperations tests concurrent cash in / cash out
// movements on an active shift, confirming all movements persist and the
// expected shift balance and variance reconcile accurately.
func TestE2E_ConcurrentShiftOperations(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	staff, err := h.Repos.staff.GetByUsername(AdminUsername)
	if err != nil {
		t.Fatalf("get admin failed: %v", err)
	}

	shift, err := h.FinanceHandler.OpenShift(staff.ID, staff.Name, domain.NewAmount(50000))
	if err != nil {
		t.Fatalf("OpenShift failed: %v", err)
	}

	const cashInOps = 6
	const cashOutOps = 4
	var wg sync.WaitGroup

	for i := 0; i < cashInOps; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, _ = h.FinanceHandler.AddCashMovement(
				shift.ID, "cash_in", fmt.Sprintf("إيداع %d", idx),
				staff.ID, staff.Name, domain.NewAmount(10000),
			)
		}(i)
	}

	for i := 0; i < cashOutOps; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, _ = h.FinanceHandler.AddCashMovement(
				shift.ID, "cash_out", fmt.Sprintf("سحب %d", idx),
				staff.ID, staff.Name, domain.NewAmount(5000),
			)
		}(i)
	}

	wg.Wait()

	movements, err := h.FinanceHandler.GetShiftMovements(shift.ID)
	if err != nil {
		t.Fatalf("GetShiftMovements failed: %v", err)
	}
	if len(movements) != cashInOps+cashOutOps {
		t.Errorf("movements count = %d, want %d", len(movements), cashInOps+cashOutOps)
	}

	active, err := h.FinanceHandler.GetActiveShift()
	if err != nil {
		t.Fatalf("GetActiveShift failed: %v", err)
	}
	// Expected: 50000 + 6*10000 - 4*5000 = 50000 + 60000 - 20000 = 90000
	wantBalance := domain.NewAmount(90000)
	if !testutil.AmountEq(active.ExpectedBalance, wantBalance) {
		t.Errorf("expectedBalance = %s, want %s", active.ExpectedBalance.String(), wantBalance.String())
	}

	closed, err := h.FinanceHandler.CloseShift(shift.ID, wantBalance, "إغلاق وردية")
	if err != nil {
		t.Fatalf("CloseShift failed: %v", err)
	}
	if !testutil.AmountEq(closed.Variance, domain.Zero()) {
		t.Errorf("variance = %s, want 0", closed.Variance.String())
	}
}

// TestE2E_ConcurrentCustomerPointsAward verifies that concurrent sales for the
// same customer award loyalty points and cumulative purchases atomically.
func TestE2E_ConcurrentCustomerPointsAward(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	customer := h.NewCustomer("زبون نقاط", 0)
	product := h.NewProduct("منتج نقاط", 5000, 100) // Price 5000 gives 5 points (5000/1000)

	const salesCount = 8
	var wg sync.WaitGroup
	var mu sync.Mutex
	var errs []error

	for i := 0; i < salesCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sale := buildSale(product, customer, 1, "cash")
			err := h.SaleHandler.ProcessSale(sale)
			if err != nil {
				mu.Lock()
				errs = append(errs, err)
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if len(errs) > 0 {
		t.Fatalf("ProcessSale encountered errors: %v", errs)
	}

	c := h.MustReloadCustomer(customer.ID)
	wantPurchases := domain.NewAmount(5000).MulFloat(float64(salesCount))
	if !testutil.AmountEq(c.TotalPurchases, wantPurchases) {
		t.Errorf("totalPurchases = %s, want %s", c.TotalPurchases.String(), wantPurchases.String())
	}
	wantPoints := salesCount * int(product.Price.Div(1000).Cents())
	if c.Points != wantPoints {
		t.Errorf("points = %d, want %d", c.Points, wantPoints)
	}

	reloadedProd := h.MustReloadProduct(product.ID)
	if reloadedProd.Stock != float64(100-salesCount) {
		t.Errorf("product stock = %v, want %v", reloadedProd.Stock, 100-salesCount)
	}
}

// TestE2E_ConcurrentProductUpdate tests that concurrent product updates
// across multiple fields resolve cleanly without database locking errors.
func TestE2E_ConcurrentProductUpdate(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := domain.Product{
		ID:          "prod_" + uuid.New().String(),
		Name:        "منتج تحديث متزامن",
		Price:       domain.NewAmount(10000),
		Cost:        domain.NewAmount(5000),
		Stock:       50,
		MinStock:    5,
		Category:    "عام",
		Description: "وصف أولي",
	}
	if err := h.ProductHandler.CreateProduct(product); err != nil {
		t.Fatalf("CreateProduct failed: %v", err)
	}

	const ops = 6
	var wg sync.WaitGroup
	var mu sync.Mutex
	var errs []error

	for i := 0; i < ops; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			p := product
			p.MinStock = float64(10 + idx)
			p.Description = fmt.Sprintf("وصف محدث %d", idx)
			err := h.ProductHandler.UpdateProduct(p)
			if err != nil {
				mu.Lock()
				errs = append(errs, err)
				mu.Unlock()
			}
		}(i)
	}
	wg.Wait()

	if len(errs) > 0 {
		t.Fatalf("UpdateProduct had errors: %v", errs)
	}

	reloaded := h.MustReloadProduct(product.ID)
	if reloaded.Name != product.Name {
		t.Errorf("name = %q, want %q", reloaded.Name, product.Name)
	}
	if !testutil.AmountEq(reloaded.Price, product.Price) {
		t.Errorf("price = %s, want %s", reloaded.Price.String(), product.Price.String())
	}
	if reloaded.Stock != product.Stock {
		t.Errorf("stock = %v, want %v", reloaded.Stock, product.Stock)
	}
}

// TestE2E_ConcurrentInstallmentPayments tests concurrent installment payments
// on different sales for the same customer, verifying that customer installment
// debt is decremented accurately and sale statuses transition to paid.
func TestE2E_ConcurrentInstallmentPayments(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	customer := h.NewCustomer("زبون أقساط متزامن", 0)
	prod1 := h.NewProduct("تلفزيون", 200000, 5)
	prod2 := h.NewProduct("مكيف", 300000, 5)

	// Sale 1: 2 installments of 100000
	sale1 := buildInstallmentSale(prod1, customer, domain.Zero(), []domain.Amount{
		domain.NewAmount(100000),
		domain.NewAmount(100000),
	})
	if err := h.SaleHandler.ProcessSale(sale1); err != nil {
		t.Fatalf("ProcessSale sale1 failed: %v", err)
	}

	// Sale 2: 3 installments of 100000
	sale2 := buildInstallmentSale(prod2, customer, domain.Zero(), []domain.Amount{
		domain.NewAmount(100000),
		domain.NewAmount(100000),
		domain.NewAmount(100000),
	})
	if err := h.SaleHandler.ProcessSale(sale2); err != nil {
		t.Fatalf("ProcessSale sale2 failed: %v", err)
	}

	// Initial customer installment debt = 200000 + 300000 = 500000
	c := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.InstallmentDebt, domain.NewAmount(500000)) {
		t.Fatalf("initial installment debt = %s, want 500000", c.InstallmentDebt.String())
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	var errs []error

	tasks := []struct {
		saleID    string
		instIndex int
		amount    domain.Amount
	}{
		{sale1.ID, 0, domain.NewAmount(100000)},
		{sale1.ID, 1, domain.NewAmount(100000)},
		{sale2.ID, 0, domain.NewAmount(100000)},
		{sale2.ID, 1, domain.NewAmount(100000)},
	}

	for _, task := range tasks {
		wg.Add(1)
		go func(sID string, idx int, amt domain.Amount) {
			defer wg.Done()
			err := h.PaymentHandler.PayInstallment(sID, idx, amt, "cash")
			if err != nil {
				mu.Lock()
				errs = append(errs, err)
				mu.Unlock()
			}
		}(task.saleID, task.instIndex, task.amount)
	}
	wg.Wait()

	if len(errs) > 0 {
		t.Fatalf("PayInstallment had errors: %v", errs)
	}

	// Customer remaining installment debt should be exactly 500000 - 400000 = 100000
	c = h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.InstallmentDebt, domain.NewAmount(100000)) {
		t.Errorf("final installment debt = %s, want 100000", c.InstallmentDebt.String())
	}

	// Sale 1 should be fully paid
	s1, err := h.SaleHandler.GetSale(sale1.ID)
	if err != nil {
		t.Fatalf("GetSale(sale1) failed: %v", err)
	}
	if s1.Status != "paid" {
		t.Errorf("sale1 status = %q, want paid", s1.Status)
	}

	// Sale 2 should still be pending
	s2, err := h.SaleHandler.GetSale(sale2.ID)
	if err != nil {
		t.Fatalf("GetSale(sale2) failed: %v", err)
	}
	if s2.Status != "pending" {
		t.Errorf("sale2 status = %q, want pending", s2.Status)
	}
}
