package handlers

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/service"
	"context"
)

type StaffHandler struct {
	ctx          context.Context
	staffService service.StaffService
}

func NewStaffHandler(staffService service.StaffService) *StaffHandler {
	return &StaffHandler{
		staffService: staffService,
	}
}

func (h *StaffHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

func (h *StaffHandler) CreateStaff(s domain.Staff, password string) (*domain.Staff, error) {
	return h.staffService.CreateStaff(s, password)
}

func (h *StaffHandler) UpdateStaff(s domain.Staff) error {
	return h.staffService.UpdateStaff(s)
}

func (h *StaffHandler) UpdateStaffPassword(id string, newPassword string) error {
	return h.staffService.UpdateStaffPassword(id, newPassword)
}

func (h *StaffHandler) DeleteStaff(id string, force bool) error {
	return h.staffService.DeleteStaff(id, force)
}

func (h *StaffHandler) GetStaff(id string) (*domain.Staff, error) {
	return h.staffService.GetStaff(id)
}

func (h *StaffHandler) GetAllStaff() ([]domain.Staff, error) {
	return h.staffService.GetAllStaff()
}

func (h *StaffHandler) GetActiveStaff() ([]domain.Staff, error) {
	return h.staffService.GetActiveStaff()
}

func (h *StaffHandler) ToggleStaffStatus(id string) error {
	return h.staffService.ToggleStaffStatus(id)
}

func (h *StaffHandler) AuthenticateByUsername(username, password string) (*domain.AuthResult, error) {
	return h.staffService.AuthenticateByUsername(username, password)
}

func (h *StaffHandler) AuthenticateByPIN(pin string) (*domain.AuthResult, error) {
	return h.staffService.AuthenticateByPIN(pin)
}

func (h *StaffHandler) HasPermission(staffID, permission string) (bool, error) {
	return h.staffService.HasPermission(staffID, permission)
}

func (h *StaffHandler) UpdateStaffPIN(id string, pin string) error {
	return h.staffService.UpdateStaffPassword(id, pin)
}

func (h *StaffHandler) GetStaffCount() (int64, error) {
	return h.staffService.GetStaffCount()
}

func (h *StaffHandler) IsUsingDefaultPassword(staffID string) (bool, error) {
	return h.staffService.IsUsingDefaultPassword(staffID)
}

