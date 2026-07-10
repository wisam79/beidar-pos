package handlers

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/auth"
	"beidar-desktop/pkg/notification"
	"beidar-desktop/pkg/updater"
	"context"
)

// SettingsHandler handles Settings and System management requests for Wails
type SettingsHandler struct {
	ctx             context.Context
	settingsService domain.SettingsService
}

// NewSettingsHandler creates a new instance of SettingsHandler
func NewSettingsHandler(settingsService domain.SettingsService) *SettingsHandler {
	return &SettingsHandler{
		settingsService: settingsService,
	}
}

// Startup is called when the app starts
func (h *SettingsHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

func (h *SettingsHandler) GetPreferences() (*domain.AppPreferences, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.settingsService.GetPreferences()
}

func (h *SettingsHandler) UpdatePreferences(prefs domain.AppPreferences) error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.settingsService.UpdatePreferences(prefs)
}

func (h *SettingsHandler) VerifyAdminPin(pin string) bool {
	return h.settingsService.VerifyAdminPin(pin)
}

func (h *SettingsHandler) GetDeviceID() (string, error) {
	return h.settingsService.GetDeviceID()
}

func (h *SettingsHandler) GetCurrentVersion() string {
	return updater.GetCurrentVersion()
}

func (h *SettingsHandler) CheckForUpdates() (*updater.UpdateInfo, error) {
	return h.settingsService.CheckForUpdates()
}

func (h *SettingsHandler) GetUpdateStatus() updater.UpdateStatus {
	return h.settingsService.GetUpdateStatus()
}

func (h *SettingsHandler) DownloadUpdate(url string) (string, error) {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return "", err
	}
	status := h.settingsService.GetUpdateStatus()
	expectedChecksum := ""
	if status.Info != nil {
		expectedChecksum = status.Info.Checksum
	}
	return h.settingsService.DownloadUpdate(url, expectedChecksum)
}

func (h *SettingsHandler) InstallUpdate(installerPath string) error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.settingsService.InstallUpdate(installerPath)
}

func (h *SettingsHandler) SkipVersion(version string) error {
	return h.settingsService.SkipVersion(version)
}

func (h *SettingsHandler) EnableAutoStart() error {
	return h.settingsService.EnableAutoStart()
}

func (h *SettingsHandler) DisableAutoStart() error {
	return h.settingsService.DisableAutoStart()
}

func (h *SettingsHandler) IsAutoStartEnabled() bool {
	return h.settingsService.IsAutoStartEnabled()
}

func (h *SettingsHandler) GetCrashReports() ([]string, error) {
	return h.settingsService.GetCrashReports()
}

func (h *SettingsHandler) GetCrashReportContent(filename string) (string, error) {
	return h.settingsService.GetCrashReportContent(filename)
}

func (h *SettingsHandler) ClearCrashReports() error {
	return h.settingsService.ClearCrashReports()
}

func (h *SettingsHandler) ShowNativeNotification(title, message, notifType string) error {
	return notification.ShowNativeNotification(title, message, notification.NotificationType(notifType))
}

func (h *SettingsHandler) FetchGlobalAIKeys() ([]string, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.settingsService.FetchGlobalAIKeys()
}

func (h *SettingsHandler) SaveGlobalAIKeys(keys []string, userToken string) error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.settingsService.SaveGlobalAIKeys(keys, userToken)
}

func (h *SettingsHandler) FetchGlobalGroqKeys() ([]string, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.settingsService.FetchGlobalGroqKeys()
}

func (h *SettingsHandler) SaveGlobalGroqKeys(keys []string, userToken string) error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.settingsService.SaveGlobalGroqKeys(keys, userToken)
}
