package e2e

import (
	"errors"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
	"beidar-desktop/pkg/auth"
)

// TestE2E_CashierCannotDeleteSale tests that staff with RoleCashier (lacking
// PermDeleteSales) cannot delete or return sales, protecting financial records.
func TestE2E_CashierCannotDeleteSale(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)

	// Create a sale as admin
	product := h.NewProduct("سماعات", 25000, 10)
	customer := h.NewCustomer("زبون أمان", 0)
	sale := buildSale(product, customer, 1, "cash")
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Create a cashier staff
	cashier, err := h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "كاشير بدون صلاحية حذف",
		Username: "cashier_nodelete",
		Role:     domain.RoleCashier,
		Active:   true,
	}, "5739")
	if err != nil {
		t.Fatalf("CreateStaff failed: %v", err)
	}
	_ = cashier

	// Login as cashier
	h.StaffHandler.Logout()
	loginResult, err := h.StaffHandler.AuthenticateByUsername("cashier_nodelete", "5739")
	if err != nil || !loginResult.Success {
		t.Fatalf("cashier login failed: %v", err)
	}
	defer h.DeferLogout()

	// Attempting DeleteSale must fail with ErrInsufficientPermission
	err = h.SaleHandler.DeleteSale(sale.ID)
	if err == nil {
		t.Fatal("cashier DeleteSale should be rejected")
	}
	if !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("expected ErrInsufficientPermission, got: %v", err)
	}

	// Attempting ReturnSale must also fail with ErrInsufficientPermission
	err = h.SaleHandler.ReturnSale(sale.ID)
	if err == nil {
		t.Fatal("cashier ReturnSale should be rejected")
	}
	if !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("expected ErrInsufficientPermission, got: %v", err)
	}

	// Attempting ReturnSalePartial must fail with ErrInsufficientPermission
	err = h.SaleHandler.ReturnSalePartial(sale.ID, product.ID, 1)
	if err == nil {
		t.Fatal("cashier ReturnSalePartial should be rejected")
	}
	if !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("expected ErrInsufficientPermission, got: %v", err)
	}
}

// TestE2E_CashierCannotEditPrices verifies that staff lacking PermEditPrices /
// PermProducts cannot update products or modify catalog prices.
func TestE2E_CashierCannotEditPrices(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)

	product := h.NewProduct("شاحن سريع", 15000, 20)

	// Create and login as cashier
	_, err := h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "كاشير تعديل أسعار",
		Username: "cashier_noprice",
		Role:     domain.RoleCashier,
		Active:   true,
	}, "2345")
	if err != nil {
		t.Fatalf("CreateStaff failed: %v", err)
	}

	h.StaffHandler.Logout()
	loginResult, err := h.StaffHandler.AuthenticateByUsername("cashier_noprice", "2345")
	if err != nil || !loginResult.Success {
		t.Fatalf("cashier login failed: %v", err)
	}
	defer h.DeferLogout()

	// Cashier attempts to update the product price
	modified := *product
	modified.Price = domain.NewAmount(50000)

	err = h.ProductHandler.UpdateProduct(modified)
	if err == nil {
		t.Fatal("cashier UpdateProduct should be rejected")
	}
	if !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("expected ErrInsufficientPermission, got: %v", err)
	}

	// Verify the price remains unchanged
	reloaded := h.MustReloadProduct(product.ID)
	if !testutil.AmountEq(reloaded.Price, domain.NewAmount(15000)) {
		t.Errorf("price = %s, want 15000", reloaded.Price.String())
	}
}

// TestE2E_ViewerCannotProcessSale verifies that read-only staff with RoleViewer
// are blocked from processing sales or parking carts.
func TestE2E_ViewerCannotProcessSale(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)

	product := h.NewProduct("كتاب", 8000, 10)
	customer := h.NewCustomer("زبون مشاهد", 0)

	// Create a viewer staff
	_, err := h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "مشاهد فقط",
		Username: "viewer_user",
		Role:     domain.RoleViewer,
		Active:   true,
	}, "3456")
	if err != nil {
		t.Fatalf("CreateStaff failed: %v", err)
	}

	h.StaffHandler.Logout()
	loginResult, err := h.StaffHandler.AuthenticateByUsername("viewer_user", "3456")
	if err != nil || !loginResult.Success {
		t.Fatalf("viewer login failed: %v", err)
	}
	defer h.DeferLogout()

	// ProcessSale must fail for RoleViewer
	sale := buildSale(product, customer, 1, "cash")
	err = h.SaleHandler.ProcessSale(sale)
	if err == nil {
		t.Fatal("viewer ProcessSale should be rejected")
	}
	if !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("expected ErrInsufficientPermission, got: %v", err)
	}

	// ParkSale must also fail
	_, err = h.SaleHandler.ParkSale(`[{"id":"1"}]`, customer.Name, customer.ID, "ملاحظة", domain.NewAmount(8000), 1)
	if err == nil {
		t.Fatal("viewer ParkSale should be rejected")
	}
	if !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("expected ErrInsufficientPermission, got: %v", err)
	}

	// Stock must remain intact
	reloaded := h.MustReloadProduct(product.ID)
	if reloaded.Stock != 10 {
		t.Errorf("stock = %v, want 10", reloaded.Stock)
	}
}

// TestE2E_CashierCannotAccessFinance ensures non-admin/non-manager staff cannot
// record expenses, manage categories, create POs, or modify app preferences.
func TestE2E_CashierCannotAccessFinance(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)

	_, err := h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "كاشير المالية",
		Username: "cashier_nofinance",
		Role:     domain.RoleCashier,
		Active:   true,
	}, "4567")
	if err != nil {
		t.Fatalf("CreateStaff failed: %v", err)
	}

	h.StaffHandler.Logout()
	loginResult, err := h.StaffHandler.AuthenticateByUsername("cashier_nofinance", "4567")
	if err != nil || !loginResult.Success {
		t.Fatalf("cashier login failed: %v", err)
	}
	defer h.DeferLogout()

	// SaveExpense rejected
	err = h.FinanceHandler.SaveExpense(domain.Expense{
		Title:  "مصروف غير مصرح",
		Amount: domain.NewAmount(5000),
		Date:   "2026-02-01",
	})
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("SaveExpense expected ErrInsufficientPermission, got: %v", err)
	}

	// DeleteExpense rejected
	err = h.FinanceHandler.DeleteExpense("exp_dummy")
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("DeleteExpense expected ErrInsufficientPermission, got: %v", err)
	}

	// SaveCategory rejected
	err = h.FinanceHandler.SaveCategory(domain.Category{Name: "تصنيف جديد"})
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("SaveCategory expected ErrInsufficientPermission, got: %v", err)
	}

	// DeleteCategory rejected
	err = h.FinanceHandler.DeleteCategory("cat_dummy", true)
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("DeleteCategory expected ErrInsufficientPermission, got: %v", err)
	}

	// CreatePurchaseOrder rejected
	_, err = h.FinanceHandler.CreatePurchaseOrder(domain.PurchaseOrder{
		SupplierID: "sup_dummy",
		Items:      []domain.PurchaseOrderItem{{ProductID: "p_1", Quantity: 1, UnitCost: domain.NewAmount(100)}},
	})
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("CreatePurchaseOrder expected ErrInsufficientPermission, got: %v", err)
	}

	// UpdatePreferences rejected
	err = h.SettingsHandler.UpdatePreferences(domain.AppPreferences{StoreName: "اسم جديد"})
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("UpdatePreferences expected ErrInsufficientPermission, got: %v", err)
	}
}

// TestE2E_CashierCannotManageStaff checks that staff management operations
// (create, update, delete, toggle status, update PIN) are strictly denied to cashiers.
func TestE2E_CashierCannotManageStaff(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)

	cashier, err := h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "كاشير بدون إدارة",
		Username: "cashier_nostaff",
		Role:     domain.RoleCashier,
		Active:   true,
	}, "5678")
	if err != nil {
		t.Fatalf("CreateStaff failed: %v", err)
	}

	h.StaffHandler.Logout()
	loginResult, err := h.StaffHandler.AuthenticateByUsername("cashier_nostaff", "5678")
	if err != nil || !loginResult.Success {
		t.Fatalf("cashier login failed: %v", err)
	}
	defer h.DeferLogout()

	// CreateStaff rejected
	_, err = h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "موظف متسلل",
		Username: "sneak",
		Role:     domain.RoleCashier,
	}, "0000")
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("CreateStaff expected ErrInsufficientPermission, got: %v", err)
	}

	// DeleteStaff rejected
	err = h.StaffHandler.DeleteStaff(cashier.ID, true)
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("DeleteStaff expected ErrInsufficientPermission, got: %v", err)
	}

	// UpdateStaff rejected
	err = h.StaffHandler.UpdateStaff(*cashier)
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("UpdateStaff expected ErrInsufficientPermission, got: %v", err)
	}

	// ToggleStaffStatus rejected
	err = h.StaffHandler.ToggleStaffStatus(cashier.ID)
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("ToggleStaffStatus expected ErrInsufficientPermission, got: %v", err)
	}

	// UpdateStaffPIN rejected
	err = h.StaffHandler.UpdateStaffPIN(cashier.ID, "9999")
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Errorf("UpdateStaffPIN expected ErrInsufficientPermission, got: %v", err)
	}
}

// TestE2E_AdminPin_TarpitUnderBruteForce validates the progressive backoff
// (exponential tarpitting) on repeated incorrect Admin PIN verification attempts
// and ensures immediate success on a correct PIN.
func TestE2E_AdminPin_TarpitUnderBruteForce(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// Set an admin PIN
	prefs, err := h.SettingsHandler.GetPreferences()
	if err != nil {
		t.Fatalf("GetPreferences failed: %v", err)
	}
	prefs.AdminPin = "7391"
	if err := h.SettingsHandler.UpdatePreferences(*prefs); err != nil {
		t.Fatalf("UpdatePreferences failed: %v", err)
	}

	// Attempt 1: Wrong PIN -> delay of 1s (2^0)
	start1 := time.Now()
	ok1 := h.SettingsHandler.VerifyAdminPin("9842")
	dur1 := time.Since(start1)
	if ok1 {
		t.Error("VerifyAdminPin('9842') should return false")
	}
	if dur1 < 900*time.Millisecond {
		t.Errorf("1st failure duration = %v, want >= 900ms", dur1)
	}

	// Attempt 2: Wrong PIN -> delay of 2s (2^1)
	start2 := time.Now()
	ok2 := h.SettingsHandler.VerifyAdminPin("8492")
	dur2 := time.Since(start2)
	if ok2 {
		t.Error("VerifyAdminPin('8492') should return false")
	}
	if dur2 < 1800*time.Millisecond {
		t.Errorf("2nd failure duration = %v, want >= 1800ms", dur2)
	}
	if dur2 <= dur1 {
		t.Errorf("2nd failure duration (%v) should be strictly greater than 1st (%v)", dur2, dur1)
	}

	// Attempt 3: Correct PIN -> returns true and resets failure counter
	ok3 := h.SettingsHandler.VerifyAdminPin("7391")
	if !ok3 {
		t.Error("VerifyAdminPin('7391') should return true")
	}

	// Attempt 4: Wrong PIN after reset -> back to 1s delay (less than attempt 2)
	start4 := time.Now()
	ok4 := h.SettingsHandler.VerifyAdminPin("9842")
	dur4 := time.Since(start4)
	if ok4 {
		t.Error("VerifyAdminPin('9842') after reset should return false")
	}
	if dur4 < 900*time.Millisecond {
		t.Errorf("failure duration after reset = %v, want >= 900ms", dur4)
	}
}

// TestE2E_UnauthenticatedAccess_AllHandlers confirms that unauthenticated calls
// to all protected handler methods across the system are consistently rejected.
func TestE2E_UnauthenticatedAccess_AllHandlers(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	// Ensure no active session
	auth.Clear()

	// 1. SaleHandler
	if err := h.SaleHandler.ProcessSale(domain.Sale{}); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("SaleHandler.ProcessSale expected ErrNotAuthenticated, got: %v", err)
	}
	if _, err := h.SaleHandler.GetSales(1, 10, "", "", ""); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("SaleHandler.GetSales expected ErrNotAuthenticated, got: %v", err)
	}
	if _, err := h.SaleHandler.GetSale("any"); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("SaleHandler.GetSale expected ErrNotAuthenticated, got: %v", err)
	}
	if err := h.SaleHandler.DeleteSale("any"); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("SaleHandler.DeleteSale expected ErrNotAuthenticated, got: %v", err)
	}

	// 2. ProductHandler
	if err := h.ProductHandler.CreateProduct(domain.Product{}); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("ProductHandler.CreateProduct expected ErrNotAuthenticated, got: %v", err)
	}
	if _, err := h.ProductHandler.GetAllProducts(); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("ProductHandler.GetAllProducts expected ErrNotAuthenticated, got: %v", err)
	}

	// 3. PaymentHandler
	if _, err := h.PaymentHandler.CreatePayment(domain.Payment{}); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("PaymentHandler.CreatePayment expected ErrNotAuthenticated, got: %v", err)
	}

	// 4. FinanceHandler
	if _, err := h.FinanceHandler.GetExpenses(""); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("FinanceHandler.GetExpenses expected ErrNotAuthenticated, got: %v", err)
	}
	if err := h.FinanceHandler.SaveExpense(domain.Expense{}); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("FinanceHandler.SaveExpense expected ErrNotAuthenticated, got: %v", err)
	}
	if _, err := h.FinanceHandler.GetCategories(); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("FinanceHandler.GetCategories expected ErrNotAuthenticated, got: %v", err)
	}

	// 5. CRMHandler
	if err := h.CRMHandler.SaveCustomer(domain.Customer{}); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("CRMHandler.SaveCustomer expected ErrNotAuthenticated, got: %v", err)
	}
	if _, err := h.CRMHandler.GetCustomers(); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("CRMHandler.GetCustomers expected ErrNotAuthenticated, got: %v", err)
	}

	// 6. StaffHandler
	if _, err := h.StaffHandler.GetAllStaff(); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("StaffHandler.GetAllStaff expected ErrNotAuthenticated, got: %v", err)
	}

	// 7. StatsHandler
	if _, err := h.StatsHandler.GetDashboardStats("today"); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("StatsHandler.GetDashboardStats expected ErrNotAuthenticated, got: %v", err)
	}

	// 8. DiscountHandler
	if _, err := h.DiscountHandler.CreateDiscount(domain.Discount{}); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("DiscountHandler.CreateDiscount expected ErrNotAuthenticated, got: %v", err)
	}

	// 9. SettingsHandler
	if _, err := h.SettingsHandler.GetPreferences(); !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Errorf("SettingsHandler.GetPreferences expected ErrNotAuthenticated, got: %v", err)
	}
}
