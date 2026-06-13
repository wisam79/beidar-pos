package integration

import (
	"encoding/json"
	"os"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupTestIntegration(t *testing.T) (CloudService, *gorm.DB, func()) {
	dbFileName := "test_integration_" + uuid.New().String()[:8] + ".db"
	_ = os.Remove(dbFileName)

	db, err := gorm.Open(sqlite.Open(dbFileName), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}

	// Auto-migrate tables
	db.AutoMigrate(
		&domain.AppPreferences{},
		&domain.Sale{},
		&domain.SaleItem{},
		&domain.Staff{},
	)

	// Seed default preferences
	defaultPrefs := domain.AppPreferences{
		StoreName: "متجر بيدر التجريبي",
		Currency:  "IQD",
	}
	db.Create(&defaultPrefs)

	preferencesRepo := repository.NewPreferencesRepository(db)
	saleRepo := repository.NewSaleRepository(db)
	staffRepo := repository.NewStaffRepository(db)

	service := NewCloudService(preferencesRepo, saleRepo, staffRepo)

	return service, db, func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
		_ = os.Remove(dbFileName)
		_ = os.Remove(getCacheFilePath())
		_ = os.Remove(getStoredLicenseKeyPath())
		_ = os.Remove(getZohoConfigPath())
	}
}

func TestEncryptionHelpers(t *testing.T) {
	service, _, cleanup := setupTestIntegration(t)
	defer cleanup()

	s := service.(*cloudService)

	plaintext := []byte("Hello, Beidar POS Encryption!")
	ciphertext, err := s.encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encryption failed: %v", err)
	}

	decrypted, err := s.decrypt(ciphertext)
	if err != nil {
		t.Fatalf("Decryption failed: %v", err)
	}

	if string(decrypted) != string(plaintext) {
		t.Errorf("Expected %s, got %s", string(plaintext), string(decrypted))
	}
}

func TestLicenseCache(t *testing.T) {
	service, _, cleanup := setupTestIntegration(t)
	defer cleanup()

	s := service.(*cloudService)

	licenseKey := "BIDAR-TEST-KEY"
	userID := "user-id-12345"

	result := &domain.LicenseResult{
		Licensed:      true,
		Success:       true,
		Message:       "تفعيل ناجح",
		CustomerName:  "عميل تجريبي",
		CustomerPhone: "07700000000",
		StoreName:     "متجر تجريبي",
		Features: map[string]bool{
			"ai_features": true,
			"cloud_sync":  true,
		},
		ExpiresAt: time.Now().AddDate(0, 1, 0).Format(time.RFC3339),
	}

	// 1. Cache result
	err := s.cacheResult(licenseKey, userID, result)
	if err != nil {
		t.Fatalf("Cache result failed: %v", err)
	}

	// 2. Retrieve cached result
	cached, err := s.getCachedLicense(licenseKey, userID)
	if err != nil {
		t.Fatalf("Get cached license failed: %v", err)
	}

	if !cached.Licensed {
		t.Error("Expected licensed to be true")
	}

	if cached.CustomerName != "عميل تجريبي" {
		t.Errorf("Expected customer name 'عميل تجريبي', got %s", cached.CustomerName)
	}

	// 3. Test tampering by modifying cache file
	cachePath := getCacheFilePath()
	data, _ := os.ReadFile(cachePath)
	// Decrypt, modify and save without checksum update
	decrypted, _ := s.decrypt(data)
	var cache licenseCache
	json.Unmarshal(decrypted, &cache)
	cache.Result.CustomerName = "اسم متلاعب به"
	tamperedData, _ := json.Marshal(cache)
	encryptedTampered, _ := s.encrypt(tamperedData)
	_ = os.WriteFile(cachePath, encryptedTampered, 0600)

	_, err = s.getCachedLicense(licenseKey, userID)
	if err == nil {
		t.Error("Expected error for tampered cache, but got nil")
	}
}

func TestZohoConfig(t *testing.T) {
	service, _, cleanup := setupTestIntegration(t)
	defer cleanup()

	s := service.(*cloudService)

	config := &domain.ZohoConfig{
		ClientID:       "client-id",
		ClientSecret:   "client-secret",
		RefreshToken:   "refresh-token",
		AccessToken:    "access-token",
		OrganizationID: "org-id",
		TokenExpiry:    time.Now().Unix() + 3600,
		Enabled:        true,
	}

	err := s.SaveZohoConfig(config)
	if err != nil {
		t.Fatalf("SaveZohoConfig failed: %v", err)
	}

	loaded, err := s.LoadZohoConfig()
	if err != nil {
		t.Fatalf("LoadZohoConfig failed: %v", err)
	}

	if loaded.ClientID != "client-id" {
		t.Errorf("Expected ClientID 'client-id', got %s", loaded.ClientID)
	}
	if !loaded.Enabled {
		t.Error("Expected Enabled to be true")
	}
}
