package handlers

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/auth"
	"context"
)

type StaffHandler struct {
	ctx          context.Context
	staffService domain.StaffService
}

func NewStaffHandler(staffService domain.StaffService) *StaffHandler {
	return &StaffHandler{
		staffService: staffService,
	}
}

func (h *StaffHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

func (h *StaffHandler) CreateStaff(s domain.Staff, password string) (*domain.Staff, error) {
	if err := auth.RequirePermission(auth.PermStaffManage); err != nil {
		return nil, err
	}
	return h.staffService.CreateStaff(s, password)
}

func (h *StaffHandler) UpdateStaff(s domain.Staff) error {
	if err := auth.RequirePermission(auth.PermStaffManage); err != nil {
		return err
	}
	return h.staffService.UpdateStaff(s)
}

func (h *StaffHandler) UpdateStaffPassword(id string, newPassword string) error {
	if err := auth.RequirePermission(auth.PermStaffManage); err != nil {
		return err
	}
	return h.staffService.UpdateStaffPassword(id, newPassword)
}

func (h *StaffHandler) DeleteStaff(id string, force bool) error {
	if err := auth.RequirePermission(auth.PermStaffManage); err != nil {
		return err
	}
	return h.staffService.DeleteStaff(id, force)
}

func (h *StaffHandler) GetStaff(id string) (*domain.Staff, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.staffService.GetStaff(id)
}

func (h *StaffHandler) GetAllStaff() ([]domain.Staff, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.staffService.GetAllStaff()
}

// GetActiveStaff is intentionally open: it is called by the login screen before
// any session exists, to list users for the PIN pad.
func (h *StaffHandler) GetActiveStaff() ([]domain.Staff, error) {
	return h.staffService.GetActiveStaff()
}

func (h *StaffHandler) ToggleStaffStatus(id string) error {
	if err := auth.RequirePermission(auth.PermStaffManage); err != nil {
		return err
	}
	return h.staffService.ToggleStaffStatus(id)
}

// AuthenticateByUsername validates credentials and — on success — activates the
// backend session. Open: this is the login entry point.
func (h *StaffHandler) AuthenticateByUsername(username, password string) (*domain.AuthResult, error) {
	result, err := h.staffService.AuthenticateByUsername(username, password)
	if err != nil {
		return nil, err
	}
	if result.Success && result.Staff.ID != "" {
		// Activate the backend session so subsequent handler calls are authorized.
		staff := result.Staff
		auth.Set(&staff, result.Permissions)
	}
	return result, nil
}

// AuthenticateByPIN validates a PIN and — on success — activates the backend
// session. Open: this is the login entry point.
func (h *StaffHandler) AuthenticateByPIN(pin string) (*domain.AuthResult, error) {
	result, err := h.staffService.AuthenticateByPIN(pin)
	if err != nil {
		return nil, err
	}
	if result.Success && result.Staff.ID != "" {
		staff := result.Staff
		auth.Set(&staff, result.Permissions)
	}
	return result, nil
}

// Logout clears the backend session. Open: must be callable even if the session
// already expired (idempotent).
func (h *StaffHandler) Logout() {
	auth.Clear()
}

func (h *StaffHandler) HasPermission(staffID, permission string) (bool, error) {
	if err := auth.Require(); err != nil {
		return false, err
	}
	return h.staffService.HasPermission(staffID, permission)
}

func (h *StaffHandler) UpdateStaffPIN(id string, pin string) error {
	if err := auth.RequirePermission(auth.PermStaffManage); err != nil {
		return err
	}
	return h.staffService.UpdateStaffPassword(id, pin)
}

func (h *StaffHandler) GetStaffCount() (int64, error) {
	if err := auth.Require(); err != nil {
		return 0, err
	}
	return h.staffService.GetStaffCount()
}

func (h *StaffHandler) IsUsingDefaultPassword(staffID string) (bool, error) {
	if err := auth.Require(); err != nil {
		return false, err
	}
	return h.staffService.IsUsingDefaultPassword(staffID)
}

