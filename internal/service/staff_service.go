package service

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/auth"
	pkgerrors "beidar-desktop/pkg/errors"
	"beidar-desktop/pkg/i18n"
	"beidar-desktop/pkg/logger"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// Role defaults live in domain.RolePermissions (single source of truth shared
// with the LAN device actor policy in internal/network).

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
	MaxLoginAttempts = 5
	LockoutDuration  = 15 * 60 // 15 minutes
)

// pinAuthMu/pinAuthFailures implement the global PIN-authentication tarpit:
// every failed PIN guess adds an exponential delay (1s, 2s, 4s... capped at
// 15s) before returning, while a correct PIN always resets the counter. This
// throttles brute-force attempts without ever locking out valid PINs. Kept
// separate from the admin-PIN tarpit so the two flows never interfere.
var (
	pinAuthMu       sync.Mutex
	pinAuthFailures int
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
		if errors.Is(err, domain.ErrRecordNotFound) {
			newAttempt := domain.LoginAttempt{
				Identifier:  identifier,
				Attempts:    1,
				LastAttempt: time.Now().Unix(),
			}
			return s.staffRepo.SaveLoginAttempt(&newAttempt)
		}
		// Real DB error — don't silently overwrite.
		logger.Logger.Error("AUTH", fmt.Sprintf("Failed to read login attempts for %s: %v", identifier, err))
		return nil
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

	staff.Username = strings.ToLower(strings.TrimSpace(staff.Username))
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

	existingPIN, _ := s.pinAlreadyUsed(password, "")
	if existingPIN != nil {
		return nil, pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"DUPLICATE_PIN",
			i18n.GetMessage("DUPLICATE_PIN"),
			i18n.GetHint("DUPLICATE_PIN"),
			"password",
		)
	}

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

	if len(staff.Permissions) == 0 {
		staff.Permissions = domain.RolePermissions[staff.Role]
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

	// Privilege check: Only an Admin can promote someone to Admin or modify an Admin's account
	if current.Role == domain.RoleAdmin || staff.Role == domain.RoleAdmin {
		callerRole := auth.CurrentRole()
		if callerRole != "" && callerRole != string(domain.RoleAdmin) {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleStaff,
				"UNAUTHORIZED_ADMIN_MODIFICATION",
				"فقط مسؤول النظام يمكنه تعديل بيانات حساب المسؤول أو الترقية لرتبة مسؤول",
				"",
				"role",
			)
		}
	}

	// Fetch current to maintain hashed password, etc.
	current.Name = staff.Name
	current.Username = strings.ToLower(strings.TrimSpace(staff.Username))
	current.Role = staff.Role
	current.Phone = staff.Phone
	current.Email = staff.Email
	current.Active = staff.Active
	current.MustChangePin = staff.MustChangePin
	current.Permissions = staff.Permissions
	if len(current.Permissions) == 0 {
		current.Permissions = domain.RolePermissions[current.Role]
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
		callerID := auth.CurrentStaffID()
		callerRole := auth.CurrentRole()
		if callerID != "" && callerID != staff.ID && callerRole != string(domain.RoleAdmin) {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleStaff,
				"UNAUTHORIZED_ADMIN_MODIFICATION",
				"غير مصرح لك بتعديل كلمة مرور حساب المسؤول",
				"",
				"id",
			)
		}
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

	existingPIN, _ := s.pinAlreadyUsed(newPassword, id)
	if existingPIN != nil {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleStaff,
			"DUPLICATE_PIN",
			i18n.GetMessage("DUPLICATE_PIN"),
			i18n.GetHint("DUPLICATE_PIN"),
			"password",
		)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	staff.PasswordHash = string(hash)
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
	staff, err := s.staffRepo.GetActive()
	if err != nil {
		return nil, err
	}
	if len(staff) == 0 {
		// Seeding the default admin is the only path from an empty roster to
		// a usable app: a silent failure here would surface as a mysteriously
		// empty staff list, so the error is logged and propagated — same
		// discipline as the roster refresh read below.
		if err := s.SeedDefaultAdmin(); err != nil {
			logger.Logger.Warn("AUTH", fmt.Sprintf("تعذر بذر المدير الافتراضي بعد قائمة موظفين فارغة: %v", err))
			return nil, err
		}
		refreshed, err := s.staffRepo.GetActive()
		if err != nil {
			return nil, err
		}
		staff = refreshed
	}
	if staff == nil {
		staff = []domain.Staff{}
	}
	return staff, nil
}

func (s *staffService) ToggleStaffStatus(id string) error {
	staff, err := s.staffRepo.GetByID(id)
	if err != nil {
		return err
	}

	// Never deactivate the last remaining admin.
	if staff.Active && staff.Role == domain.RoleAdmin {
		adminCount, err := s.staffRepo.CountByRole(domain.RoleAdmin)
		if err == nil && adminCount <= 1 {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleStaff,
				"LAST_ADMIN",
				i18n.GetMessage("LAST_ADMIN"),
				i18n.GetHint("LAST_ADMIN"),
				"active",
			)
		}
	}

	staff.Active = !staff.Active
	return s.staffRepo.Update(staff)
}

func (s *staffService) AuthenticateByUsername(username, password string) (*domain.AuthResult, error) {
	username = strings.ToLower(strings.TrimSpace(username))
	locked, msg, err := s.checkRateLimit(username)
	if err != nil {
		return nil, err
	}
	if locked {
		return &domain.AuthResult{Success: false, Message: msg}, nil
	}

	staff, err := s.staffRepo.GetByUsername(username)
	if err != nil || !staff.Active {
		if err := s.recordFailedAttempt(username, MaxLoginAttempts); err != nil {
			// The client already gets the failure; losing the counter must
			// still be visible instead of silently weakening the tarpit.
			logger.Logger.Warn("AUTH", fmt.Sprintf("تعذر تسجيل محاولة دخول فاشلة للمستخدم %s: %v", username, err))
		}
		logger.Logger.Warn("SECURITY", fmt.Sprintf("Login failed: Username %s not found or inactive", username))
		return &domain.AuthResult{Success: false, Message: i18n.GetMessage("INVALID_CREDENTIALS")}, nil
	}

	if err := bcrypt.CompareHashAndPassword([]byte(staff.PasswordHash), []byte(password)); err != nil {
		if err := s.recordFailedAttempt(username, MaxLoginAttempts); err != nil {
			// The client already gets the failure; losing the counter must
			// still be visible instead of silently weakening the tarpit.
			logger.Logger.Warn("AUTH", fmt.Sprintf("تعذر تسجيل محاولة دخول فاشلة للمستخدم %s: %v", username, err))
		}
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

	if err := s.clearLoginAttempts(username); err != nil {
		logger.Logger.Warn("AUTH", fmt.Sprintf("تعذر تصفير محاولات الدخول للمستخدم %s: %v", username, err))
	}

	staff.LastLogin = time.Now().Unix()
	if err := s.staffRepo.Update(staff); err != nil {
		// Bookkeeping only: the credentials are already verified, so a failed
		// timestamp write must not block the login — but it must not be silent.
		logger.Logger.Warn("AUTH", fmt.Sprintf("تعذر تحديث وقت آخر دخول للموظف %s: %v", staff.Username, err))
	}

	requireChange := staff.MustChangePin || s.CheckUsingDefaultPassword(password)

	return &domain.AuthResult{
		Success:          true,
		Staff:            *staff,
		Permissions:      staff.Permissions,
		RequirePINChange: requireChange,
	}, nil
}

func (s *staffService) AuthenticateByPIN(pin string) (*domain.AuthResult, error) {
	// PINs are verified against the stored bcrypt hashes of all active staff.
	// The legacy FastPIN index (unsalted sha256 of the PIN) is never used for
	// authentication and is no longer written by the service.
	activeStaff, err := s.staffRepo.GetActive()
	if err != nil {
		return nil, err
	}

	for i := range activeStaff {
		st := &activeStaff[i]
		if st.PasswordHash == "" {
			continue
		}
		if bcrypt.CompareHashAndPassword([]byte(st.PasswordHash), []byte(pin)) == nil {
			// Success: reset the global failure counter so a correct PIN is
			// never blocked by previous failures (tarpit, not lockout).
			pinAuthMu.Lock()
			pinAuthFailures = 0
			pinAuthMu.Unlock()

			st.LastLogin = time.Now().Unix()
			if err := s.staffRepo.Update(st); err != nil {
				// Same policy as username login: never block a verified PIN.
				logger.Logger.Warn("AUTH", fmt.Sprintf("تعذر تحديث وقت آخر دخول للموظف %s: %v", st.Username, err))
			}

			requireChange := st.MustChangePin || s.CheckUsingDefaultPassword(pin)

			return &domain.AuthResult{
				Success:          true,
				Staff:            *st,
				Permissions:      st.Permissions,
				RequirePINChange: requireChange,
			}, nil
		}
	}

	// Failure: apply the exponential tarpit before returning. The delay makes
	// brute-force attempts sequential and self-throttling without a lockout.
	pinAuthMu.Lock()
	pinAuthFailures++
	failures := pinAuthFailures
	pinAuthMu.Unlock()

	// Exponential backoff: 1s, 2s, 4s, 8s, 16s... capped at 15s
	if failures > 5 {
		failures = 5
	}
	delay := time.Duration(1<<uint(failures-1)) * time.Second
	if delay > 15*time.Second || delay <= 0 {
		delay = 15 * time.Second
	}
	time.Sleep(delay)

	logger.Logger.Warn("SECURITY", "PIN authentication failed (tarpitted)")
	return &domain.AuthResult{Success: false, Message: i18n.GetMessage("INVALID_PIN")}, nil
}

func (s *staffService) RestoreSession(staffID string) (*domain.AuthResult, error) {
	st, err := s.staffRepo.GetByID(staffID)
	if err != nil || !st.Active {
		return &domain.AuthResult{Success: false, Message: i18n.GetMessage("STAFF_NOT_FOUND")}, nil
	}

	perms := st.Permissions
	if len(perms) == 0 {
		perms = domain.RolePermissions[st.Role]
	}

	return &domain.AuthResult{
		Success:     true,
		Staff:       *st,
		Permissions: perms,
	}, nil
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
		_, err = s.CreateStaff(admin, "0000")
		if err != nil {
			return err
		}
		return nil
	}

	// Auto-heal: if admin was seeded with the old random PIN and never
	// logged in, reset their password to "0000" so the user can access
	// the app. This covers existing installations that hit the bug.
	admin, err := s.staffRepo.GetByUsername("admin")
	if err != nil {
		if errors.Is(err, domain.ErrRecordNotFound) {
			return nil // no admin user found — nothing to heal
		}
		// A real read failure must not masquerade as "no admin": the caller
		// treats a nil error as "the admin is usable again".
		return fmt.Errorf("فشل قراءة المدير الافتراضي أثناء العلاج الذاتي: %w", err)
	}
	if admin.LastLogin == 0 && admin.MustChangePin && admin.Role == domain.RoleAdmin {
		hash, err := bcrypt.GenerateFromPassword([]byte("0000"), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("فشل توليد هاش كلمة المدير الافتراضي: %w", err)
		}
		admin.PasswordHash = string(hash)
		// The caller uses a nil error as "the admin is usable again"; claiming
		// that while the reset was never persisted would be a lie.
		if err := s.staffRepo.Update(admin); err != nil {
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

// pinAlreadyUsed reports whether the given PIN matches another staff member's
// stored bcrypt hash (excluding excludeID). Unlike the legacy FastPIN index,
// this never leaks recoverable PIN material into the database.
func (s *staffService) pinAlreadyUsed(pin, excludeID string) (*domain.Staff, error) {
	all, err := s.staffRepo.GetAll()
	if err != nil {
		return nil, err
	}
	for i := range all {
		st := &all[i]
		if st.PasswordHash == "" || st.ID == excludeID {
			continue
		}
		if bcrypt.CompareHashAndPassword([]byte(st.PasswordHash), []byte(pin)) == nil {
			return st, nil
		}
	}
	return nil, nil
}



func (s *staffService) CheckUsingDefaultPassword(password string) bool {
	return password == "0000" || password == "admin123" || password == "password" || password == "123456" || password == "1234" || password == "1111"
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

