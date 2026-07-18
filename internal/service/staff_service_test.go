package service_test

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
	"beidar-desktop/pkg/logger"
	"testing"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"time"
)

func setupStaffTestDB(t *testing.T) (service.StaffService, *gorm.DB, func()) {
	logger.InitLogger(logger.INFO, false)
	db, cleanup := testutil.SetupDB(t,
		&domain.Staff{}, &domain.LoginAttempt{}, &domain.Sale{}, &domain.Payment{},
	)

	staffRepo := repository.NewStaffRepository(db)
	staffService := service.NewStaffService(staffRepo)

	return staffService, db, cleanup
}

func TestStaffCRUDAndAuth(t *testing.T) {
	t.Run("SeedDefaultAdmin", func(t *testing.T) {
		s, _, cleanup := setupStaffTestDB(t)
		defer cleanup()

		if err := s.SeedDefaultAdmin(); err != nil {
			t.Fatalf("SeedDefaultAdmin failed: %v", err)
		}

		all, _ := s.GetAllStaff()
		if len(all) != 1 {
			t.Errorf("Expected 1 seeded admin, got %d", len(all))
		}
		admin := all[0]
		if admin.Username != "admin" {
			t.Errorf("Expected username 'admin', got '%s'", admin.Username)
		}
	})

	t.Run("AuthenticateByUsername", func(t *testing.T) {
		s, _, cleanup := setupStaffTestDB(t)
		defer cleanup()

		if err := s.SeedDefaultAdmin(); err != nil {
			t.Fatalf("SeedDefaultAdmin failed: %v", err)
		}

		res, err := s.AuthenticateByUsername("admin", "0000")
		if err != nil {
			t.Fatalf("AuthenticateByUsername error: %v", err)
		}
		if !res.Success {
			t.Errorf("Auth failed: %s", res.Message)
		}
		if !res.RequirePINChange {
			t.Error("Seeded admin should require PIN change because it is using default PIN")
		}
	})

	t.Run("CreateStaffAndAuthenticateByPIN", func(t *testing.T) {
		s, _, cleanup := setupStaffTestDB(t)
		defer cleanup()

		cashier := domain.Staff{
			Name:     "Karrar Cashier",
			Username: "karrar",
			Role:     domain.RoleCashier,
		}
		created, err := s.CreateStaff(cashier, "4321")
		if err != nil {
			t.Fatalf("CreateStaff failed: %v", err)
		}

		if len(created.Permissions) != len(service.RolePermissions[domain.RoleCashier]) {
			t.Errorf("Expected permissions for cashier role, got %v", created.Permissions)
		}

		// Test AuthenticateByPIN (Fast O(1) matching)
		pinRes, err := s.AuthenticateByPIN("4321")
		if err != nil {
			t.Fatalf("AuthenticateByPIN error: %v", err)
		}
		if !pinRes.Success {
			t.Errorf("PIN Auth failed: %s", pinRes.Message)
		}
		if pinRes.Staff.Username != "karrar" {
			t.Errorf("Expected cashier staff, got '%s'", pinRes.Staff.Username)
		}

		// Verify FastPIN was indexed
		updatedCashier, _ := s.GetStaff(created.ID)
		if updatedCashier.FastPIN == "" {
			t.Error("FastPIN should be populated after successful login")
		}
	})

	t.Run("RateLimitingLockout", func(t *testing.T) {
		s, _, cleanup := setupStaffTestDB(t)
		defer cleanup()

		if err := s.SeedDefaultAdmin(); err != nil {
			t.Fatalf("SeedDefaultAdmin failed: %v", err)
		}

		for i := 0; i < 5; i++ {
			_, _ = s.AuthenticateByUsername("admin", "wrong_pin")
		}

		lockRes, _ := s.AuthenticateByUsername("admin", "0000")
		if lockRes.Success {
			t.Error("Expected login to be locked out after 5 failures")
		}
	})
}

func TestStaffPermissions(t *testing.T) {
	s, _, cleanup := setupStaffTestDB(t)
	defer cleanup()

	cashier := domain.Staff{
		Name:     "Ali Cashier",
		Username: "ali",
		Role:     domain.RoleCashier,
	}
	created, _ := s.CreateStaff(cashier, "9999")

	hasSales, _ := s.HasPermission(created.ID, domain.PermSales)
	if !hasSales {
		t.Error("Cashier should have sales permission")
	}

	hasSettings, _ := s.HasPermission(created.ID, domain.PermSettings)
	if hasSettings {
		t.Error("Cashier should NOT have settings permission")
	}
}

func TestStaffUpdateAndDelete(t *testing.T) {
	s, db, cleanup := setupStaffTestDB(t)
	defer cleanup()

	// 1. Seed default admin
	if err := s.SeedDefaultAdmin(); err != nil {
		t.Fatalf("SeedDefaultAdmin failed: %v", err)
	}

	all, _ := s.GetAllStaff()
	admin := all[0]

	// Create another user
	cashier := domain.Staff{
		Name:     "Initial Cashier",
		Username: "initcashier",
		Role:     domain.RoleCashier,
		Email:    "test@example.com",
		Phone:    "07701234567",
	}
	created, err := s.CreateStaff(cashier, "9999")
	if err != nil {
		t.Fatalf("CreateStaff failed: %v", err)
	}

	// Update details
	created.Name = "Updated Cashier"
	created.Username = "updatedcashier"
	created.Phone = "07801234567"
	created.Email = "updated@example.com"
	if err := s.UpdateStaff(*created); err != nil {
		t.Fatalf("UpdateStaff failed: %v", err)
	}

	// Verify update
	updated, _ := s.GetStaff(created.ID)
	if updated.Name != "Updated Cashier" || updated.Phone != "07801234567" {
		t.Errorf("Staff updates not saved properly: %+v", updated)
	}

	// Try update with missing ID
	noID := *created
	noID.ID = ""
	if err := s.UpdateStaff(noID); err == nil {
		t.Error("Expected error when updating staff without ID")
	}

	// Try update with short name
	shortName := *created
	shortName.Name = "a"
	if err := s.UpdateStaff(shortName); err == nil {
		t.Error("Expected error when updating staff with too short name")
	}

	// Try update with invalid username
	badUser := *created
	badUser.Username = "u"
	if err := s.UpdateStaff(badUser); err == nil {
		t.Error("Expected error when updating staff with invalid username")
	}

	// Try update with duplicate username
	dupUser := *created
	dupUser.Username = "admin"
	if err := s.UpdateStaff(dupUser); err == nil {
		t.Error("Expected error when updating staff with duplicate username")
	}

	// Try update with invalid email
	badEmail := *created
	badEmail.Email = "invalid-email"
	if err := s.UpdateStaff(badEmail); err == nil {
		t.Error("Expected error when updating staff with invalid email")
	}

	// Try update with invalid phone
	badPhone := *created
	badPhone.Phone = "12345"
	if err := s.UpdateStaff(badPhone); err == nil {
		t.Error("Expected error when updating staff with invalid phone")
	}

	// Try demoting the last admin
	demoteAdmin := admin
	demoteAdmin.Role = domain.RoleCashier
	if err := s.UpdateStaff(demoteAdmin); err == nil {
		t.Error("Expected error when demoting last admin")
	}

	// Update staff password (admin password)
	if err := s.UpdateStaffPassword(admin.ID, "adminpass"); err != nil {
		t.Fatalf("UpdateStaffPassword failed for admin: %v", err)
	}

	// Update staff password (cashier pin - too short)
	if err := s.UpdateStaffPassword(created.ID, "12"); err == nil {
		t.Error("Expected error when updating cashier PIN with short pin")
	}

	// Update staff password (cashier pin - non numeric)
	if err := s.UpdateStaffPassword(created.ID, "abcd"); err == nil {
		t.Error("Expected error when updating cashier PIN with non-numeric pin")
	}

	// Update staff password (cashier pin - weak pin)
	if err := s.UpdateStaffPassword(created.ID, "1234"); err == nil {
		t.Error("Expected error when updating cashier PIN with default/weak pin")
	}

	// Update staff password (cashier pin - valid)
	if err := s.UpdateStaffPassword(created.ID, "9876"); err != nil {
		t.Fatalf("UpdateStaffPassword failed for cashier: %v", err)
	}

	// Update staff password (invalid ID)
	if err := s.UpdateStaffPassword("invalid-id", "9876"); err == nil {
		t.Error("Expected error when updating password for non-existent staff")
	}

	// Toggle status
	if err := s.ToggleStaffStatus(created.ID); err != nil {
		t.Fatalf("ToggleStaffStatus failed: %v", err)
	}
	toggled, _ := s.GetStaff(created.ID)
	if toggled.Active {
		t.Error("Staff should be inactive after toggle")
	}

	// Delete Staff (soft delete because of active data)
	// Seed a sale associated with this staff
	db.Create(&domain.Sale{ID: "sale_staff_test", StaffID: created.ID})
	if err := s.DeleteStaff(created.ID, false); err != nil {
		t.Fatalf("DeleteStaff soft-delete failed: %v", err)
	}
	softDeleted, _ := s.GetStaff(created.ID)
	if softDeleted.Active {
		t.Error("Expected staff to be deactivated on soft delete")
	}

	// Delete staff (hard delete)
	// Clear associated sale first
	db.Exec("DELETE FROM sales WHERE staff_id = ?", created.ID)
	if err := s.DeleteStaff(created.ID, false); err != nil {
		t.Fatalf("DeleteStaff hard-delete failed: %v", err)
	}
	deleted, _ := s.GetStaff(created.ID)
	if deleted != nil {
		t.Error("Expected staff to be hard-deleted")
	}

	// Prevent deleting last admin
	if err := s.DeleteStaff(admin.ID, false); err == nil {
		t.Error("Expected error when deleting last admin")
	}

	// Attempt delete non-existent staff
	if err := s.DeleteStaff("invalid-id", false); err == nil {
		t.Error("Expected error when deleting non-existent staff")
	}
}

func TestStaffValidationAndCounts(t *testing.T) {
	s, _, cleanup := setupStaffTestDB(t)
	defer cleanup()

	// Initial counts
	count, _ := s.GetStaffCount()
	if count != 0 {
		t.Errorf("Expected staff count 0, got %d", count)
	}

	// Seed admin
	_ = s.SeedDefaultAdmin()
	count, _ = s.GetStaffCount()
	if count != 1 {
		t.Errorf("Expected staff count 1, got %d", count)
	}

	all, _ := s.GetAllStaff()
	admin := all[0]

	// Check IsUsingDefaultPassword
	isDefault, err := s.IsUsingDefaultPassword(admin.ID)
	if err != nil {
		t.Fatalf("IsUsingDefaultPassword failed: %v", err)
	}
	if !isDefault {
		t.Error("Seeded admin should be using default password")
	}

	// Check non-existent user
	_, err = s.IsUsingDefaultPassword("invalid-id")
	if err == nil {
		t.Error("Expected error checking default password for non-existent staff")
	}

	// Get active staff
	active, _ := s.GetActiveStaff()
	if len(active) != 1 {
		t.Errorf("Expected 1 active staff, got %d", len(active))
	}

	// Create staff with validation errors (CreateStaff validation branches)
	badName := domain.Staff{Name: "a", Username: "cashier1", Role: domain.RoleCashier}
	_, err = s.CreateStaff(badName, "9999")
	if err == nil {
		t.Error("Expected error creating staff with invalid name")
	}

	badUser := domain.Staff{Name: "Valid Name", Username: "us", Role: domain.RoleCashier}
	_, err = s.CreateStaff(badUser, "9999")
	if err == nil {
		t.Error("Expected error creating staff with invalid username")
	}

	noPass := domain.Staff{Name: "Valid Name", Username: "validuser", Role: domain.RoleCashier}
	_, err = s.CreateStaff(noPass, "")
	if err == nil {
		t.Error("Expected error creating staff with empty password")
	}

	shortAdminPass := domain.Staff{Name: "Valid Admin", Username: "admin2", Role: domain.RoleAdmin}
	_, err = s.CreateStaff(shortAdminPass, "123")
	if err == nil {
		t.Error("Expected error creating admin with weak/short password")
	}

	nonNumPin := domain.Staff{Name: "Valid Name", Username: "validuser", Role: domain.RoleCashier}
	_, err = s.CreateStaff(nonNumPin, "abcd")
	if err == nil {
		t.Error("Expected error creating cashier with non-numeric PIN")
	}

	badEmail := domain.Staff{Name: "Valid Name", Username: "validuser", Role: domain.RoleCashier, Email: "bad"}
	_, err = s.CreateStaff(badEmail, "9999")
	if err == nil {
		t.Error("Expected error creating staff with invalid email")
	}

	badPhone := domain.Staff{Name: "Valid Name", Username: "validuser", Role: domain.RoleCashier, Phone: "0551234567"}
	_, err = s.CreateStaff(badPhone, "9999")
	if err == nil {
		t.Error("Expected error creating staff with invalid phone")
	}
}

func TestStaffService_PinAuthEdgeCases(t *testing.T) {
	s, db, cleanup := setupStaffTestDB(t)
	defer cleanup()

	// 1. Setup rate limit lockout test
	db.Create(&domain.LoginAttempt{
		Identifier:  "pin_auth",
		Attempts:    50,
		LockedUntil: time.Now().Unix() + 100,
	})

	lockRes, err := s.AuthenticateByPIN("1234")
	if err != nil {
		t.Fatalf("AuthenticateByPIN rate limit check failed: %v", err)
	}
	if lockRes.Success {
		t.Error("Expected PIN Auth to be locked out")
	}

	// Clear attempts for next test
	db.Exec("DELETE FROM login_attempts")

	// 2. First failure test (wrong PIN, no previous attempts)
	// Because wrong login sleeps for 2 seconds, we can just run it once.
	failRes, err := s.AuthenticateByPIN("0000") // 0000 is default but no user with this exists yet
	if err != nil {
		t.Fatalf("AuthenticateByPIN failed: %v", err)
	}
	if failRes.Success {
		t.Error("Expected PIN Auth to fail for non-existent PIN")
	}

	// 3. Subsequent failure with remaining attempts > 0
	db.Exec("DELETE FROM login_attempts")
	db.Create(&domain.LoginAttempt{
		Identifier:  "pin_auth",
		Attempts:    2,
		LastAttempt: time.Now().Unix(),
	})
	failRes2, err := s.AuthenticateByPIN("0000")
	if err != nil {
		t.Fatalf("AuthenticateByPIN failed: %v", err)
	}
	if failRes2.Success {
		t.Error("Expected PIN Auth to fail")
	}
	// Verify it returned remaining attempts message
	if failRes2.Message == "" {
		t.Error("Expected failure message with remaining attempts info")
	}

	// Clear attempts again
	db.Exec("DELETE FROM login_attempts")

	// 4. Fallback and Lazy Migration test
	hash, err := bcrypt.GenerateFromPassword([]byte("5555"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("Failed to generate password hash: %v", err)
	}
	cashierID := uuid.New().String()
	created := domain.Staff{
		ID:           cashierID,
		Name:         "Hassan Cashier",
		Username:     "hassan",
		Role:         domain.RoleCashier,
		Active:       true,
		PasswordHash: string(hash),
		FastPIN:      "", // explicitly empty to test lazy migration fallback
		CreatedAt:    time.Now().Unix(),
	}
	if err := db.Create(&created).Error; err != nil {
		t.Fatalf("Failed to insert cashier directly: %v", err)
	}

	// Cashier has no FastPIN initially in the DB
	if created.FastPIN != "" {
		t.Error("Expected FastPIN to be empty initially")
	}

	// AuthenticateByPIN - hits fallback because FastPIN is empty, matches cashier via loop, saves FastPIN
	res, err := s.AuthenticateByPIN("5555")
	if err != nil {
		t.Fatalf("AuthenticateByPIN fallback failed: %v", err)
	}
	if !res.Success {
		t.Errorf("PIN Auth failed: %s", res.Message)
	}

	// Verify FastPIN is now populated
	updated, err := s.GetStaff(created.ID)
	if err != nil {
		t.Fatalf("GetStaff failed: %v", err)
	}
	if updated.FastPIN == "" {
		t.Error("Expected FastPIN to be populated after fallback login")
	}

	// Second authentication - should hit O(1) FastPIN match directly
	res2, err := s.AuthenticateByPIN("5555")
	if err != nil {
		t.Fatalf("AuthenticateByPIN O(1) failed: %v", err)
	}
	if !res2.Success {
		t.Errorf("O(1) PIN Auth failed: %s", res2.Message)
	}
}

func TestStaffService_UniquePin(t *testing.T) {
	s, _, cleanup := setupStaffTestDB(t)
	defer cleanup()

	// 1. Create a staff member with PIN "8254"
	staff1 := domain.Staff{
		Name:     "Staff One",
		Username: "staff1",
		Role:     domain.RoleCashier,
	}
	_, err := s.CreateStaff(staff1, "8254")
	if err != nil {
		t.Fatalf("CreateStaff 1 failed: %v", err)
	}

	// 2. Create another staff member with the SAME PIN "8254" -> should fail
	staff2 := domain.Staff{
		Name:     "Staff Two",
		Username: "staff2",
		Role:     domain.RoleCashier,
	}
	_, err = s.CreateStaff(staff2, "8254")
	if err == nil {
		t.Error("Expected CreateStaff with duplicate PIN to fail")
	}

	// 3. Create a staff member with a different PIN "9761"
	staff3 := domain.Staff{
		Name:     "Staff Three",
		Username: "staff3",
		Role:     domain.RoleCashier,
	}
	created3, err := s.CreateStaff(staff3, "9761")
	if err != nil {
		t.Fatalf("CreateStaff 3 failed: %v", err)
	}

	// 4. Update password of Staff Three to "8254" (duplicate of Staff One) -> should fail
	err = s.UpdateStaffPassword(created3.ID, "8254")
	if err == nil {
		t.Error("Expected UpdateStaffPassword with duplicate PIN to fail")
	}
}

