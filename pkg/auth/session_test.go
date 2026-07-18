package auth

import (
	"errors"
	"fmt"
	"sync"
	"testing"

	"beidar-desktop/internal/core/domain"
)

func TestSessionLifecycle(t *testing.T) {
	// Ensure clean state before test
	Clear()

	if IsActive() {
		t.Error("Expected session to be inactive initially")
	}

	dummyStaff := &domain.Staff{
		ID:   "staff-123",
		Name: "Cashier John",
		Role: domain.RoleCashier,
	}
	perms := []string{PermSales, PermCustomers}

	Set(dummyStaff, perms)

	if !IsActive() {
		t.Error("Expected session to be active after Set")
	}

	snap, ok := Snapshot()
	if !ok {
		t.Fatal("Expected snapshot to be ok")
	}

	if snap.Staff.ID != "staff-123" {
		t.Errorf("Expected staff ID 'staff-123', got %q", snap.Staff.ID)
	}

	if len(snap.Permissions) != 2 || snap.Permissions[0] != PermSales || snap.Permissions[1] != PermCustomers {
		t.Errorf("Expected permissions %v, got %v", perms, snap.Permissions)
	}

	// Test immutability - modifications to the source array shouldn't affect the session copy
	perms[0] = "MODIFIED"
	snap2, _ := Snapshot()
	if snap2.Permissions[0] == "MODIFIED" {
		t.Error("Permissions slice inside session was mutated externally")
	}

	Clear()

	if IsActive() {
		t.Error("Expected session to be inactive after Clear")
	}

	_, ok = Snapshot()
	if ok {
		t.Error("Expected Snapshot to fail after Clear")
	}
}

func TestSessionSnapshot_HasPermission(t *testing.T) {
	adminStaff := domain.Staff{
		ID:   "admin-1",
		Role: domain.RoleAdmin,
	}
	cashierStaff := domain.Staff{
		ID:   "cashier-1",
		Role: domain.RoleCashier,
	}

	adminSnap := SessionSnapshot{
		Staff:       adminStaff,
		Permissions: []string{},
	}
	cashierSnap := SessionSnapshot{
		Staff:       cashierStaff,
		Permissions: []string{PermSales, PermInvoices},
	}

	// Admin should have all permissions even if empty
	if !adminSnap.HasPermission(PermFinance) {
		t.Error("Expected admin to have PermFinance")
	}

	// Cashier should have granted permissions
	if !cashierSnap.HasPermission(PermSales) {
		t.Error("Expected cashier to have PermSales")
	}
	if !cashierSnap.HasPermission(PermInvoices) {
		t.Error("Expected cashier to have PermInvoices")
	}

	// Cashier should not have ungranted permissions
	if cashierSnap.HasPermission(PermFinance) {
		t.Error("Expected cashier to lack PermFinance")
	}
}

func TestCurrentStaffGetters(t *testing.T) {
	Clear()

	if id := CurrentStaffID(); id != "" {
		t.Errorf("Expected empty staff ID, got %q", id)
	}
	if role := CurrentRole(); role != "" {
		t.Errorf("Expected empty role, got %q", role)
	}
	if name := CurrentStaffName(); name != "" {
		t.Errorf("Expected empty staff name, got %q", name)
	}

	dummyStaff := &domain.Staff{
		ID:   "staff-456",
		Name: "Admin Jane",
		Role: domain.RoleAdmin,
	}
	Set(dummyStaff, []string{PermSettings})

	if id := CurrentStaffID(); id != "staff-456" {
		t.Errorf("Expected ID 'staff-456', got %q", id)
	}
	if role := CurrentRole(); role != string(domain.RoleAdmin) {
		t.Errorf("Expected role 'admin', got %q", role)
	}
	if name := CurrentStaffName(); name != "Admin Jane" {
		t.Errorf("Expected name 'Admin Jane', got %q", name)
	}
}

func TestRequireHelpers(t *testing.T) {
	// 1. Inactive session tests
	Clear()

	if err := Require(); !errors.Is(err, ErrNotAuthenticated) {
		t.Errorf("Expected ErrNotAuthenticated, got %v", err)
	}
	if err := RequirePermission(PermSales); !errors.Is(err, ErrNotAuthenticated) {
		t.Errorf("Expected ErrNotAuthenticated, got %v", err)
	}
	if err := RequireAdmin(); !errors.Is(err, ErrNotAuthenticated) {
		t.Errorf("Expected ErrNotAuthenticated, got %v", err)
	}

	// 2. Cashier session tests
	cashierStaff := &domain.Staff{
		ID:   "cashier-1",
		Role: domain.RoleCashier,
	}
	Set(cashierStaff, []string{PermSales})

	if err := Require(); err != nil {
		t.Errorf("Expected nil error for Require with active session, got %v", err)
	}
	if err := RequirePermission(PermSales); err != nil {
		t.Errorf("Expected nil error for RequirePermission(PermSales), got %v", err)
	}
	if err := RequirePermission(PermFinance); !errors.Is(err, ErrInsufficientPermission) {
		t.Errorf("Expected ErrInsufficientPermission for PermFinance, got %v", err)
	}
	if err := RequireAdmin(); !errors.Is(err, ErrInsufficientPermission) {
		t.Errorf("Expected ErrInsufficientPermission for RequireAdmin, got %v", err)
	}

	// 3. Admin session tests
	adminStaff := &domain.Staff{
		ID:   "admin-1",
		Role: domain.RoleAdmin,
	}
	Set(adminStaff, []string{})

	if err := RequirePermission(PermFinance); err != nil {
		t.Errorf("Expected admin to pass RequirePermission(PermFinance), got %v", err)
	}
	if err := RequireAdmin(); err != nil {
		t.Errorf("Expected admin to pass RequireAdmin, got %v", err)
	}
}

func TestAuthErrorAndAsError(t *testing.T) {
	err1 := &AuthError{Code: "TEST_ERR", Message: "Test message"}
	expectedStr := "TEST_ERR: Test message"
	if err1.Error() != expectedStr {
		t.Errorf("Expected error string %q, got %q", expectedStr, err1.Error())
	}

	// Test Is method
	if !err1.Is(&AuthError{Code: "TEST_ERR"}) {
		t.Error("Expected Is to return true for matching code")
	}
	if err1.Is(&AuthError{Code: "OTHER_ERR"}) {
		t.Error("Expected Is to return false for mismatching code")
	}
	if err1.Is(errors.New("other error")) {
		t.Error("Expected Is to return false for different error type")
	}

	// Test AsError converter
	if val := AsError(nil); val != nil {
		t.Errorf("Expected nil for nil error input, got %v", val)
	}

	concreteErr := &AuthError{Code: "CONCRETE", Message: "Concrete error"}
	if val := AsError(concreteErr); val != concreteErr {
		t.Errorf("Expected same concrete pointer, got %v", val)
	}

	wrappedConcrete := fmt.Errorf("wrapped: %w", concreteErr)
	if val := AsError(wrappedConcrete); val.Code != "CONCRETE" {
		t.Errorf("Expected wrapped error to unwrap to CONCRETE, got %v", val)
	}

	randomErr := errors.New("something went wrong")
	if val := AsError(randomErr); !errors.Is(val, ErrNotAuthenticated) {
		t.Errorf("Expected default ErrNotAuthenticated for random error, got %v", val)
	}
}

func TestConcurrentSessionAccess(t *testing.T) {
	Clear()

	var wg sync.WaitGroup
	workers := 20
	iterations := 100

	staff := &domain.Staff{
		ID:   "concurrent-staff",
		Role: domain.RoleCashier,
	}

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				if j%2 == 0 {
					Set(staff, []string{PermSales})
				} else {
					Clear()
				}
				// Mix reads
				_ = IsActive()
				_, _ = Snapshot()
				_ = CurrentStaffID()
				_ = CurrentRole()
				_ = CurrentStaffName()
			}
		}(i)
	}

	wg.Wait()
}
