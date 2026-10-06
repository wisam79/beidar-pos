package handlers

import (
	"context"
	"errors"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/integration"
	"beidar-desktop/internal/network"
	"beidar-desktop/pkg/auth"
)

// errBoom is a sentinel error used to prove handler error propagation.
var errBoom = errors.New("boom")

// ---------- session helpers ----------

// seedAdminSession activates a process-wide admin session. Admins pass every
// permission check, so guarded handler methods run their delegation path.
func seedAdminSession(t *testing.T) {
	t.Helper()
	auth.Set(&domain.Staff{ID: "staff-admin", Name: "مدير", Role: domain.RoleAdmin}, nil)
	t.Cleanup(auth.Clear)
}

// seedCashierSession activates a cashier session with an explicit permission
// list, so negative permission checks can be asserted.
func seedCashierSession(t *testing.T, perms ...string) {
	t.Helper()
	auth.Set(&domain.Staff{ID: "staff-cashier", Name: "كاشير", Role: domain.RoleCashier}, perms)
	t.Cleanup(auth.Clear)
}

// seedNoSession guarantees no active session for the duration of the test.
func seedNoSession(t *testing.T) {
	t.Helper()
	auth.Clear()
	t.Cleanup(auth.Clear)
}

// ---------- LAN service fake ----------

// fakeLanService is a controllable network.LanService double. It records the
// remote endpoints each handler asks for and lets tests force client mode and
// remote failures.
type fakeLanService struct {
	clientMode      bool
	serverRunning   bool
	serverSecret    string
	remoteGetErr    error
	remotePostErr   error
	remoteDeleteErr error

	getCalls     []string
	postCalls    []string
	deleteCalls  []string
	connectCalls int

	// onGet lets a test populate the decoded result of a remote GET, mirroring
	// what the real REST server would return.
	onGet func(endpoint string, out interface{})
}

func newFakeLan() *fakeLanService { return &fakeLanService{serverSecret: "srv-secret"} }

func (f *fakeLanService) Startup(ctx context.Context) {}

func (f *fakeLanService) StartServer(port int) error { f.serverRunning = true; return nil }

func (f *fakeLanService) StopServer() error { f.serverRunning = false; return nil }

func (f *fakeLanService) GetServerStatus() domain.LanServerStatus {
	return domain.LanServerStatus{Running: f.serverRunning, Port: network.DefaultLanPort}
}

func (f *fakeLanService) IsServerRunning() bool { return f.serverRunning }

func (f *fakeLanService) ConnectToServer(serverIP string, port int, secret string) error {
	f.connectCalls++
	f.clientMode = true
	return nil
}

func (f *fakeLanService) DisconnectFromServer() { f.clientMode = false }

func (f *fakeLanService) GetClientStatus() domain.LanClientStatus {
	return domain.LanClientStatus{Connected: f.clientMode, Mode: "client"}
}

func (f *fakeLanService) IsClientMode() bool { return f.clientMode }

func (f *fakeLanService) DiscoverServers() ([]domain.DiscoveredServer, error) {
	return []domain.DiscoveredServer{{ServerName: "srv", ServerIP: "127.0.0.1", Port: network.DefaultLanPort}}, nil
}

func (f *fakeLanService) TestConnection() string { return "ok" }

func (f *fakeLanService) GetConnectedClients() []domain.ConnectedClient {
	return []domain.ConnectedClient{{DeviceID: "dev-1"}}
}

func (f *fakeLanService) DisconnectClient(deviceID string) error { return nil }

func (f *fakeLanService) SuspendClient(deviceID string) error { return nil }

func (f *fakeLanService) ResumeClient(deviceID string) error { return nil }

func (f *fakeLanService) BlockDevice(deviceID, deviceName, reason string) error { return nil }

func (f *fakeLanService) UnblockDevice(id uint) error { return nil }

func (f *fakeLanService) GetBlockedDevices() ([]domain.BlockedDevice, error) {
	return []domain.BlockedDevice{{ID: 1, DeviceID: "dev-1"}}, nil
}

func (f *fakeLanService) GenerateServerSecret() (string, error) {
	f.serverSecret = "generated-secret"
	return f.serverSecret, nil
}

func (f *fakeLanService) GetServerSecret() string { return f.serverSecret }

func (f *fakeLanService) ValidateServerSecret(secret string) bool { return secret == f.serverSecret }

func (f *fakeLanService) RemoteGet(endpoint string, result interface{}) error {
	f.getCalls = append(f.getCalls, endpoint)
	if f.remoteGetErr != nil {
		return f.remoteGetErr
	}
	if f.onGet != nil {
		f.onGet(endpoint, result)
	}
	return nil
}

func (f *fakeLanService) RemotePost(endpoint string, data interface{}, result interface{}) error {
	f.postCalls = append(f.postCalls, endpoint)
	return f.remotePostErr
}

func (f *fakeLanService) RemoteDelete(endpoint string) error {
	f.deleteCalls = append(f.deleteCalls, endpoint)
	return f.remoteDeleteErr
}

// compile-time proof the double satisfies the production interface.
var _ network.LanService = (*fakeLanService)(nil)

// ---------- Cloud service fake (integration.CloudService) ----------

// fakeCloudService embeds the production interface so only the methods a test
// exercises need an implementation. Unused calls panic loudly instead of
// silently returning zero values.
type fakeCloudService struct {
	integration.CloudService

	zohoStatus    map[string]interface{}
	licenseResult *domain.LicenseResult
	licenseErr    error
	storedKey     string
	currentUser   *domain.UserSession
	loggedIn      bool
	googleConn    bool
	keepAliveCall int
	logoutCalls   int

	authURL          string
	driveURL         string
	authResult       *domain.SupabaseAuthResult
	validity         *domain.SessionValidityResult
	cloudBackups     []domain.CloudBackup
	cloudBackupCalls int
	err              error
}

func newFakeCloud() *fakeCloudService {
	return &fakeCloudService{}
}

func (f *fakeCloudService) InitGoogleSecrets(clientID, clientSecret string) {}

func (f *fakeCloudService) KeepAliveSupabase() { f.keepAliveCall++ }

func (f *fakeCloudService) Logout() { f.logoutCalls++ }

func (f *fakeCloudService) IsLoggedIn() bool { return f.loggedIn }

func (f *fakeCloudService) GetCurrentUser() *domain.UserSession { return f.currentUser }

func (f *fakeCloudService) IsGoogleConnected() bool { return f.googleConn }

func (f *fakeCloudService) GetZohoStatus() map[string]interface{} { return f.zohoStatus }

func (f *fakeCloudService) VerifyLicense(key string) (*domain.LicenseResult, error) {
	return f.licenseResult, f.licenseErr
}

func (f *fakeCloudService) ActivateLicense(key string) (*domain.LicenseResult, error) {
	return f.licenseResult, f.licenseErr
}

func (f *fakeCloudService) GetCachedLicense() (*domain.LicenseResult, error) {
	return f.licenseResult, f.licenseErr
}

func (f *fakeCloudService) GetStoredLicenseKey() string { return f.storedKey }

func (f *fakeCloudService) GetUserLicenseStatus() (*domain.LicenseResult, error) {
	return f.licenseResult, f.licenseErr
}

func (f *fakeCloudService) InitGoogleAuth() (string, error) { return f.authURL, f.err }

func (f *fakeCloudService) CompleteGoogleAuth() error { return f.err }

func (f *fakeCloudService) DisconnectGoogle() error { return f.err }

func (f *fakeCloudService) UploadBackupToDrive(filename string, content string) (string, error) {
	return f.driveURL, f.err
}

func (f *fakeCloudService) GoogleDriveBackupNow() error { return f.err }

func (f *fakeCloudService) Register(email, password, storeName string) (*domain.SupabaseAuthResult, error) {
	return f.authResult, f.err
}

func (f *fakeCloudService) Login(email, password string) (*domain.SupabaseAuthResult, error) {
	return f.authResult, f.err
}

func (f *fakeCloudService) RecoverPassword(email string) (*domain.SupabaseAuthResult, error) {
	return f.authResult, f.err
}

func (f *fakeCloudService) DeleteCurrentUser() error { return f.err }

func (f *fakeCloudService) CheckSessionValidity() *domain.SessionValidityResult {
	return f.validity
}

func (f *fakeCloudService) CloudBackupNow() error { f.cloudBackupCalls++; return f.err }

func (f *fakeCloudService) ListCloudBackupsForUser() ([]domain.CloudBackup, error) {
	return f.cloudBackups, f.err
}

func (f *fakeCloudService) DeleteCloudBackup(backupID string) error { return f.err }

func (f *fakeCloudService) RestoreCloudBackup(backupID string) error { return f.err }

func (f *fakeCloudService) SetupZohoIntegration(clientID, clientSecret, authCode string) error {
	return f.err
}

func (f *fakeCloudService) DisableZohoIntegration() error { return f.err }
