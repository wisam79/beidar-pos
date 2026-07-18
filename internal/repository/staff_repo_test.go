package repository

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestStaffRepository(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	repo := NewStaffRepository(db)

	t.Run("CreateAndRetrieveStaff", func(t *testing.T) {
		s1 := &domain.Staff{
			ID:           "staff-1",
			Username:     "cashier1",
			Name:         "John Doe",
			Role:         domain.RoleCashier,
			FastPIN:      "1234",
			Active:       true,
			Permissions:  []string{domain.PermSales},
			CreatedAt:    time.Now().Unix(),
		}
		s2 := &domain.Staff{
			ID:           "staff-2",
			Username:     "admin1",
			Name:         "Jane Smith",
			Role:         domain.RoleAdmin,
			FastPIN:      "5678",
			Active:       false,
			Permissions:  []string{domain.PermSettings},
			CreatedAt:    time.Now().Add(time.Second).Unix(),
		}

		if err := repo.Create(s1); err != nil {
			t.Fatalf("Failed to create staff 1: %v", err)
		}
		if err := repo.Create(s2); err != nil {
			t.Fatalf("Failed to create staff 2: %v", err)
		}

		gotByID, err := repo.GetByID("staff-1")
		if err != nil {
			t.Fatalf("GetByID failed: %v", err)
		}
		if gotByID.Username != "cashier1" {
			t.Errorf("Expected username 'cashier1', got %q", gotByID.Username)
		}

		gotByUsername, err := repo.GetByUsername("admin1")
		if err != nil {
			t.Fatalf("GetByUsername failed: %v", err)
		}
		if gotByUsername.ID != "staff-2" {
			t.Errorf("Expected ID 'staff-2', got %q", gotByUsername.ID)
		}

		gotByPIN, err := repo.GetByFastPIN("1234")
		if err != nil {
			t.Fatalf("GetByFastPIN failed: %v", err)
		}
		if gotByPIN.Name != "John Doe" {
			t.Errorf("Expected name 'John Doe', got %q", gotByPIN.Name)
		}

		// Non-active or wrong PIN should return error
		_, err = repo.GetByFastPIN("5678") // s2 is inactive
		if err == nil {
			t.Error("Expected error fetching PIN for inactive staff")
		}
	})

	t.Run("GetAllAndActive", func(t *testing.T) {
		all, err := repo.GetAll()
		if err != nil {
			t.Fatalf("GetAll failed: %v", err)
		}
		if len(all) != 2 {
			t.Errorf("Expected 2 staff members, got %d", len(all))
		}

		active, err := repo.GetActive()
		if err != nil {
			t.Fatalf("GetActive failed: %v", err)
		}
		if len(active) != 1 || active[0].ID != "staff-1" {
			t.Errorf("Expected 1 active staff member (staff-1), got %d", len(active))
		}
	})

	t.Run("UpdateAndUpdatesAndCounts", func(t *testing.T) {
		s, _ := repo.GetByID("staff-1")
		s.Name = "John updated"
		if err := repo.Update(s); err != nil {
			t.Fatalf("Update failed: %v", err)
		}

		got, _ := repo.GetByID("staff-1")
		if got.Name != "John updated" {
			t.Errorf("Expected name 'John updated', got %q", got.Name)
		}

		err := repo.Updates("staff-1", map[string]interface{}{"active": false})
		if err != nil {
			t.Fatalf("Updates failed: %v", err)
		}
		got2, _ := repo.GetByID("staff-1")
		if got2.Active {
			t.Error("Expected active status to be false")
		}

		count, err := repo.GetStaffCount()
		if err != nil {
			t.Fatalf("GetStaffCount failed: %v", err)
		}
		if count != 2 {
			t.Errorf("Expected count 2, got %d", count)
		}

		adminCount, err := repo.CountByRole(domain.RoleAdmin)
		if err != nil {
			t.Fatalf("CountByRole failed: %v", err)
		}
		if adminCount != 1 {
			t.Errorf("Expected 1 admin, got %d", adminCount)
		}
	})

	t.Run("SalesAndPaymentsCounts", func(t *testing.T) {
		sale := &domain.Sale{
			ID:        "sale-1",
			StaffID:   "staff-1",
			Total:     10000,
			Timestamp: time.Now().Unix(),
			Date:      time.Now().Format("2006-01-02"),
		}
		if err := db.Create(sale).Error; err != nil {
			t.Fatalf("Failed to create seed sale: %v", err)
		}

		payment := &domain.Payment{
			StaffID:   "staff-1",
			SaleID:    "sale-1",
			Amount:    10000,
			Timestamp: time.Now().Unix(),
		}
		if err := db.Create(payment).Error; err != nil {
			t.Fatalf("Failed to create seed payment: %v", err)
		}

		sc, err := repo.GetStaffSalesCount("staff-1")
		if err != nil {
			t.Fatalf("GetStaffSalesCount failed: %v", err)
		}
		if sc != 1 {
			t.Errorf("Expected 1 sale for staff-1, got %d", sc)
		}

		pc, err := repo.GetStaffPaymentsCount("staff-1")
		if err != nil {
			t.Fatalf("GetStaffPaymentsCount failed: %v", err)
		}
		if pc != 1 {
			t.Errorf("Expected 1 payment for staff-1, got %d", pc)
		}
	})

	t.Run("LoginAttempts", func(t *testing.T) {
		attempt := &domain.LoginAttempt{
			Identifier:  "staff-1",
			Attempts:    3,
			LockedUntil: time.Now().Add(time.Hour).Unix(),
		}

		if err := repo.SaveLoginAttempt(attempt); err != nil {
			t.Fatalf("SaveLoginAttempt failed: %v", err)
		}

		got, err := repo.GetLoginAttempt("staff-1")
		if err != nil {
			t.Fatalf("GetLoginAttempt failed: %v", err)
		}
		if got.Attempts != 3 {
			t.Errorf("Expected 3 attempts, got %d", got.Attempts)
		}

		if err := repo.DeleteLoginAttempt("staff-1"); err != nil {
			t.Fatalf("DeleteLoginAttempt failed: %v", err)
		}

		_, err = repo.GetLoginAttempt("staff-1")
		if err == nil {
			t.Error("Expected error fetching deleted login attempt")
		}
	})

	t.Run("DeleteStaff", func(t *testing.T) {
		if err := repo.Delete("staff-2"); err != nil {
			t.Fatalf("Delete failed: %v", err)
		}

		_, err := repo.GetByID("staff-2")
		if err == nil {
			t.Error("Expected error fetching deleted staff member")
		}
	})
}
