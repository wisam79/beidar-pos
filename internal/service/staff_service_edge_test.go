package service_test

import (
	"errors"
	"sync"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
	pkgerrors "beidar-desktop/pkg/errors"
	"beidar-desktop/pkg/logger"

	"gorm.io/gorm"
)

func setupStaffEdgeTestDB(t *testing.T) (domain.StaffService, *gorm.DB, func()) {
	t.Helper()
	logger.InitLogger(logger.INFO, false)
	db, cleanup := testutil.SetupFullDB(t)
	testutil.SeedPreferences(t, db)

	staffRepo := repository.NewStaffRepository(db)
	staffService := service.NewStaffService(staffRepo)

	return staffService, db, cleanup
}

func TestEdge_AuthenticateByPIN_ConcurrentTarpitting(t *testing.T) {
	s, _, cleanup := setupStaffEdgeTestDB(t)
	defer cleanup()

	// Create a cashier
	cashier := domain.Staff{
		Name:     "Concurrent Cashier",
		Username: "concurrent_cashier",
		Role:     domain.RoleCashier,
	}
	_, err := s.CreateStaff(cashier, "8899")
	if err != nil {
		t.Fatalf("CreateStaff failed: %v", err)
	}

	// Run concurrent invalid PIN auth attempts. Must not panic, race, or crash.
	const numAttempts = 4
	var wg sync.WaitGroup
	results := make([]*domain.AuthResult, numAttempts)
	errorsList := make([]error, numAttempts)

	wg.Add(numAttempts)
	for i := 0; i < numAttempts; i++ {
		go func(idx int) {
			defer wg.Done()
			res, err := s.AuthenticateByPIN("0000") // invalid PIN
			results[idx] = res
			errorsList[idx] = err
		}(i)
	}
	wg.Wait()

	for i := 0; i < numAttempts; i++ {
		if errorsList[i] != nil {
			t.Errorf("Attempt %d returned unexpected error: %v", i, errorsList[i])
		}
		if results[i] == nil || results[i].Success {
			t.Errorf("Attempt %d expected failure, got: %+v", i, results[i])
		}
	}

	// After concurrent failures, the correct PIN must still authenticate successfully
	validRes, err := s.AuthenticateByPIN("8899")
	if err != nil {
		t.Fatalf("AuthenticateByPIN for valid PIN failed: %v", err)
	}
	if !validRes.Success {
		t.Fatalf("Expected valid PIN to succeed after failed attempts, got: %s", validRes.Message)
	}
	if validRes.Staff.Username != "concurrent_cashier" {
		t.Errorf("Expected staff 'concurrent_cashier', got %q", validRes.Staff.Username)
	}
}

func TestEdge_AuthenticateByPIN_CorrectAfterFailures(t *testing.T) {
	s, _, cleanup := setupStaffEdgeTestDB(t)
	defer cleanup()

	cashier := domain.Staff{
		Name:     "Test Cashier",
		Username: "test_cashier_pin",
		Role:     domain.RoleCashier,
	}
	_, err := s.CreateStaff(cashier, "6543")
	if err != nil {
		t.Fatalf("CreateStaff failed: %v", err)
	}

	// 1. First wrong PIN attempt
	res1, err := s.AuthenticateByPIN("1111")
	if err != nil || res1.Success {
		t.Fatalf("Expected failure for wrong PIN 1111, got: %+v, err: %v", res1, err)
	}

	// 2. Second wrong PIN attempt
	res2, err := s.AuthenticateByPIN("2222")
	if err != nil || res2.Success {
		t.Fatalf("Expected failure for wrong PIN 2222, got: %+v, err: %v", res2, err)
	}

	// 3. Immediately try correct PIN -> must succeed without being locked out
	res3, err := s.AuthenticateByPIN("6543")
	if err != nil {
		t.Fatalf("AuthenticateByPIN error: %v", err)
	}
	if !res3.Success {
		t.Fatalf("Expected correct PIN to succeed, got message: %s", res3.Message)
	}
	if res3.Staff.Username != "test_cashier_pin" {
		t.Errorf("Expected username 'test_cashier_pin', got %q", res3.Staff.Username)
	}
}

func TestEdge_CreateStaff_DuplicateUsername(t *testing.T) {
	s, _, cleanup := setupStaffEdgeTestDB(t)
	defer cleanup()

	staff1 := domain.Staff{
		Name:     "First Cashier",
		Username: "cashier_dup",
		Role:     domain.RoleCashier,
	}
	if _, err := s.CreateStaff(staff1, "1235"); err != nil {
		t.Fatalf("CreateStaff 1 failed: %v", err)
	}

	// Attempt to create second staff with identical username
	staff2 := domain.Staff{
		Name:     "Second Cashier",
		Username: "cashier_dup",
		Role:     domain.RoleCashier,
	}
	_, err := s.CreateStaff(staff2, "5678")
	if err == nil {
		t.Fatal("Expected CreateStaff to fail for duplicate username")
	}

	var appErr *pkgerrors.AppError
	if errors.As(err, &appErr) {
		if appErr.Code != "DUPLICATE_USERNAME" {
			t.Errorf("Expected AppError code 'DUPLICATE_USERNAME', got %q", appErr.Code)
		}
	} else {
		t.Errorf("Expected *pkgerrors.AppError, got %T: %v", err, err)
	}
}

func TestEdge_CreateStaff_DuplicateFastPIN(t *testing.T) {
	s, _, cleanup := setupStaffEdgeTestDB(t)
	defer cleanup()

	staff1 := domain.Staff{
		Name:     "User One",
		Username: "user_one",
		Role:     domain.RoleCashier,
	}
	if _, err := s.CreateStaff(staff1, "3456"); err != nil {
		t.Fatalf("CreateStaff 1 failed: %v", err)
	}

	// Attempt to create staff with the same PIN
	staff2 := domain.Staff{
		Name:     "User Two",
		Username: "user_two",
		Role:     domain.RoleCashier,
	}
	_, err := s.CreateStaff(staff2, "3456")
	if err == nil {
		t.Fatal("Expected CreateStaff with duplicate PIN to fail")
	}

	var appErr *pkgerrors.AppError
	if errors.As(err, &appErr) {
		if appErr.Code != "DUPLICATE_PIN" {
			t.Errorf("Expected AppError code 'DUPLICATE_PIN', got %q", appErr.Code)
		}
	} else {
		t.Errorf("Expected *pkgerrors.AppError, got %T: %v", err, err)
	}

	// Attempt to update existing staff's password to an already-used PIN
	staff3 := domain.Staff{
		Name:     "User Three",
		Username: "user_three",
		Role:     domain.RoleCashier,
	}
	created3, err := s.CreateStaff(staff3, "7890")
	if err != nil {
		t.Fatalf("CreateStaff 3 failed: %v", err)
	}

	err = s.UpdateStaffPassword(created3.ID, "3456")
	if err == nil {
		t.Fatal("Expected UpdateStaffPassword with duplicate PIN to fail")
	}
	if errors.As(err, &appErr) {
		if appErr.Code != "DUPLICATE_PIN" {
			t.Errorf("Expected AppError code 'DUPLICATE_PIN', got %q", appErr.Code)
		}
	}
}

func TestEdge_DeleteStaff_LastAdmin_Rejected(t *testing.T) {
	s, _, cleanup := setupStaffEdgeTestDB(t)
	defer cleanup()

	// Seed default admin
	if err := s.SeedDefaultAdmin(); err != nil {
		t.Fatalf("SeedDefaultAdmin failed: %v", err)
	}

	all, _ := s.GetAllStaff()
	if len(all) != 1 {
		t.Fatalf("Expected 1 admin, got %d", len(all))
	}
	admin := all[0]

	// 1. Delete without force -> rejected
	err := s.DeleteStaff(admin.ID, false)
	if err == nil {
		t.Fatal("Expected DeleteStaff on last admin without force to fail")
	}

	var appErr *pkgerrors.AppError
	if errors.As(err, &appErr) {
		if appErr.Code != "LAST_ADMIN" {
			t.Errorf("Expected AppError code 'LAST_ADMIN', got %q", appErr.Code)
		}
	} else {
		t.Errorf("Expected *pkgerrors.AppError, got %T: %v", err, err)
	}

	// 2. Delete with force -> still rejected because system requires at least one admin
	err = s.DeleteStaff(admin.ID, true)
	if err == nil {
		t.Fatal("Expected DeleteStaff on last admin with force to fail")
	}
	if errors.As(err, &appErr) {
		if appErr.Code != "LAST_ADMIN" {
			t.Errorf("Expected AppError code 'LAST_ADMIN', got %q", appErr.Code)
		}
	}

	// Verify admin still exists
	reloaded, err := s.GetStaff(admin.ID)
	if err != nil || reloaded == nil {
		t.Errorf("Admin should not have been deleted: %v", err)
	}
}

func TestEdge_ToggleStaffStatus_DeactivatedCannotLogin(t *testing.T) {
	s, _, cleanup := setupStaffEdgeTestDB(t)
	defer cleanup()

	cashier := domain.Staff{
		Name:     "Toggle Cashier",
		Username: "toggle_cashier",
		Role:     domain.RoleCashier,
	}
	created, err := s.CreateStaff(cashier, "7788")
	if err != nil {
		t.Fatalf("CreateStaff failed: %v", err)
	}

	// 1. Deactivate cashier
	if err := s.ToggleStaffStatus(created.ID); err != nil {
		t.Fatalf("ToggleStaffStatus failed: %v", err)
	}

	updated, _ := s.GetStaff(created.ID)
	if updated.Active {
		t.Fatal("Expected staff to be inactive after toggle")
	}

	// 2. AuthenticateByUsername must fail
	userAuth, err := s.AuthenticateByUsername("toggle_cashier", "7788")
	if err != nil {
		t.Fatalf("AuthenticateByUsername returned unexpected error: %v", err)
	}
	if userAuth.Success {
		t.Error("Deactivated staff should NOT be able to log in by username")
	}

	// 3. AuthenticateByPIN must fail
	pinAuth, err := s.AuthenticateByPIN("7788")
	if err != nil {
		t.Fatalf("AuthenticateByPIN returned unexpected error: %v", err)
	}
	if pinAuth.Success {
		t.Error("Deactivated staff should NOT be able to log in by PIN")
	}

	// 4. Reactivate and verify login succeeds
	if err := s.ToggleStaffStatus(created.ID); err != nil {
		t.Fatalf("ToggleStaffStatus reactivation failed: %v", err)
	}

	reactivatedAuth, err := s.AuthenticateByPIN("7788")
	if err != nil {
		t.Fatalf("AuthenticateByPIN failed after reactivation: %v", err)
	}
	if !reactivatedAuth.Success {
		t.Errorf("Expected reactivated staff to authenticate by PIN, got message: %s", reactivatedAuth.Message)
	}
}

func TestEdge_RestoreSession_InvalidStaffID(t *testing.T) {
	s, _, cleanup := setupStaffEdgeTestDB(t)
	defer cleanup()

	// 1. Non-existent staff ID
	res, err := s.RestoreSession("non-existent-id-999")
	if err != nil {
		t.Fatalf("RestoreSession returned unexpected error: %v", err)
	}
	if res.Success {
		t.Error("Expected RestoreSession to return Success: false for non-existent ID")
	}
	if res.Message == "" {
		t.Error("Expected error message for invalid staff ID in RestoreSession")
	}

	// 2. Inactive staff ID
	cashier := domain.Staff{
		Name:     "Inactive User",
		Username: "inactive_user",
		Role:     domain.RoleCashier,
	}
	created, err := s.CreateStaff(cashier, "9182")
	if err != nil {
		t.Fatalf("CreateStaff failed: %v", err)
	}

	_ = s.ToggleStaffStatus(created.ID) // deactivate

	resInactive, err := s.RestoreSession(created.ID)
	if err != nil {
		t.Fatalf("RestoreSession returned unexpected error: %v", err)
	}
	if resInactive.Success {
		t.Error("Expected RestoreSession to return Success: false for inactive staff")
	}
}

func TestEdge_SeedDefaultAdmin_Idempotent(t *testing.T) {
	s, _, cleanup := setupStaffEdgeTestDB(t)
	defer cleanup()

	// Call SeedDefaultAdmin 3 times
	for i := 0; i < 3; i++ {
		if err := s.SeedDefaultAdmin(); err != nil {
			t.Fatalf("SeedDefaultAdmin call %d failed: %v", i+1, err)
		}
	}

	// Exactly 1 admin must exist
	allStaff, err := s.GetAllStaff()
	if err != nil {
		t.Fatalf("GetAllStaff failed: %v", err)
	}
	if len(allStaff) != 1 {
		t.Fatalf("Expected exactly 1 staff member after multiple seed calls, got %d", len(allStaff))
	}

	admin := allStaff[0]
	if admin.Username != "admin" {
		t.Errorf("Expected username 'admin', got %q", admin.Username)
	}
	if admin.Role != domain.RoleAdmin {
		t.Errorf("Expected role 'admin', got %q", admin.Role)
	}
}
