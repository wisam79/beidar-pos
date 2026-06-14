package handlers

import (
	"context"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/integration"
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
	return h.cloudService.InitGoogleAuth()
}

func (h *CloudHandler) CompleteGoogleAuth() error {
	return h.cloudService.CompleteGoogleAuth()
}

func (h *CloudHandler) IsGoogleConnected() bool {
	return h.cloudService.IsGoogleConnected()
}

func (h *CloudHandler) DisconnectGoogle() error {
	return h.cloudService.DisconnectGoogle()
}

func (h *CloudHandler) UploadBackupToDrive(filename string, content string) (string, error) {
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
	return h.cloudService.CloudBackupNow()
}

func (h *CloudHandler) ListCloudBackupsForUser() ([]domain.CloudBackup, error) {
	return h.cloudService.ListCloudBackupsForUser()
}

func (h *CloudHandler) DeleteCloudBackup(backupID string) error {
	return h.cloudService.DeleteCloudBackup(backupID)
}

func (h *CloudHandler) RestoreCloudBackup(backupID string) error {
	return h.cloudService.RestoreCloudBackup(backupID)
}

// Zoho Books Integration
func (h *CloudHandler) SetupZohoIntegration(clientID, clientSecret, authCode string) error {
	return h.cloudService.SetupZohoIntegration(clientID, clientSecret, authCode)
}

func (h *CloudHandler) GetZohoStatus() map[string]interface{} {
	return h.cloudService.GetZohoStatus()
}

func (h *CloudHandler) DisableZohoIntegration() error {
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


