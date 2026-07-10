package service

import (
	"beidar-desktop/internal/core/domain"
	pkgerrors "beidar-desktop/pkg/errors"
	"beidar-desktop/pkg/i18n"
	"beidar-desktop/pkg/logger"
	"crypto/sha256"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// RolePermissions defines default permissions for each role.
// Permission strings are defined in domain — do not redeclare duplicates here.
var RolePermissions = map[domain.Role][]string{
	domain.RoleAdmin: {
		domain.PermSales, domain.PermProducts, domain.PermInventory, domain.PermCustomers, domain.PermInvoices,
		domain.PermReports, domain.PermFinance, domain.PermSettings, domain.PermStaffManage, domain.PermDiscounts,
		domain.PermDeleteSales, domain.PermEditPrices, domain.PermExportData,
	},
	domain.RoleManager: {
		domain.PermSales, domain.PermProducts, domain.PermInventory, domain.PermCustomers, domain.PermInvoices,
		domain.PermReports, domain.PermFinance, domain.PermDiscounts, domain.PermDeleteSales, domain.PermEditPrices,
	},
	domain.RoleCashier: {
		domain.PermSales, domain.PermCustomers, domain.PermInvoices,
	},
	domain.RoleViewer: {
		// Read-only
	},
}

type staffService struct {
	staffRepo domain.StaffRepository
}

// NewStaffService creates a new instance of domain.StaffService
func NewStaffService(staffRepo domain.StaffRepository) domain.StaffService {
	return &staffService{
		staffRepo: staffRepo,
	}
}

// Lockout settings
const (
	MaxLoginAttempts     = 5
	MaxGlobalPinAttempts = 50
	LockoutDuration      = 15 * 60 // 15 minutes
)

func (s *staffService) checkRateLimit(identifier string) (bool, string, error) {
	attempt, err := s.staffRepo.GetLoginAttempt(identifier)
	if err != nil {
		return false, "", nil // No record = not locked
	}

	if attempt.LockedUntil > time.Now().Unix() {
		remaining := attempt.LockedUntil - time.Now().Unix()
		mins := remaining / 60
		if mins < 1 {
			return true, i18n.GetMessage("ACCOUNT_LOCKED_SHORT"), nil
		}
		return true, i18n.GetMessage("ACCOUNT_LOCKED_MINUTES", mins), nil
	}

	return false, "", nil
}

func (s *staffService) recordFailedAttempt(identifier string, maxAttempts int) error {
	attempt, err := s.staffRepo.GetLoginAttempt(identifier)
	if err != nil {
		// Create new record
		newAttempt := domain.LoginAttempt{
			Identifier:  identifier,
			Attempts:    1,
			LastAttempt: time.Now().Unix(),
		}
		return s.staffRepo.SaveLoginAttempt(&newAttempt)
	}

	attempt.Attempts++
	attempt.LastAttempt = time.Now().Unix()

	if attempt.Attempts >= maxAttempts {
		attempt.LockedUntil = time.Now().Unix() + LockoutDuration
		logger.Logger.Warn("SECURITY", fmt.Sprintf("Account locked: %s after %d attempts", identifier, attempt.Attempts))
	}

	return s.staffRepo.SaveLoginAttempt(attempt)
}

func (s *staffService) clearLoginAttempts(identifier string) error {
	return s.staffRepo.DeleteLoginAttempt(identifier)
}

func (s *staffService) CreateStaff(staff domain.Staff, password string) (*domain.Staff, error) {
	if len(staff.Name) < 2 {
		return nil, pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"STAFF_INVALID_NAME",
			i18n.GetMessage("STAFF_INVALID_NAME"),
			i18n.GetHint("STAFF_INVALID_NAME"),
			"name",
		)
	}

	if len(staff.Username) < 3 || len(staff.Username) > 20 {
		return nil, pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"INVALID_USERNAME",
			i18n.GetMessage("INVALID_USERNAME"),
			i18n.GetHint("INVALID_USERNAME"),
			"username",
		)
	}

	existing, _ := s.staffRepo.GetByUsername(staff.Username)
	if existing != nil {
		return nil, pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"DUPLICATE_USERNAME",
			i18n.GetMessage("DUPLICATE_USERNAME", staff.Username),
			i18n.GetHint("DUPLICATE_USERNAME"),
			"username",
		)
	}

	if password == "" {
		return nil, pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"PASSWORD_REQUIRED",
			i18n.GetMessage("PASSWORD_REQUIRED"),
			i18n.GetHint("PASSWORD_REQUIRED"),
			"password",
		)
	}

	if staff.Role == domain.RoleAdmin {
		if len(password) < 4 {
			return nil, pkgerrors.NewAppError(
				pkgerrors.ModuleStaff,
				"WEAK_PASSWORD",
				i18n.GetMessage("WEAK_PASSWORD"),
				i18n.GetHint("WEAK_PASSWORD"),
				"password",
			)
		}
	} else {
		if len(password) != 4 {
			return nil, pkgerrors.NewAppError(
				pkgerrors.ModuleStaff,
				"PIN_TOO_SHORT",
				i18n.GetMessage("PIN_TOO_SHORT"),
				i18n.GetHint("PIN_TOO_SHORT"),
				"password",
			)
		}
		for _, c := range password {
			if c < '0' || c > '9' {
				return nil, pkgerrors.NewAppError(
					pkgerrors.ModuleStaff,
					"PIN_NOT_NUMERIC",
					i18n.GetMessage("PIN_NOT_NUMERIC"),
					i18n.GetHint("PIN_NOT_NUMERIC"),
					"password",
				)
			}
		}
		if s.CheckUsingDefaultPassword(password) {
			return nil, pkgerrors.NewAppError(
				pkgerrors.ModuleStaff,
				"WEAK_PIN",
				i18n.GetMessage("WEAK_PIN"),
				i18n.GetHint("WEAK_PIN"),
				"password",
			)
		}
	}

	if staff.Email != "" {
		if !s.isValidEmail(staff.Email) {
			return nil, pkgerrors.NewAppError(
				pkgerrors.ModuleStaff,
				"INVALID_EMAIL",
				i18n.GetMessage("INVALID_EMAIL", staff.Email),
				i18n.GetHint("INVALID_EMAIL"),
				"email",
			)
		}
	}

	if staff.Phone != "" {
		if !s.isValidIraqiPhone(staff.Phone) {
			return nil, pkgerrors.NewAppError(
				pkgerrors.ModuleStaff,
				"STAFF_INVALID_PHONE",
				i18n.GetMessage("STAFF_INVALID_PHONE", staff.Phone),
				i18n.GetHint("STAFF_INVALID_PHONE"),
				"phone",
			)
		}
	}

	if staff.ID == "" {
		staff.ID = uuid.New().String()
	}
	staff.CreatedAt = time.Now().Unix()
	staff.Active = true

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"DATABASE_ERROR",
			i18n.GetMessage("DATABASE_ERROR"),
			err.Error(),
			"",
		)
	}
	staff.PasswordHash = string(hash)
	staff.FastPIN = s.generateFastPIN(password)

	if len(staff.Permissions) == 0 {
		staff.Permissions = RolePermissions[staff.Role]
	}

	if err := s.staffRepo.Create(&staff); err != nil {
		return nil, err
	}
	return &staff, nil
}

func (s *staffService) UpdateStaff(staff domain.Staff) error {
	if staff.ID == "" {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"MISSING_STAFF_ID",
			i18n.GetMessage("MISSING_STAFF_ID"),
			i18n.GetHint("MISSING_STAFF_ID"),
			"id",
		)
	}

	if len(staff.Name) < 2 {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"STAFF_INVALID_NAME",
			i18n.GetMessage("STAFF_INVALID_NAME"),
			i18n.GetHint("STAFF_INVALID_NAME"),
			"name",
		)
	}

	if len(staff.Username) < 3 || len(staff.Username) > 20 {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"INVALID_USERNAME",
			i18n.GetMessage("INVALID_USERNAME"),
			i18n.GetHint("INVALID_USERNAME"),
			"username",
		)
	}

	existing, _ := s.staffRepo.GetByUsername(staff.Username)
	if existing != nil && existing.ID != staff.ID {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"DUPLICATE_USERNAME",
			i18n.GetMessage("DUPLICATE_USERNAME", staff.Username),
			i18n.GetHint("DUPLICATE_USERNAME"),
			"username",
		)
	}

	if staff.Email != "" && !s.isValidEmail(staff.Email) {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"INVALID_EMAIL",
			i18n.GetMessage("INVALID_EMAIL", staff.Email),
			i18n.GetHint("INVALID_EMAIL"),
			"email",
		)
	}

	if staff.Phone != "" && !s.isValidIraqiPhone(staff.Phone) {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"STAFF_INVALID_PHONE",
			i18n.GetMessage("STAFF_INVALID_PHONE", staff.Phone),
			i18n.GetHint("STAFF_INVALID_PHONE"),
			"phone",
		)
	}

	current, err := s.staffRepo.GetByID(staff.ID)
	if err != nil {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"STAFF_NOT_FOUND",
			i18n.GetMessage("STAFF_NOT_FOUND"),
			i18n.GetHint("STAFF_NOT_FOUND"),
			"id",
		)
	}

	if current.Role == domain.RoleAdmin && staff.Role != domain.RoleAdmin {
		adminCount, err := s.staffRepo.CountByRole(domain.RoleAdmin)
		if err == nil && adminCount <= 1 {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleStaff,
				"LAST_ADMIN",
				i18n.GetMessage("LAST_ADMIN"),
				i18n.GetHint("LAST_ADMIN"),
				"role",
			)
		}
	}

	// Fetch current to maintain hashed password, etc.
	current.Name = staff.Name
	current.Username = staff.Username
	current.Role = staff.Role
	current.Phone = staff.Phone
	current.Email = staff.Email
	current.Active = staff.Active
	current.MustChangePin = staff.MustChangePin
	current.Permissions = staff.Permissions
	if len(current.Permissions) == 0 {
		current.Permissions = RolePermissions[current.Role]
	}

	return s.staffRepo.Update(current)
}

func (s *staffService) UpdateStaffPassword(id string, newPassword string) error {
	staff, err := s.staffRepo.GetByID(id)
	if err != nil {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"STAFF_NOT_FOUND",
			i18n.GetMessage("STAFF_NOT_FOUND"),
			i18n.GetHint("STAFF_NOT_FOUND"),
			"id",
		)
	}

	if staff.Role == domain.RoleAdmin {
		if len(newPassword) < 4 {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleStaff,
				"WEAK_PASSWORD",
				i18n.GetMessage("WEAK_PASSWORD"),
				i18n.GetHint("WEAK_PASSWORD"),
				"password",
			)
		}
	} else {
		if len(newPassword) != 4 {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleStaff,
				"PIN_TOO_SHORT",
				i18n.GetMessage("PIN_TOO_SHORT"),
				i18n.GetHint("PIN_TOO_SHORT"),
				"password",
			)
		}
		for _, c := range newPassword {
			if c < '0' || c > '9' {
				return pkgerrors.NewAppError(
					pkgerrors.ModuleStaff,
					"PIN_NOT_NUMERIC",
					i18n.GetMessage("PIN_NOT_NUMERIC"),
					i18n.GetHint("PIN_NOT_NUMERIC"),
					"password",
				)
			}
		}
		if s.CheckUsingDefaultPassword(newPassword) {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleStaff,
				"WEAK_PIN",
				i18n.GetMessage("WEAK_PIN"),
				i18n.GetHint("WEAK_PIN"),
				"password",
			)
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	staff.PasswordHash = string(hash)
	staff.FastPIN = s.generateFastPIN(newPassword)
	staff.MustChangePin = false

	return s.staffRepo.Update(staff)
}

func (s *staffService) DeleteStaff(id string, force bool) error {
	staff, err := s.staffRepo.GetByID(id)
	if err != nil {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"STAFF_NOT_FOUND",
			i18n.GetMessage("STAFF_NOT_FOUND"),
			i18n.GetHint("STAFF_NOT_FOUND"),
			"id",
		)
	}

	if staff.Role == domain.RoleAdmin {
		adminCount, err := s.staffRepo.CountByRole(domain.RoleAdmin)
		if err == nil && adminCount <= 1 {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleStaff,
				"LAST_ADMIN",
				i18n.GetMessage("LAST_ADMIN"),
				i18n.GetHint("LAST_ADMIN"),
				"role",
			)
		}
	}

	salesCount, err := s.staffRepo.GetStaffSalesCount(id)
	if err != nil {
		return err
	}

	paymentsCount, err := s.staffRepo.GetStaffPaymentsCount(id)
	if err != nil {
		return err
	}

	hasAssociatedData := salesCount > 0 || paymentsCount > 0

	if hasAssociatedData && !force {
		// Soft delete: deactivate
		staff.Active = false
		if err := s.staffRepo.Update(staff); err != nil {
			return errors.New(i18n.GetMessage("DISABLE_STAFF_FAILED", err.Error()))
		}
		return nil
	}

	if err := s.staffRepo.Delete(id); err != nil {
		return errors.New(i18n.GetMessage("DELETE_STAFF_FAILED", err.Error()))
	}
	return nil
}

func (s *staffService) GetStaff(id string) (*domain.Staff, error) {
	return s.staffRepo.GetByID(id)
}

func (s *staffService) GetAllStaff() ([]domain.Staff, error) {
	return s.staffRepo.GetAll()
}

func (s *staffService) GetActiveStaff() ([]domain.Staff, error) {
	return s.staffRepo.GetActive()
}

func (s *staffService) ToggleStaffStatus(id string) error {
	staff, err := s.staffRepo.GetByID(id)
	if err != nil {
		return err
	}
	staff.Active = !staff.Active
	return s.staffRepo.Update(staff)
}

func (s *staffService) AuthenticateByUsername(username, password string) (*domain.AuthResult, error) {
	locked, msg, err := s.checkRateLimit(username)
	if err != nil {
		return nil, err
	}
	if locked {
		return &domain.AuthResult{Success: false, Message: msg}, nil
	}

	staff, err := s.staffRepo.GetByUsername(username)
	if err != nil || !staff.Active {
		_ = s.recordFailedAttempt(username, MaxLoginAttempts)
		logger.Logger.Warn("SECURITY", fmt.Sprintf("Login failed: Username %s not found or inactive", username))
		return &domain.AuthResult{Success: false, Message: i18n.GetMessage("INVALID_CREDENTIALS")}, nil
	}

	if err := bcrypt.CompareHashAndPassword([]byte(staff.PasswordHash), []byte(password)); err != nil {
		_ = s.recordFailedAttempt(username, MaxLoginAttempts)
		logger.Logger.Warn("SECURITY", fmt.Sprintf("Login failed: Incorrect PIN for username %s", username))

		attempt, err := s.staffRepo.GetLoginAttempt(username)
		if err == nil && attempt != nil {
			remaining := MaxLoginAttempts - attempt.Attempts
			if remaining > 0 {
				return &domain.AuthResult{Success: false, Message: i18n.GetMessage("INVALID_CREDENTIALS_REMAINING", remaining)}, nil
			}
		}
		return &domain.AuthResult{Success: false, Message: i18n.GetMessage("INVALID_CREDENTIALS")}, nil
	}

	_ = s.clearLoginAttempts(username)

	staff.LastLogin = time.Now().Unix()
	_ = s.staffRepo.Update(staff)

	requireChange := staff.MustChangePin || s.CheckUsingDefaultPassword(password)

	return &domain.AuthResult{
		Success:          true,
		Staff:            *staff,
		Permissions:      staff.Permissions,
		RequirePINChange: requireChange,
	}, nil
}

func (s *staffService) AuthenticateByPIN(pin string) (*domain.AuthResult, error) {
	hashedInput := s.generateFastPIN(pin)
	locked, msg, err := s.checkRateLimit("pin_auth_" + hashedInput)
	if err != nil {
		return nil, err
	}
	if locked {
		return &domain.AuthResult{Success: false, Message: msg}, nil
	}

	fastMatch, err := s.staffRepo.GetByFastPIN(hashedInput)
	if err == nil && fastMatch != nil {
		if err := bcrypt.CompareHashAndPassword([]byte(fastMatch.PasswordHash), []byte(pin)); err == nil {
			_ = s.clearLoginAttempts("pin_auth_" + hashedInput)
			fastMatch.LastLogin = time.Now().Unix()
			_ = s.staffRepo.Update(fastMatch)
			requireChange := fastMatch.MustChangePin || s.CheckUsingDefaultPassword(pin)

			return &domain.AuthResult{
				Success:          true,
				Staff:            *fastMatch,
				Permissions:      fastMatch.Permissions,
				RequirePINChange: requireChange,
			}, nil
		}
	}

	// Fallback: search all active staff
	activeStaff, err := s.staffRepo.GetActive()
	if err != nil {
		return nil, err
	}

	for _, st := range activeStaff {
		if st.PasswordHash != "" {
			if err := bcrypt.CompareHashAndPassword([]byte(st.PasswordHash), []byte(pin)); err == nil {
				// Lazy Migration: save FastPIN
				st.FastPIN = hashedInput
				_ = s.staffRepo.Update(&st)

				_ = s.clearLoginAttempts("pin_auth_" + hashedInput)
				st.LastLogin = time.Now().Unix()
				_ = s.staffRepo.Update(&st)

				requireChange := st.MustChangePin || s.CheckUsingDefaultPassword(pin)

				return &domain.AuthResult{
					Success:          true,
					Staff:            st,
					Permissions:      st.Permissions,
					RequirePINChange: requireChange,
				}, nil
			}
		}
	}

	_ = s.recordFailedAttempt("pin_auth_"+hashedInput, MaxGlobalPinAttempts)
	time.Sleep(2 * time.Second) // Throttling brute force

	attempt, err := s.staffRepo.GetLoginAttempt("pin_auth_" + hashedInput)
	if err == nil && attempt != nil {
		remaining := MaxGlobalPinAttempts - attempt.Attempts
		if remaining > 0 {
			return &domain.AuthResult{Success: false, Message: i18n.GetMessage("INVALID_PIN_REMAINING", remaining)}, nil
		}
	}

	return &domain.AuthResult{Success: false, Message: i18n.GetMessage("INVALID_PIN")}, nil
}

func (s *staffService) HasPermission(staffID, permission string) (bool, error) {
	st, err := s.staffRepo.GetByID(staffID)
	if err != nil {
		return false, err
	}

	if st.Role == domain.RoleAdmin {
		return true, nil
	}

	for _, p := range st.Permissions {
		if p == permission {
			return true, nil
		}
	}
	return false, nil
}

func (s *staffService) SeedDefaultAdmin() error {
	count, err := s.staffRepo.GetStaffCount()
	if err != nil {
		return err
	}

	if count == 0 {
		admin := domain.Staff{
			Name:          "المدير",
			Username:      "admin",
			Role:          domain.RoleAdmin,
			Active:        true,
			MustChangePin: true,
		}
		_, err := s.CreateStaff(admin, "0000")
		if err != nil {
			return err
		}
	}
	return nil
}

// Utilities
var emailRegex = regexp.MustCompile(`^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,4}$`)

func (s *staffService) isValidEmail(email string) bool {
	return emailRegex.MatchString(strings.ToLower(email))
}

func (s *staffService) isValidIraqiPhone(phone string) bool {
	cleaned := ""
	for _, c := range phone {
		if c >= '0' && c <= '9' {
			cleaned += string(c)
		}
	}
	if len(cleaned) != 11 {
		return false
	}
	return cleaned[0] == '0' && cleaned[1] == '7'
}

func (s *staffService) generateFastPIN(pin string) string {
	const indexSalt = "baidar_pos_index_salt_v1_"
	ws := sha256.New()
	ws.Write([]byte(indexSalt + pin))
	return fmt.Sprintf("%x", ws.Sum(nil))
}

func (s *staffService) CheckUsingDefaultPassword(password string) bool {
	return password == "0000" || password == "admin123" || password == "password" || password == "123456" || password == "1234"
}

func (s *staffService) GetStaffCount() (int64, error) {
	return s.staffRepo.GetStaffCount()
}

func (s *staffService) IsUsingDefaultPassword(staffID string) (bool, error) {
	staff, err := s.staffRepo.GetByID(staffID)
	if err != nil {
		return false, err
	}
	if staff.MustChangePin {
		return true, nil
	}
	// Check whether the stored password hash matches any of the well-known
	// default passwords. We compare the hash rather than the username/PIN field
	// because defaults are plaintext constants that must be hashed the same way
	// user-chosen passwords are.
	if staff.PasswordHash != "" {
		defaults := []string{"0000", "admin123", "password", "123456", "1234"}
		for _, d := range defaults {
			if bcrypt.CompareHashAndPassword([]byte(staff.PasswordHash), []byte(d)) == nil {
				return true, nil
			}
		}
	}
	return false, nil
}

