package service

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/autostart"
	"beidar-desktop/pkg/crashreporter"
	"beidar-desktop/pkg/secureconfig"
	"beidar-desktop/pkg/updater"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

type settingsService struct {
	preferencesRepo domain.PreferencesRepository
}

// NewSettingsService creates a new instance of domain.SettingsService
func NewSettingsService(preferencesRepo domain.PreferencesRepository) domain.SettingsService {
	return &settingsService{
		preferencesRepo: preferencesRepo,
	}
}

func (s *settingsService) GetPreferences() (*domain.AppPreferences, error) {
	return s.preferencesRepo.Get()
}

func (s *settingsService) UpdatePreferences(prefs domain.AppPreferences) error {
	return s.preferencesRepo.Save(&prefs)
}

func (s *settingsService) VerifyAdminPin(pin string) bool {
	prefs, err := s.preferencesRepo.Get()
	if err != nil {
		return false
	}
	return prefs.AdminPin == pin
}

func (s *settingsService) GetDeviceID() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	appDir := filepath.Join(configDir, "BeidarPOS_V3")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return "", err
	}

	deviceIDFile := filepath.Join(appDir, "device_id")

	// Try to read existing ID
	if _, err := os.Stat(deviceIDFile); err == nil {
		content, err := os.ReadFile(deviceIDFile)
		if err == nil && len(content) > 0 {
			return string(content), nil
		}
	}

	// Generate new ID (UUID)
	newID := "dev_" + uuid.New().String()

	// Write to file
	if err := os.WriteFile(deviceIDFile, []byte(newID), 0644); err != nil {
		return "", fmt.Errorf("failed to save device ID: %v", err)
	}

	return newID, nil
}

func (s *settingsService) IsAutoStartEnabled() bool {
	return autostart.IsAutoStartEnabled()
}

func (s *settingsService) EnableAutoStart() error {
	return autostart.EnableAutoStart()
}

func (s *settingsService) DisableAutoStart() error {
	return autostart.DisableAutoStart()
}

func (s *settingsService) GetCrashReports() ([]string, error) {
	return crashreporter.GetCrashReports()
}

func (s *settingsService) GetCrashReportContent(filename string) (string, error) {
	return crashreporter.GetCrashReportContent(filename)
}

func (s *settingsService) ClearCrashReports() error {
	return crashreporter.ClearCrashReports()
}

func (s *settingsService) CheckForUpdates() (*updater.UpdateInfo, error) {
	return updater.CheckForUpdates()
}

func (s *settingsService) GetUpdateStatus() updater.UpdateStatus {
	return updater.GetUpdateStatus()
}

func (s *settingsService) DownloadUpdate(url, expectedChecksum string) (string, error) {
	return updater.DownloadUpdate(url, expectedChecksum)
}

func (s *settingsService) InstallUpdate(installerPath string) error {
	return updater.InstallUpdate(installerPath)
}

func (s *settingsService) SkipVersion(version string) error {
	return updater.SkipVersion(version)
}

// Global settings structures
type globalSettings struct {
	ID        string          `json:"id"`
	Key       string          `json:"key"`
	Value     json.RawMessage `json:"value"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type aiKeysConfig struct {
	GeminiKeys []string `json:"gemini_keys"`
}

func getSupabaseURL() string {
	if url, err := secureconfig.GetSupabaseURL(); err == nil {
		return url
	}
	return ""
}

func getSupabaseKey() string {
	if key, err := secureconfig.GetSupabaseKey(); err == nil {
		return key
	}
	return ""
}

func (s *settingsService) FetchGlobalAIKeys() ([]string, error) {
	sbURL := getSupabaseURL()
	sbKey := getSupabaseKey()

	if sbURL == "" || sbKey == "" {
		return nil, fmt.Errorf("supabase not configured")
	}

	url := fmt.Sprintf("%s/rest/v1/global_settings?key=eq.ai_keys&select=value", sbURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("apikey", sbKey)
	req.Header.Set("Authorization", "Bearer "+sbKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch settings: %d", resp.StatusCode)
	}

	var results []globalSettings
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, err
	}

	if len(results) == 0 {
		return []string{}, nil
	}

	var config aiKeysConfig
	if err := json.Unmarshal(results[0].Value, &config); err != nil {
		return nil, err
	}

	return config.GeminiKeys, nil
}

func (s *settingsService) SaveGlobalAIKeys(keys []string, userToken string) error {
	sbURL := getSupabaseURL()
	sbKey := getSupabaseKey()

	if sbURL == "" || sbKey == "" {
		return fmt.Errorf("supabase not configured")
	}

	if userToken == "" {
		return fmt.Errorf("يجب تسجيل الدخول أولاً")
	}

	url := fmt.Sprintf("%s/rest/v1/global_settings?key=eq.ai_keys", sbURL)

	config := aiKeysConfig{GeminiKeys: keys}
	configJson, _ := json.Marshal(config)

	payload := map[string]interface{}{
		"value":      json.RawMessage(configJson),
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}

	jsonBody, _ := json.Marshal(payload)
	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", sbKey)
	req.Header.Set("Authorization", "Bearer "+userToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("failed to update settings: %d", resp.StatusCode)
	}

	return nil
}
