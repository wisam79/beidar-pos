package handlers

import (
	"context"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/integration"
	"beidar-desktop/pkg/auth"
)

type CloudHandler struct {
	ctx          context.Context
	cloudService integration.CloudService
}

func NewCloudHandler(cloudService integration.CloudService) *CloudHandler {
	return &CloudHandler{
		cloudService: cloudService,
	}
}

func (h *CloudHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

// Google Drive Auth & Backup
func (h *CloudHandler) InitGoogleAuth() (string, error) {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return "", err
	}
	return h.cloudService.InitGoogleAuth()
}

func (h *CloudHandler) CompleteGoogleAuth() error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.cloudService.CompleteGoogleAuth()
}

func (h *CloudHandler) IsGoogleConnected() bool {
	return h.cloudService.IsGoogleConnected()
}

func (h *CloudHandler) DisconnectGoogle() error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.cloudService.DisconnectGoogle()
}

func (h *CloudHandler) UploadBackupToDrive(filename string, content string) (string, error) {
	if err := auth.RequirePermission(auth.PermExportData); err != nil {
		return "", err
	}
	return h.cloudService.UploadBackupToDrive(filename, content)
}

// Supabase Auth
func (h *CloudHandler) Register(email, password, storeName string) (*domain.SupabaseAuthResult, error) {
	return h.cloudService.Register(email, password, storeName)
}

func (h *CloudHandler) Login(email, password string) (*domain.SupabaseAuthResult, error) {
	return h.cloudService.Login(email, password)
}

func (h *CloudHandler) Logout() {
	h.cloudService.Logout()
}

func (h *CloudHandler) RecoverPassword(email string) (*domain.SupabaseAuthResult, error) {
	return h.cloudService.RecoverPassword(email)
}

func (h *CloudHandler) DeleteCurrentUser() error {
	return h.cloudService.DeleteCurrentUser()
}

func (h *CloudHandler) IsLoggedIn() bool {
	return h.cloudService.IsLoggedIn()
}

func (h *CloudHandler) GetCurrentUser() *domain.UserSession {
	return h.cloudService.GetCurrentUser()
}

func (h *CloudHandler) CheckSessionValidity() *domain.SessionValidityResult {
	return h.cloudService.CheckSessionValidity()
}

// Supabase Cloud Backup
func (h *CloudHandler) CloudBackupNow() error {
	if err := auth.RequirePermission(auth.PermExportData); err != nil {
		return err
	}
	return h.cloudService.CloudBackupNow()
}

func (h *CloudHandler) ListCloudBackupsForUser() ([]domain.CloudBackup, error) {
	if err := auth.RequirePermission(auth.PermExportData); err != nil {
		return nil, err
	}
	return h.cloudService.ListCloudBackupsForUser()
}

func (h *CloudHandler) DeleteCloudBackup(backupID string) error {
	if err := auth.RequirePermission(auth.PermExportData); err != nil {
		return err
	}
	return h.cloudService.DeleteCloudBackup(backupID)
}

func (h *CloudHandler) RestoreCloudBackup(backupID string) error {
	if err := auth.RequireAdmin(); err != nil {
		return err
	}
	return h.cloudService.RestoreCloudBackup(backupID)
}

// Zoho Books Integration
func (h *CloudHandler) SetupZohoIntegration(clientID, clientSecret, authCode string) error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.cloudService.SetupZohoIntegration(clientID, clientSecret, authCode)
}

func (h *CloudHandler) GetZohoStatus() map[string]interface{} {
	return h.cloudService.GetZohoStatus()
}

func (h *CloudHandler) DisableZohoIntegration() error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.cloudService.DisableZohoIntegration()
}

// License Verification & Management
func (h *CloudHandler) VerifyLicense(key string) (*domain.LicenseResult, error) {
	return h.cloudService.VerifyLicense(key)
}

func (h *CloudHandler) ActivateLicense(key string) (*domain.LicenseResult, error) {
	return h.cloudService.ActivateLicense(key)
}

func (h *CloudHandler) GetCachedLicense() (*domain.LicenseResult, error) {
	return h.cloudService.GetCachedLicense()
}

func (h *CloudHandler) GetStoredLicenseKey() string {
	return h.cloudService.GetStoredLicenseKey()
}

func (h *CloudHandler) GetUserLicenseStatus() (*domain.LicenseResult, error) {
	return h.cloudService.GetUserLicenseStatus()
}


