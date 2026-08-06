package e2e

import (
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestE2E_StaffLifecycle(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	created, err := h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "كاشير",
		Username: "cashier1",
		Role:     domain.RoleCashier,
		Active:   true,
	}, "5739")
	if err != nil {
		t.Fatalf("CreateStaff failed: %v", err)
	}
	if created.ID == "" {
		t.Fatal("expected staff ID")
	}

	// Auth as cashier works via username.
	result, err := h.StaffHandler.AuthenticateByUsername("cashier1", "5739")
	if err != nil {
		t.Fatalf("AuthenticateByUsername failed: %v", err)
	}
	if !result.Success {
		t.Fatalf("login should succeed, got message: %s", result.Message)
	}
	h.StaffHandler.Logout()
	defer h.DeferLogout()

	// Relogin as admin to manage.
	h.LoginAsAdmin(t)
	if err := h.StaffHandler.ToggleStaffStatus(created.ID); err != nil {
		t.Fatalf("ToggleStaffStatus failed: %v", err)
	}

	updated, err := h.StaffHandler.GetStaff(created.ID)
	if err != nil {
		t.Fatalf("GetStaff failed: %v", err)
	}
	if updated.Active {
		t.Errorf("staff should be inactive after toggle")
	}

	if err := h.StaffHandler.UpdateStaffPassword(created.ID, "9573"); err != nil {
		t.Fatalf("UpdateStaffPassword failed: %v", err)
	}

	all, err := h.StaffHandler.GetAllStaff()
	if err != nil {
		t.Fatalf("GetAllStaff failed: %v", err)
	}
	if len(all) < 2 {
		t.Errorf("staff count = %d, want >= 2 (admin + cashier)", len(all))
	}

	if err := h.StaffHandler.DeleteStaff(created.ID, true); err != nil {
		t.Fatalf("DeleteStaff failed: %v", err)
	}
}

func TestE2E_InsufficientPermissionRejectsStaffCreate(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)

	// Create a cashier staff directly via handler (admin has staff_manage).
	_, err := h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "كاشير محدود",
		Username: "cashier_limited",
		Role:     domain.RoleCashier,
		Active:   true,
	}, "5739")
	if err != nil {
		t.Fatalf("create cashier failed: %v", err)
	}

	// Login as the cashier (no staff_manage permission).
	h.StaffHandler.Logout()
	result, err := h.StaffHandler.AuthenticateByUsername("cashier_limited", "5739")
	if err != nil {
		t.Fatalf("cashier login failed: %v", err)
	}
	if !result.Success {
		t.Fatalf("cashier login failed: %s", result.Message)
	}
	defer h.DeferLogout()

	// Admin's Session is now the cashier; creating another staff requires staff_manage.
	_, err = h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "غير مصرح",
		Username: "nope",
		Role:     domain.RoleCashier,
		Active:   true,
	}, "123456")
	if err == nil {
		t.Fatal("cashier must not be able to create staff")
	}
}

func TestE2E_CRMCustomerAndSupplier(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	if err := h.CRMHandler.SaveCustomer(domain.Customer{
		Name:  "عميل جديد",
		Phone: "07700000001",
	}); err != nil {
		t.Fatalf("SaveCustomer failed: %v", err)
	}

	customers, err := h.CRMHandler.GetCustomers()
	if err != nil {
		t.Fatalf("GetCustomers failed: %v", err)
	}
	if len(customers) != 1 {
		t.Fatalf("customers = %d, want 1", len(customers))
	}

	// Search finds the customer (admin user from SeedDefaultAdmin is not a customer).
	search, err := h.CRMHandler.SearchCustomers("عميل")
	if err != nil {
		t.Fatalf("SearchCustomers failed: %v", err)
	}
	if len(search) != 1 {
		t.Errorf("search customers = %d, want 1", len(search))
	}

	// Save a supplier.
	if err := h.CRMHandler.SaveSupplier(domain.Supplier{Name: "مورد الأثاث", Phone: "07711111111"}); err != nil {
		t.Fatalf("SaveSupplier failed: %v", err)
	}
	suppliers, err := h.CRMHandler.GetSuppliers()
	if err != nil {
		t.Fatalf("GetSuppliers failed: %v", err)
	}
	if len(suppliers) != 1 {
		t.Fatalf("suppliers = %d, want 1", len(suppliers))
	}

	// Deleting the customer without force (has no debt) should succeed.
	if err := h.CRMHandler.DeleteCustomer(customers[0].ID, false); err != nil {
		t.Fatalf("DeleteCustomer failed: %v", err)
	}
	if err := h.CRMHandler.DeleteSupplier(suppliers[0].ID, false); err != nil {
		t.Fatalf("DeleteSupplier failed: %v", err)
	}
}

func TestE2E_DiscountCRUDAndCouponValidation(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	d, err := h.DiscountHandler.CreateDiscount(domain.Discount{
		Name:   "خصم 10%",
		Type:   "percentage",
		Value:  10,
		Code:   "SAVE10",
		Active: true,
	})
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	all, err := h.DiscountHandler.GetAllDiscounts()
	if err != nil {
		t.Fatalf("GetAllDiscounts failed: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("discounts = %d, want 1", len(all))
	}

	valid, err := h.DiscountHandler.ValidateCoupon("SAVE10")
	if err != nil {
		t.Fatalf("ValidateCoupon failed: %v", err)
	}
	if valid.Code != "SAVE10" {
		t.Errorf("coupon code = %s, want SAVE10", valid.Code)
	}

	// Toggle disables it; active list should be empty.
	if err := h.DiscountHandler.ToggleDiscountStatus(d.ID); err != nil {
		t.Fatalf("ToggleDiscountStatus failed: %v", err)
	}
	active, err := h.DiscountHandler.GetActiveDiscounts()
	if err != nil {
		t.Fatalf("GetActiveDiscounts failed: %v", err)
	}
	if len(active) != 0 {
		t.Errorf("active discounts = %d, want 0", len(active))
	}

	if err := h.DiscountHandler.DeleteDiscount(d.ID); err != nil {
		t.Fatalf("DeleteDiscount failed: %v", err)
	}
}

func TestE2E_ProductCRUDAndSearch(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// Create via handler.
	p := domain.Product{
		ID:    newSaleID(),
		Name:  "جهاز جديد",
		Price: domain.NewAmount(5000),
		Stock: 10,
	}
	if err := h.ProductHandler.CreateProduct(p); err != nil {
		t.Fatalf("CreateProduct failed: %v", err)
	}

	all, err := h.ProductHandler.GetAllProducts()
	if err != nil {
		t.Fatalf("GetAllProducts failed: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("products = %d, want 1", len(all))
	}

	search, err := h.ProductHandler.SearchProducts("جهاز")
	if err != nil {
		t.Fatalf("SearchProducts failed: %v", err)
	}
	if len(search) == 0 {
		t.Fatal("expected search to find the product")
	}

	// Update price.
	p = *h.MustReloadProduct(p.ID)
	p.Price = domain.NewAmount(6000)
	if err := h.ProductHandler.UpdateProduct(p); err != nil {
		t.Fatalf("UpdateProduct failed: %v", err)
	}
	reloaded := h.MustReloadProduct(p.ID)
	if !testutil.AmountEq(reloaded.Price, domain.NewAmount(6000)) {
		t.Errorf("price = %s, want 6000", reloaded.Price.String())
	}

	// Log a stock movement.
	if err := h.ProductHandler.LogStockMovement(p.ID, p.Name, "adjust", 5, "تسوية"); err != nil {
		t.Fatalf("LogStockMovement failed: %v", err)
	}
	movements, err := h.ProductHandler.GetStockMovements()
	if err != nil {
		t.Fatalf("GetStockMovements failed: %v", err)
	}
	if len(movements) == 0 {
		t.Error("expected at least one stock movement")
	}

	if err := h.ProductHandler.DeleteProduct(p.ID); err != nil {
		t.Fatalf("DeleteProduct failed: %v", err)
	}
	if _, err := h.ProductHandler.GetProductByID(p.ID); err == nil {
		t.Fatal("product should not exist after delete")
	}
}