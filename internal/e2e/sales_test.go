package e2e

import (
	"errors"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
	"beidar-desktop/pkg/auth"

	"github.com/google/uuid"
)

// buildSale constructs a valid sale payload for a product against a customer.
func buildSale(product *domain.Product, customer *domain.Customer, qty float64, method string) domain.Sale {
	price := product.Price
	total := price.MulFloat(qty)
	return domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		StaffID:       auth.CurrentStaffID(),
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      total,
		Total:         total,
		PaymentMethod: method,
		Status:        "completed",
		ItemsCount:    qty,
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  qty,
			Price:     price,
			Total:     total,
		}},
	}
}

// buildCreditSale constructs an installment sale payload.
func buildCreditSale(product *domain.Product, customer *domain.Customer, qty float64) domain.Sale {
	price := product.Price
	total := price.MulFloat(qty)
	return domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		StaffID:       auth.CurrentStaffID(),
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      total,
		Total:         total,
		PaymentMethod: "credit",
		Status:        "pending",
		ItemsCount:    qty,
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  qty,
			Price:     price,
			Total:     total,
		}},
	}
}

func TestE2E_CashSaleUpdatesStockAndCustomer(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("ماء معدني", 250, 100)
	customer := h.NewCustomer("زبون نقدي", 0)

	if err := h.SaleHandler.ProcessSale(buildSale(product, customer, 2, "cash")); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Stock decremented atomically.
	reloaded := h.MustReloadProduct(product.ID)
	if reloaded.Stock != 98 {
		t.Errorf("stock = %v, want 98", reloaded.Stock)
	}

	// Cash sale must not create debt or points-affecting purchases.
	c := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.Debt, domain.Zero()) {
		t.Errorf("debt = %s, want 0", c.Debt.String())
	}
	if !testutil.AmountEq(c.TotalPurchases, domain.NewAmount(500)) {
		t.Errorf("totalPurchases = %s, want 500", c.TotalPurchases.String())
	}

	// The sale is retrievable through the public handler.
	sales, err := h.SaleHandler.GetSales(1, 10, "", "", "")
	if err != nil {
		t.Fatalf("GetSales failed: %v", err)
	}
	if sales.Total != 1 {
		t.Errorf("sales total = %d, want 1", sales.Total)
	}
	if !testutil.AmountEq(sales.Stats.Total, domain.NewAmount(500)) {
		t.Errorf("stats total = %s, want 500", sales.Stats.Total.String())
	}
}

func TestE2E_CreditSaleAddsDebt(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("غسالة", 250000, 5)
	customer := h.NewCustomer("زبون آجل", 10000)

	sale := buildCreditSale(product, customer, 1)
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	c := h.MustReloadCustomer(customer.ID)
	want := domain.NewAmount(10000).Add(domain.NewAmount(250000))
	if !testutil.AmountEq(c.Debt, want) {
		t.Errorf("debt = %s, want %s", c.Debt.String(), want.String())
	}
}

func TestE2E_ReturnSaleRestoresStockAndDebt(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("ثلاجة", 350000, 10)
	customer := h.NewCustomer("زبون إرجاع", 0)

	sale := buildCreditSale(product, customer, 1)
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}
	if got := h.MustReloadCustomer(customer.ID).Debt; !testutil.AmountEq(got, domain.NewAmount(350000)) {
		t.Fatalf("setup: debt = %s, want 350000", got.String())
	}

	// Full return reverses the debt and restores stock.
	if err := h.SaleHandler.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale failed: %v", err)
	}

	reloaded := h.MustReloadProduct(product.ID)
	if reloaded.Stock != 10 {
		t.Errorf("stock after return = %v, want 10", reloaded.Stock)
	}
	c := h.MustReloadCustomer(customer.ID)
	if !testutil.AmountEq(c.Debt, domain.Zero()) {
		t.Errorf("debt after return = %s, want 0", c.Debt.String())
	}
}

func TestE2E_SaleWithoutAuthIsRejected(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	auth.Clear()

	product := h.NewProduct("منتج تجريبي", 100, 5)
	customer := h.NewCustomer("زبون", 0)

	err := h.SaleHandler.ProcessSale(buildSale(product, customer, 1, "cash"))
	if err == nil {
		t.Fatal("ProcessSale without session should fail")
	}
	if !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("err = %v, want ErrNotAuthenticated", err)
	}
}

func TestE2E_DeleteSaleIsBlockedByDesign(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("جوال", 400000, 3)
	customer := h.NewCustomer("زبون حذف", 0)

	sale := buildSale(product, customer, 1, "cash")
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Deletion of financial records is intentionally disabled; only returns are allowed.
	if err := h.SaleHandler.DeleteSale(sale.ID); err == nil {
		t.Fatal("DeleteSale should be blocked for financial integrity")
	}

	// The sale must still exist after the blocked deletion.
	if _, err := h.SaleHandler.GetSale(sale.ID); err != nil {
		t.Fatalf("sale should still exist after blocked delete: %v", err)
	}
}

func TestE2E_ParkAndRetrieveSale(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	product := h.NewProduct("شاي", 3000, 20)
	customer := h.NewCustomer("زبون مؤجل", 0)

	items := `[{"id":"` + product.ID + `","name":"شاي","price":3000,"qty":2,"total":6000}]`
	parked, err := h.SaleHandler.ParkSale(items, customer.Name, customer.ID, "ملاحظة", domain.NewAmount(6000), 2)
	if err != nil {
		t.Fatalf("ParkSale failed: %v", err)
	}

	count, err := h.SaleHandler.GetParkedSalesCount()
	if err != nil {
		t.Fatalf("GetParkedSalesCount failed: %v", err)
	}
	if count != 1 {
		t.Errorf("parked count = %d, want 1", count)
	}

	retrieved, err := h.SaleHandler.RetrieveParkedSale(parked.ID)
	if err != nil {
		t.Fatalf("RetrieveParkedSale failed: %v", err)
	}
	if retrieved.ID != parked.ID {
		t.Errorf("retrieved ID = %d, want %d", retrieved.ID, parked.ID)
	}

	if err := h.SaleHandler.DeleteParkedSale(parked.ID); err != nil {
		t.Fatalf("DeleteParkedSale failed: %v", err)
	}
	count, _ = h.SaleHandler.GetParkedSalesCount()
	if count != 0 {
		t.Errorf("parked count after delete = %d, want 0", count)
	}
}
