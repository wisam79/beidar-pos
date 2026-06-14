package integration

import (
	"beidar-desktop/internal/core/domain"
)

type CloudService interface {
	// Google Drive Auth & Backup
	InitGoogleAuth() (string, error)
	CompleteGoogleAuth() error
	IsGoogleConnected() bool
	DisconnectGoogle() error
	UploadBackupToDrive(filename string, content string) (string, error)

	// Supabase Auth
	Register(email, password, storeName string) (*domain.SupabaseAuthResult, error)
	Login(email, password string) (*domain.SupabaseAuthResult, error)
	Logout()
	RecoverPassword(email string) (*domain.SupabaseAuthResult, error)
	DeleteCurrentUser() error
	IsLoggedIn() bool
	GetCurrentUser() *domain.UserSession
	CheckSessionValidity() *domain.SessionValidityResult
	SyncSessionFeatures()

	// Supabase Cloud Backup
	CloudBackupNow() error
	ListCloudBackupsForUser() ([]domain.CloudBackup, error)
	DeleteCloudBackup(backupID string) error
	RestoreCloudBackup(backupID string) error

	// Zoho Books Integration
	SetupZohoIntegration(clientID, clientSecret, authCode string) error
	GetZohoStatus() map[string]interface{}
	DisableZohoIntegration() error
	StartZohoSyncWorker()

	// License Verification & Management
	VerifyLicense(key string) (*domain.LicenseResult, error)
	ActivateLicense(key string) (*domain.LicenseResult, error)
	GetCachedLicense() (*domain.LicenseResult, error)
	GetStoredLicenseKey() string
	GetUserLicenseStatus() (*domain.LicenseResult, error)
}

type cloudService struct {
	preferencesRepo domain.PreferencesRepository
	saleRepo        domain.SaleRepository
	staffRepo       domain.StaffRepository
}

func NewCloudService(
	preferencesRepo domain.PreferencesRepository,
	saleRepo domain.SaleRepository,
	staffRepo domain.StaffRepository,
) CloudService {
	s := &cloudService{
		preferencesRepo: preferencesRepo,
		saleRepo:        saleRepo,
		staffRepo:       staffRepo,
	}
	s.InitSecrets()
	s.StartZohoSyncWorker()
	return s
}
