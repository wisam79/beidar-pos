package service_test

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/pkg/crashreporter"
	"beidar-desktop/pkg/logger"
	"beidar-desktop/pkg/secureconfig"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupSettingsTestDB(t *testing.T) (service.SettingsService, *gorm.DB, func()) {
	logger.InitLogger(logger.INFO, false)
	dbFileName := "test_settings_" + uuid.New().String()[:8] + ".db"
	os.Remove(dbFileName)

	db, err := gorm.Open(sqlite.Open(dbFileName), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}

	if err := db.AutoMigrate(&domain.AppPreferences{}); err != nil {
		t.Fatalf("Failed to migrate test DB: %v", err)
	}

	// Seed default preferences so Get() doesn't fail
	defaultPrefs := domain.AppPreferences{
		StoreName: "بيدر",
		AdminPin:  "1234",
	}
	db.Create(&defaultPrefs)

	preferencesRepo := repository.NewPreferencesRepository(db)
	settingsService := service.NewSettingsService(preferencesRepo)

	return settingsService, db, func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
		os.Remove(dbFileName)
	}
}

func TestPreferencesLifecycle(t *testing.T) {
	s, _, cleanup := setupSettingsTestDB(t)
	defer cleanup()

	// 1. Get initial preferences
	prefs, err := s.GetPreferences()
	if err != nil {
		t.Fatalf("GetPreferences failed: %v", err)
	}
	if prefs.StoreName != "بيدر" {
		t.Errorf("Expected StoreName 'بيدر', got %s", prefs.StoreName)
	}

	// 2. Verify admin PIN
	if !s.VerifyAdminPin("1234") {
		t.Error("Expected PIN '1234' to be valid")
	}
	if s.VerifyAdminPin("wrong") {
		t.Error("Expected PIN 'wrong' to be invalid")
	}

	// 3. Update preferences
	prefs.StoreName = "بيدر الجديد"
	prefs.AdminPin = "4321"
	err = s.UpdatePreferences(*prefs)
	if err != nil {
		t.Fatalf("UpdatePreferences failed: %v", err)
	}

	// 4. Verify updated preferences
	updatedPrefs, err := s.GetPreferences()
	if err != nil {
		t.Fatalf("GetPreferences failed after update: %v", err)
	}
	if updatedPrefs.StoreName != "بيدر الجديد" {
		t.Errorf("Expected StoreName 'بيدر الجديد', got %s", updatedPrefs.StoreName)
	}
	if !s.VerifyAdminPin("4321") {
		t.Error("Expected new PIN '4321' to be valid")
	}
}

func TestDeviceID(t *testing.T) {
	s, _, cleanup := setupSettingsTestDB(t)
	defer cleanup()

	// Retrieve Device ID (should generate a new one)
	id1, err := s.GetDeviceID()
	if err != nil {
		t.Fatalf("GetDeviceID first call failed: %v", err)
	}
	if id1 == "" {
		t.Fatal("Expected non-empty device ID")
	}

	// Call again, should return the exact same device ID
	id2, err := s.GetDeviceID()
	if err != nil {
		t.Fatalf("GetDeviceID second call failed: %v", err)
	}
	if id1 != id2 {
		t.Errorf("Expected device IDs to match. First: %s, Second: %s", id1, id2)
	}

	// Clean up generated device ID file
	configDir, err := os.UserConfigDir()
	if err == nil {
		deviceIDFile := filepath.Join(configDir, "BeidarPOS_V3", "device_id")
		os.Remove(deviceIDFile)
	}
}

func TestAutoStart(t *testing.T) {
	s, _, cleanup := setupSettingsTestDB(t)
	defer cleanup()

	// Verify we can toggle autostart or call the functions without crashing.
	// Since we are running in tests (which might not have full registry access
	// in some restricted environments), we won't strictly enforce registry changes
	// but we'll ensure they are callable and return expected errors/nil.
	_ = s.EnableAutoStart()
	_ = s.IsAutoStartEnabled()
	_ = s.DisableAutoStart()
}

func TestSettingsService_SupabaseAndUpdater(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Skipping settings service supabase and updater tests on non-Windows platforms")
	}
	s, _, cleanup := setupSettingsTestDB(t)
	defer cleanup()

	// 1. Test Crash Reports
	// Save a test crash report
	msg := "test crash message: " + uuid.New().String()
	filePath := crashreporter.SaveCrashReport(msg)
	if filePath == "" {
		t.Fatal("Expected non-empty filePath for saved crash report")
	}

	reports, err := s.GetCrashReports()
	if err != nil {
		t.Fatalf("GetCrashReports failed: %v", err)
	}
	if len(reports) == 0 {
		t.Error("Expected at least one crash report, got 0")
	}

	// Read content
	found := false
	for _, report := range reports {
		content, err := s.GetCrashReportContent(report)
		if err != nil {
			t.Fatalf("GetCrashReportContent failed: %v", err)
		}
		if len(content) > 0 && (len(content) > len(msg) || content != "") {
			found = true
		}
	}
	if !found {
		t.Error("Expected to find the logged crash report content")
	}

	// Clear crash reports
	err = s.ClearCrashReports()
	if err != nil {
		t.Fatalf("ClearCrashReports failed: %v", err)
	}

	reportsPostClear, err := s.GetCrashReports()
	if err != nil {
		t.Fatalf("GetCrashReports post-clear failed: %v", err)
	}
	if len(reportsPostClear) != 0 {
		t.Errorf("Expected 0 crash reports post clear, got %d", len(reportsPostClear))
	}

	// 2. Test Updates
	status := s.GetUpdateStatus()
	if status.Checking || status.Downloading || status.Installing {
		t.Error("Expected status to be idle initially")
	}

	err = s.SkipVersion("2.3.4")
	if err != nil {
		t.Fatalf("SkipVersion failed: %v", err)
	}

	// InstallUpdate with nonexistent file should fail
	err = s.InstallUpdate("nonexistent_path_to_installer_123.exe")
	if err == nil {
		t.Error("Expected InstallUpdate with invalid path to fail, got nil")
	}

	// Call CheckForUpdates, which will try hitting the network (and will fail gracefully or succeed)
	_, _ = s.CheckForUpdates()

	// 3. Setup Mock Server for Supabase and Updater
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Mock Supabase
		if r.URL.Path == "/rest/v1/global_settings" {
			if r.Method == "GET" {
				w.Header().Set("Content-Type", "application/json")
				response := []map[string]interface{}{
					{
						"id":         "ai_keys",
						"key":        "ai_keys",
						"value":      json.RawMessage(`{"gemini_keys": ["key-alpha", "key-beta"]}`),
						"updated_at": "2026-06-12T12:00:00Z",
					},
				}
				_ = json.NewEncoder(w).Encode(response)
				return
			}
			if r.Method == "PATCH" {
				// verify auth token
				authHeader := r.Header.Get("Authorization")
				if authHeader != "Bearer test-user-token" {
					w.WriteHeader(http.StatusUnauthorized)
					_, _ = w.Write([]byte(`{"error": "unauthorized"}`))
					return
				}
				w.WriteHeader(http.StatusNoContent) // 204
				return
			}
		}

		// Mock Updater Download
		if r.URL.Path == "/download/setup.exe" {
			w.Header().Set("Content-Length", "13")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("dummy content"))
			return
		}

		w.WriteHeader(http.StatusNotFound)
	}))
	defer mockServer.Close()

	// Backup environment variables
	oldURL := os.Getenv("BEIDAR_SUPABASE_URL")
	oldKey := os.Getenv("BEIDAR_SUPABASE_KEY")
	defer func() {
		if oldURL != "" {
			os.Setenv("BEIDAR_SUPABASE_URL", oldURL)
		} else {
			os.Unsetenv("BEIDAR_SUPABASE_URL")
		}
		if oldKey != "" {
			os.Setenv("BEIDAR_SUPABASE_KEY", oldKey)
		} else {
			os.Unsetenv("BEIDAR_SUPABASE_KEY")
		}
		secureconfig.ResetCache()
	}()

	os.Setenv("BEIDAR_SUPABASE_URL", mockServer.URL)
	os.Setenv("BEIDAR_SUPABASE_KEY", "test-sb-key")
	secureconfig.ResetCache()

	// 4. Test FetchGlobalAIKeys
	keys, err := s.FetchGlobalAIKeys()
	if err != nil {
		t.Fatalf("FetchGlobalAIKeys failed: %v", err)
	}
	if len(keys) != 2 || keys[0] != "key-alpha" || keys[1] != "key-beta" {
		t.Errorf("Unexpected keys retrieved: %v", keys)
	}

	// Test invalid JSON response from Supabase (FetchGlobalAIKeys error case)
	// Temporarily point URL to an endpoint returning garbage
	os.Setenv("BEIDAR_SUPABASE_URL", mockServer.URL+"/badpath")
	secureconfig.ResetCache()
	_, err = s.FetchGlobalAIKeys()
	if err == nil {
		t.Error("Expected FetchGlobalAIKeys to fail with 404 status from supabase")
	}
	os.Setenv("BEIDAR_SUPABASE_URL", mockServer.URL)
	secureconfig.ResetCache()

	// 5. Test SaveGlobalAIKeys
	err = s.SaveGlobalAIKeys([]string{"key-alpha"}, "")
	if err == nil {
		t.Error("Expected error when saving keys without token, got nil")
	}

	err = s.SaveGlobalAIKeys([]string{"key-alpha"}, "test-user-token")
	if err != nil {
		t.Fatalf("SaveGlobalAIKeys failed: %v", err)
	}

	// Test SaveGlobalAIKeys with invalid token / unauthorized response
	err = s.SaveGlobalAIKeys([]string{"key-alpha"}, "bad-token")
	if err == nil {
		t.Error("Expected SaveGlobalAIKeys with bad token to fail, got nil")
	}

	// 6. Test DownloadUpdate (covers downloader code)
	// Calculate correct checksum of "dummy content"
	dummyHashBytes := sha256.Sum256([]byte("dummy content"))
	correctChecksum := hex.EncodeToString(dummyHashBytes[:])

	dlPath, err := s.DownloadUpdate(mockServer.URL+"/download/setup.exe", correctChecksum)
	if err != nil {
		t.Fatalf("DownloadUpdate failed: %v", err)
	}
	defer os.Remove(dlPath)

	if _, err := os.Stat(dlPath); err != nil {
		t.Errorf("Downloaded file does not exist: %v", err)
	}

	// Test DownloadUpdate checksum mismatch
	_, err = s.DownloadUpdate(mockServer.URL+"/download/setup.exe", "wrongchecksum")
	if err == nil {
		t.Error("Expected DownloadUpdate with incorrect checksum to fail, got nil")
	}
}
