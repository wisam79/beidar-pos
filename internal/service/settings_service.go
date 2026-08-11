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
	"golang.org/x/crypto/bcrypt"
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
	prefs, err := s.preferencesRepo.Get()
	if err != nil {
		return nil, err
	}

	// Mask sensitive fields before returning
	if prefs.AdminPin != "" {
		prefs.AdminPin = "********"
	}
	if prefs.GeminiAPIKey != "" {
		prefs.GeminiAPIKey = "********"
	}
	if len(prefs.GeminiAPIKeys) > 0 {
		prefs.GeminiAPIKeys = []string{"********"}
	}
	if prefs.GroqAPIKey != "" {
		prefs.GroqAPIKey = "********"
	}

	return prefs, nil
}

func (s *settingsService) UpdatePreferences(prefs domain.AppPreferences) error {
	currentPrefs, err := s.preferencesRepo.Get()
	if err != nil {
		return s.preferencesRepo.Save(&prefs)
	}

	// Hash AdminPin if it changed
	if prefs.AdminPin != "" && prefs.AdminPin != "********" && prefs.AdminPin != currentPrefs.AdminPin {
		hashedPin, err := bcrypt.GenerateFromPassword([]byte(prefs.AdminPin), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("failed to hash admin pin: %w", err)
		}
		prefs.AdminPin = string(hashedPin)
	} else if prefs.AdminPin == "" || prefs.AdminPin == "********" {
		prefs.AdminPin = currentPrefs.AdminPin
	}

	// Persist Gemini API key to secureconfig (encrypted), store placeholder in DB
	if prefs.GeminiAPIKey != "" && prefs.GeminiAPIKey != "********" {
		if err := secureconfig.SetGeminiAPIKey(prefs.GeminiAPIKey); err != nil {
			return fmt.Errorf("failed to encrypt Gemini API key: %w", err)
		}
	}
	prefs.GeminiAPIKey = "********"

	// Handle GeminiAPIKeys slice the same way
	if len(prefs.GeminiAPIKeys) > 0 && prefs.GeminiAPIKeys[0] != "********" {
		var keysToSave []string
		for _, k := range prefs.GeminiAPIKeys {
			if k != "" {
				keysToSave = append(keysToSave, k)
			}
		}
		if len(keysToSave) > 0 {
			_ = secureconfig.SetGeminiAPIKeys(keysToSave)
			_ = secureconfig.SetGeminiAPIKey(keysToSave[0]) // Backwards compatibility for singular key
		}
	}
	prefs.GeminiAPIKeys = []string{"********"}

	// Persist Groq API key to secureconfig (encrypted), store placeholder in DB
	if prefs.GroqAPIKey != "" && prefs.GroqAPIKey != "********" {
		if err := secureconfig.SetGroqAPIKey(prefs.GroqAPIKey); err != nil {
			return fmt.Errorf("failed to encrypt Groq API key: %w", err)
		}
	}
	prefs.GroqAPIKey = "********"

	return s.preferencesRepo.Save(&prefs)
}

func (s *settingsService) VerifyAdminPin(pin string) bool {
	prefs, err := s.preferencesRepo.Get()
	if err != nil {
		return false
	}
	if prefs.AdminPin == "" {
		return false
	}
	return VerifyAdminPin(prefs.AdminPin, pin)
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
		return "", fmt.Errorf("failed to save device ID: %w", err)
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

func (s *settingsService) CheckForUpdates() (*domain.UpdateInfo, error) {
	info, err := updater.CheckForUpdates()
	if err != nil {
		return nil, err
	}
	if info == nil {
		return nil, nil
	}
	return &domain.UpdateInfo{
		Version:         info.Version,
		DownloadURL:     info.DownloadURL,
		ReleaseNotes:    info.ReleaseNotes,
		Mandatory:       info.Mandatory,
		Size:            info.Size,
		SizeFormatted:   info.SizeFormatted,
		Checksum:        info.Checksum,
		ReleaseDate:     info.ReleaseDate,
		UpdateAvailable: info.UpdateAvailable,
		IsPrerelease:    info.IsPrerelease,
	}, nil
}

func (s *settingsService) GetUpdateStatus() domain.UpdateStatus {
	status := updater.GetUpdateStatus()
	var info *domain.UpdateInfo
	if status.Info != nil {
		info = &domain.UpdateInfo{
			Version:         status.Info.Version,
			DownloadURL:     status.Info.DownloadURL,
			ReleaseNotes:    status.Info.ReleaseNotes,
			Mandatory:       status.Info.Mandatory,
			Size:            status.Info.Size,
			SizeFormatted:   status.Info.SizeFormatted,
			Checksum:        status.Info.Checksum,
			ReleaseDate:     status.Info.ReleaseDate,
			UpdateAvailable: status.Info.UpdateAvailable,
			IsPrerelease:    status.Info.IsPrerelease,
		}
	}
	return domain.UpdateStatus{
		Checking:        status.Checking,
		Downloading:     status.Downloading,
		Installing:      status.Installing,
		Progress:        status.Progress,
		Speed:           status.Speed,
		ETA:             status.ETA,
		Error:           status.Error,
		Stage:           status.Stage,
		UpdateAvailable: status.UpdateAvailable,
		Info:            info,
	}
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
	GroqKeys   []string `json:"groq_keys"`
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

// fetchGlobalAIConfig performs the Supabase GET for the ai_keys row.
// It returns config when the value is an object, plainKeys when the value is a
// plain JSON array (legacy format), and an error otherwise.
func fetchGlobalAIConfig() (config *aiKeysConfig, plainKeys []string, err error) {
	sbURL := getSupabaseURL()
	sbKey := getSupabaseKey()

	if sbURL == "" || sbKey == "" {
		return nil, nil, fmt.Errorf("supabase not configured")
	}

	url := fmt.Sprintf("%s/rest/v1/global_settings?key=eq.ai_keys&select=value", sbURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	req.Header.Set("apikey", sbKey)
	req.Header.Set("Authorization", "Bearer "+sbKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("failed to fetch settings: %d", resp.StatusCode)
	}

	var results []globalSettings
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, nil, err
	}

	if len(results) == 0 {
		return &aiKeysConfig{GeminiKeys: []string{}, GroqKeys: []string{}}, nil, nil
	}

	var cfg aiKeysConfig
	if err := json.Unmarshal(results[0].Value, &cfg); err != nil {
		var keys []string
		if errArray := json.Unmarshal(results[0].Value, &keys); errArray == nil {
			return nil, keys, nil
		}
		return nil, nil, err
	}
	return &cfg, nil, nil
}

func (s *settingsService) FetchGlobalAIKeys() ([]string, error) {
	config, plainKeys, err := fetchGlobalAIConfig()
	if err != nil {
		return nil, err
	}
	if config == nil {
		return plainKeys, nil
	}
	return config.GeminiKeys, nil
}

func (s *settingsService) FetchGlobalGroqKeys() ([]string, error) {
	config, _, err := fetchGlobalAIConfig()
	if err != nil {
		return nil, err
	}
	if config == nil {
		return nil, nil
	}
	return config.GroqKeys, nil
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

	// 1. Fetch current config first to preserve Groq keys
	var currentConfig aiKeysConfig
	urlGet := fmt.Sprintf("%s/rest/v1/global_settings?key=eq.ai_keys&select=value", sbURL)
	reqGet, err := http.NewRequest("GET", urlGet, nil)
	if err != nil {
		return fmt.Errorf("failed to create request for current config: %w", err)
	}

	reqGet.Header.Set("apikey", sbKey)
	reqGet.Header.Set("Authorization", "Bearer "+sbKey)
	client := &http.Client{Timeout: 10 * time.Second}
	
	respGet, errGet := client.Do(reqGet)
	if errGet != nil {
		return fmt.Errorf("failed to fetch current config: %w", errGet)
	}
	defer respGet.Body.Close()

	if respGet.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch current config: status %d", respGet.StatusCode)
	}

	var results []globalSettings
	if errDec := json.NewDecoder(respGet.Body).Decode(&results); errDec != nil {
		return fmt.Errorf("failed to decode current config: %w", errDec)
	}
	if len(results) > 0 {
		if errUnm := json.Unmarshal(results[0].Value, &currentConfig); errUnm != nil {
			return fmt.Errorf("failed to unmarshal current config: %w", errUnm)
		}
	}

	// 2. Update Gemini keys
	currentConfig.GeminiKeys = keys

	url := fmt.Sprintf("%s/rest/v1/global_settings?key=eq.ai_keys", sbURL)
	configJson, err := json.Marshal(currentConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal AI keys config: %w", err)
	}

	payload := map[string]interface{}{
		"value":      json.RawMessage(configJson),
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}

	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal request payload: %w", err)
	}
	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", sbKey)
	req.Header.Set("Authorization", "Bearer "+userToken)

	client = &http.Client{Timeout: 10 * time.Second}
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

func (s *settingsService) SaveGlobalGroqKeys(keys []string, userToken string) error {
	sbURL := getSupabaseURL()
	sbKey := getSupabaseKey()

	if sbURL == "" || sbKey == "" {
		return fmt.Errorf("supabase not configured")
	}

	if userToken == "" {
		return fmt.Errorf("يجب تسجيل الدخول أولاً")
	}

	// 1. Fetch current config first to preserve Gemini keys
	var currentConfig aiKeysConfig
	urlGet := fmt.Sprintf("%s/rest/v1/global_settings?key=eq.ai_keys&select=value", sbURL)
	reqGet, err := http.NewRequest("GET", urlGet, nil)
	if err == nil {
		reqGet.Header.Set("apikey", sbKey)
		reqGet.Header.Set("Authorization", "Bearer "+sbKey)
		client := &http.Client{Timeout: 10 * time.Second}
		if respGet, errGet := client.Do(reqGet); errGet == nil && respGet.StatusCode == http.StatusOK {
			var results []globalSettings
			if errDec := json.NewDecoder(respGet.Body).Decode(&results); errDec == nil && len(results) > 0 {
				_ = json.Unmarshal(results[0].Value, &currentConfig)
			}
			respGet.Body.Close()
		}
	}

	// 2. Update Groq keys
	currentConfig.GroqKeys = keys

	url := fmt.Sprintf("%s/rest/v1/global_settings?key=eq.ai_keys", sbURL)
	configJson, err := json.Marshal(currentConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal Groq keys config: %w", err)
	}

	payload := map[string]interface{}{
		"value":      json.RawMessage(configJson),
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}

	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal request payload: %w", err)
	}
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
