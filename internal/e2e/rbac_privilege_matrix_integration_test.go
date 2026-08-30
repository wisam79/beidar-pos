package e2e

import (
	"errors"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/auth"
)

// TestE2E_RBAC_RolePermissionMatrixAndPrivilegeDefense tests backend authorization (Rule 3.2):
// The frontend can hide buttons, but the backend must strictly reject unauthorized handler calls.
// Tests the full role matrix:
// 1. RoleCashier: Can process sales, but CANNOT delete/return sales, CANNOT manage staff, CANNOT modify system settings.
// 2. RoleViewer: Can view products, but CANNOT process sales, CANNOT modify prices, CANNOT access finance.
// 3. Unauthenticated calls to all protected endpoints are rejected with ErrNotAuthenticated.
func TestE2E_RBAC_RolePermissionMatrixAndPrivilegeDefense(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	// ── Setup: Admin creates Cashier and Viewer accounts ────────────────────
	h.LoginAsAdmin(t)

	_, err := h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "كاشير الصلاحيات",
		Username: "cashier_rbac",
		Role:     domain.RoleCashier,
		Active:   true,
	}, "8392")
	if err != nil {
		t.Fatalf("CreateStaff cashier failed: %v", err)
	}

	_, err = h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "مشاهد فقط",
		Username: "viewer_rbac",
		Role:     domain.RoleViewer,
		Active:   true,
	}, "6491")
	if err != nil {
		t.Fatalf("CreateStaff viewer failed: %v", err)
	}

	prod := h.NewProduct("سماعة اختبار الصلاحيات", 25000, 10)
	cust := h.NewCustomer("زبون الصلاحيات", 0)

	// ── 1. RoleCashier Tests ───────────────────────────────────────────────
	h.StaffHandler.Logout()
	loginRes, err := h.StaffHandler.AuthenticateByUsername("cashier_rbac", "8392")
	if err != nil || !loginRes.Success {
		t.Fatalf("cashier login failed: %v", err)
	}

	// Cashier CAN process sales
	sale := buildSale(prod, cust, 1, "cash")
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("cashier ProcessSale should succeed, got: %v", err)
	}

	// Cashier CANNOT delete sale
	err = h.SaleHandler.DeleteSale(sale.ID)
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Fatalf("expected ErrInsufficientPermission on cashier DeleteSale, got: %v", err)
	}

	// Cashier CANNOT create other staff
	_, err = h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "محاولة تصعيد",
		Username: "hacker_staff",
		Role:     domain.RoleAdmin,
	}, "9731")
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Fatalf("expected ErrInsufficientPermission on cashier CreateStaff, got: %v", err)
	}

	// Cashier CANNOT reset database
	err = h.BackupHandler.ResetDatabase()
	if err == nil {
		t.Fatal("cashier ResetDatabase must be rejected")
	}

	// ── 2. RoleViewer Tests ────────────────────────────────────────────────
	h.StaffHandler.Logout()
	loginViewer, err := h.StaffHandler.AuthenticateByUsername("viewer_rbac", "6491")
	if err != nil || !loginViewer.Success {
		t.Fatalf("viewer login failed: %v", err)
	}

	// Viewer CAN query products
	prods, err := h.ProductHandler.GetAllProducts()
	if err != nil || len(prods) == 0 {
		t.Fatalf("viewer GetAllProducts should succeed, got err: %v", err)
	}

	// Viewer CANNOT process sales
	viewerSale := buildSale(prod, cust, 1, "cash")
	err = h.SaleHandler.ProcessSale(viewerSale)
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Fatalf("expected ErrInsufficientPermission on viewer ProcessSale, got: %v", err)
	}

	// Viewer CANNOT create expenses
	err = h.FinanceHandler.SaveExpense(domain.Expense{
		Title:  "مصروف وهمي",
		Amount: domain.NewAmount(5000),
		Date:   "2026-08-30",
	})
	if err == nil || !errors.Is(err, auth.ErrInsufficientPermission) {
		t.Fatalf("expected ErrInsufficientPermission on viewer SaveExpense, got: %v", err)
	}

	// ── 3. Unauthenticated Access Rejections ────────────────────────────────
	h.StaffHandler.Logout()

	// Unauthenticated call to GetCustomers
	_, err = h.CRMHandler.GetCustomers()
	if err == nil || !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Fatalf("expected ErrNotAuthenticated on unauthenticated GetCustomers, got: %v", err)
	}

	// Unauthenticated call to OpenShift
	_, err = h.FinanceHandler.OpenShift("any", "any", domain.NewAmount(10000))
	if err == nil || !errors.Is(err, auth.ErrNotAuthenticated) {
		t.Fatalf("expected ErrNotAuthenticated on unauthenticated OpenShift, got: %v", err)
	}
}
