package integration

import (
	"archive/zip"
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
)

// legacySalt is retained ONLY for backwards-compatible decryption of license
// caches that were written by older builds. New writes always use a per-device
// random master key (see getMasterKey). Do not use this for new encryption.
const legacySalt = "BeidarPOS_Dev_Salt"

const (
	cacheDuration      = 30 * 24 * time.Hour
	gracePeriodWarning = 7 * 24 * time.Hour
)

// masterKeyState lazily loads (or generates) the device-bound master key used
// for license cache encryption. The key is stored in a 0600 file under AppData.
var (
	masterKeyMu     sync.Mutex
	masterKeyBytes  []byte
	masterKeyLoaded bool
)

type licenseCache struct {
	LicenseKey     string               `json:"licenseKey"`
	UserID         string               `json:"userId"`
	Result         domain.LicenseResult `json:"result"`
	CachedAt       int64                `json:"cachedAt"`
	LastServerTime int64                `json:"lastServerTime"`
	Checksum       string               `json:"checksum"`
}

func getCacheFilePath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}
	dataDir := filepath.Join(configDir, "BeidarPOS_V3")
	_ = os.MkdirAll(dataDir, 0755)
	return filepath.Join(dataDir, ".license_cache")
}

func getStoredLicenseKeyPath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}
	dataDir := filepath.Join(configDir, "BeidarPOS_V3")
	_ = os.MkdirAll(dataDir, 0755)
	return filepath.Join(dataDir, "license_key")
}

func (s *cloudService) storeLicenseKey(key string) {
	path := getStoredLicenseKeyPath()
	encrypted, _ := s.encrypt([]byte(key))
	_ = os.WriteFile(path, encrypted, 0600)
}

func (s *cloudService) GetStoredLicenseKey() string {
	path := getStoredLicenseKeyPath()
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	decrypted, err := s.decrypt(data)
	if err != nil {
		return ""
	}
	return string(decrypted)
}

func (s *cloudService) cacheResult(licenseKey, userID string, result *domain.LicenseResult) error {
	cache := licenseCache{
		LicenseKey:     licenseKey,
		UserID:         userID,
		Result:         *result,
		CachedAt:       time.Now().Unix(),
		LastServerTime: result.LastServerTime,
	}

	cacheData, _ := json.Marshal(cache)
	cache.Checksum = s.computeChecksum(cacheData)

	finalData, _ := json.Marshal(cache)
	encrypted, err := s.encrypt(finalData)
	if err != nil {
		return err
	}

	return os.WriteFile(getCacheFilePath(), encrypted, 0600)
}

func (s *cloudService) getCachedLicense(licenseKey, userID string) (*domain.LicenseResult, error) {
	data, err := os.ReadFile(getCacheFilePath())
	if err != nil {
		return nil, err
	}

	decrypted, err := s.decrypt(data)
	if err != nil {
		return nil, errors.New("cache corrupted")
	}

	var cache licenseCache
	if err := json.Unmarshal(decrypted, &cache); err != nil {
		return nil, err
	}

	storedChecksum := cache.Checksum
	cache.Checksum = ""
	cacheData, _ := json.Marshal(&licenseCache{
		LicenseKey:     cache.LicenseKey,
		UserID:         cache.UserID,
		Result:         cache.Result,
		CachedAt:       cache.CachedAt,
		LastServerTime: cache.LastServerTime,
	})
	if s.computeChecksum(cacheData) != storedChecksum {
		return nil, errors.New("cache tampered")
	}

	timeSinceLastCheck := time.Now().Unix() - cache.CachedAt
	if timeSinceLastCheck < -300 { // Allow 5 mins maximum drift
		return nil, errors.New("time tampered")
	}
	if time.Now().Unix() < cache.LastServerTime {
		return nil, errors.New("time tampered")
	}
	if timeSinceLastCheck > int64(cacheDuration.Seconds()) {
		return nil, errors.New("cache expired")
	}

	message := "تم التحقق من النسخة المحلية (وضع عدم الاتصال)"
	if timeSinceLastCheck > int64(gracePeriodWarning.Seconds()) {
		daysLeft := 30 - int(timeSinceLastCheck/86400)
		if daysLeft < 0 {
			daysLeft = 0
		}
		message = fmt.Sprintf("⚠️ تحذير: لم تتصل بالإنترنت منذ فترة طويلة. سيتوقف البرنامج خلال %d يوم.", daysLeft)
	}
	cache.Result.Message = message

	if cache.UserID != userID {
		return nil, errors.New("user mismatch")
	}

	if licenseKey != "" && cache.LicenseKey != licenseKey {
		return nil, errors.New("license key mismatch")
	}

	return &cache.Result, nil
}

func (s *cloudService) computeChecksum(data []byte) string {
	// The checksum uses the legacy salt for backwards compatibility with
	// existing caches; the integrity it provides is about tamper detection of
	// the cache payload, not secrecy of the data (which is handled by AES-GCM).
	hash := sha256.Sum256(append(data, []byte(legacySalt)...))
	return hex.EncodeToString(hash[:])
}

func (s *cloudService) ClearLicenseCache() {
	_ = os.Remove(getCacheFilePath())
	_ = os.Remove(getStoredLicenseKeyPath())
}

// masterKeyPath returns the location of the device-bound master key file under
// AppData. The file holds 32 random bytes written with mode 0600.
func masterKeyPath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}
	dir := filepath.Join(configDir, "BeidarPOS_V3")
	_ = os.MkdirAll(dir, 0755)
	return filepath.Join(dir, ".license_masterkey")
}

// loadOrCreateMasterKey returns the 32-byte master key, generating and
// persisting it on first use. Subsequent calls return the cached value.
func loadOrCreateMasterKey() ([]byte, error) {
	masterKeyMu.Lock()
	defer masterKeyMu.Unlock()

	if masterKeyLoaded {
		return masterKeyBytes, nil
	}

	path := masterKeyPath()
	if data, err := os.ReadFile(path); err == nil && len(data) >= 32 {
		masterKeyBytes = data[:32]
		masterKeyLoaded = true
		return masterKeyBytes, nil
	}

	// Generate a fresh 256-bit key.
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("generate master key: %w", err)
	}
	if err := os.WriteFile(path, key, 0600); err != nil {
		return nil, fmt.Errorf("persist master key: %w", err)
	}
	masterKeyBytes = key
	masterKeyLoaded = true
	return masterKeyBytes, nil
}

// getEncryptionKey returns the device-bound AES key derived from the master key.
// Used for all NEW encryption.
func (s *cloudService) getEncryptionKey() ([]byte, error) {
	mk, err := loadOrCreateMasterKey()
	if err != nil {
		return nil, err
	}
	// Derive a 32-byte AES key from the master key via SHA-256.
	sum := sha256.Sum256(append(mk, []byte("BeidarPOS_License_AES_v3")...))
	return sum[:], nil
}

// legacyEncryptionKey reproduces the OLD hardcoded derivation so we can still
// decrypt caches written by previous builds (one-time migration).
func legacyEncryptionKey() []byte {
	hash := sha256.Sum256([]byte(legacySalt + "BeidarPOS_Encryption_Key_v3"))
	return hash[:]
}

func (s *cloudService) encrypt(plaintext []byte) ([]byte, error) {
	key, err := s.getEncryptionKey()
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return []byte(base64.StdEncoding.EncodeToString(ciphertext)), nil
}

func (s *cloudService) decrypt(data []byte) ([]byte, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(string(data))
	if err != nil {
		return nil, err
	}

	// Try the new device-bound key first.
	key, kerr := s.getEncryptionKey()
	if kerr == nil {
		if plaintext, derr := aesGCMDecrypt(key, ciphertext); derr == nil {
			return plaintext, nil
		}
	}

	// Backwards-compat fallback: caches written by older builds used the
	// hardcoded key. This lets users upgrade without losing their cached
	// license; the next write rotates them onto the device-bound key.
	return aesGCMDecrypt(legacyEncryptionKey(), ciphertext)
}

// aesGCMDecrypt performs AES-GCM decryption with the given key.
func aesGCMDecrypt(key, ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(ciphertext) < gcm.NonceSize() {
		return nil, errors.New("ciphertext too short")
	}
	nonce, ciphertext := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

func (s *cloudService) VerifyLicense(licenseKey string) (*domain.LicenseResult, error) {
	licenseKey = strings.ToUpper(strings.TrimSpace(licenseKey))

	if licenseKey == "" {
		return &domain.LicenseResult{Licensed: false, Message: "مفتاح الترخيص مطلوب"}, nil
	}

	user := s.GetCurrentUser()
	if user == nil {
		return &domain.LicenseResult{Licensed: false, Message: "يجب تسجيل الدخول أولاً"}, nil
	}

	result, err := s.verifyOnline(user.UserID)
	if err == nil && result.Licensed {
		_ = s.cacheResult(licenseKey, user.UserID, result)
		s.saveSessionToCache()
		return result, nil
	}

	cached, cacheErr := s.getCachedLicense(licenseKey, user.UserID)
	if cacheErr == nil && cached != nil && cached.Licensed {
		cached.Message = "تم التحقق من النسخة المحلية (وضع عدم الاتصال)"
		s.saveSessionToCache()
		return cached, nil
	}

	if result != nil {
		return result, nil
	}
	return &domain.LicenseResult{Licensed: false, Message: "فشل التحقق من الترخيص"}, nil
}

func (s *cloudService) ActivateLicense(licenseKey string) (*domain.LicenseResult, error) {
	licenseKey = strings.ToUpper(strings.TrimSpace(licenseKey))

	if licenseKey == "" {
		return &domain.LicenseResult{Licensed: false, Message: "مفتاح الترخيص مطلوب"}, nil
	}

	user := s.GetCurrentUser()
	if user == nil {
		return &domain.LicenseResult{Licensed: false, Message: "يجب تسجيل الدخول أولاً لتفعيل الترخيص"}, nil
	}

	result, err := s.activateOnline(licenseKey, user.UserID)
	if err != nil {
		return &domain.LicenseResult{Licensed: false, Message: "تعذر الاتصال بخادم التراخيص"}, err
	}

	if result.Licensed {
		s.storeLicenseKey(licenseKey)
		_ = s.cacheResult(licenseKey, user.UserID, result)
		s.saveSessionToCache()
	}

	return result, nil
}

func (s *cloudService) GetCachedLicense() (*domain.LicenseResult, error) {
	storedKey := s.GetStoredLicenseKey()
	if storedKey == "" {
		return &domain.LicenseResult{Licensed: false, Message: "لا يوجد ترخيص مخزن"}, nil
	}

	user := s.GetCurrentUser()
	if user == nil {
		return &domain.LicenseResult{Licensed: false, Message: "يجب تسجيل الدخول أولاً"}, nil
	}

	return s.getCachedLicense(storedKey, user.UserID)
}

func (s *cloudService) GetUserLicenseStatus() (*domain.LicenseResult, error) {
	user := s.GetLocalSession()
	if user == nil {
		return &domain.LicenseResult{Licensed: false, Message: "يجب تسجيل الدخول أولاً"}, nil
	}

	result, err := s.verifyOnline(user.UserID)

	if err == nil {
		if result.Licensed {
			storedKey := s.GetStoredLicenseKey()
			if storedKey == "" {
				storedKey = "AUTO_" + user.UserID[:8]
				s.storeLicenseKey(storedKey)
			}
			_ = s.cacheResult(storedKey, user.UserID, result)
			s.saveSessionToCache()
			return result, nil
		} else {
			_ = os.Remove(getCacheFilePath())
			return result, nil
		}
	}

	storedKey := s.GetStoredLicenseKey()
	if storedKey != "" {
		cached, cacheErr := s.getCachedLicense(storedKey, user.UserID)
		if cacheErr == nil && cached != nil && cached.Licensed {
			cached.Message = "تم التحقق من النسخة المحلية (وضع عدم الاتصال)"
			return cached, nil
		}
	}

	if result != nil {
		return result, nil
	}
	return &domain.LicenseResult{Licensed: false, Message: "لا يوجد ترخيص مرتبط بحسابك"}, nil
}



func (s *cloudService) verifyOnline(userID string) (*domain.LicenseResult, error) {
	url := functionsURL + "/verify_license"

	body := map[string]string{
		"userId": userID,
	}
	jsonBody, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", url, strings.NewReader(string(jsonBody)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+supabaseKey)

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result domain.LicenseResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

func (s *cloudService) activateOnline(licenseKey, userID string) (*domain.LicenseResult, error) {
	url := functionsURL + "/activate_license"

	body := map[string]string{
		"licenseKey": licenseKey,
		"userId":     userID,
	}
	jsonBody, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", url, strings.NewReader(string(jsonBody)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+supabaseKey)

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result domain.LicenseResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}



func compressDatabaseForBackup() ([]byte, error) {
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	dbPath := filepath.Join(configDir, "BeidarPOS_V3", "beidar_v3.db")

	var srcPath string
	useTemp := false

	db := repository.GetDB()
	if db != nil {
		tempFile := filepath.Join(os.TempDir(), fmt.Sprintf("beidar_backup_%d.db", time.Now().UnixNano()))
		if err := db.Exec("VACUUM INTO ?", tempFile).Error; err == nil {
			srcPath = tempFile
			useTemp = true
		}
	}

	if srcPath == "" {
		srcPath = dbPath
	}

	dbFile, err := os.Open(srcPath)
	if err != nil {
		return nil, err
	}
	defer dbFile.Close()

	if useTemp {
		defer os.Remove(srcPath)
	}

	info, err := dbFile.Stat()
	if err != nil {
		return nil, err
	}

	header, _ := zip.FileInfoHeader(info)
	header.Name = "beidar_v3.db"
	header.Method = zip.Deflate

	writer, err := zipWriter.CreateHeader(header)
	if err != nil {
		return nil, err
	}

	_, _ = io.Copy(writer, dbFile)
	_ = zipWriter.Close()

	return buf.Bytes(), nil
}

func restoreFromCompressed(data []byte) error {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}

	if err := repository.CloseDB(); err != nil {
		return err
	}

	backupPath, err := repository.BackupPath()
	if err != nil {
		return err
	}

	for _, file := range reader.File {
		if file.Name == "beidar_v3.db" {
			rc, err := file.Open()
			if err != nil {
				_ = repository.RestoreBackup(backupPath)
				return err
			}
			defer rc.Close()

			configDir, _ := os.UserConfigDir()
			dbPath := filepath.Join(configDir, "BeidarPOS_V3", "beidar_v3.db")
			outFile, err := os.Create(dbPath)
			if err != nil {
				_ = repository.RestoreBackup(backupPath)
				return err
			}
			defer outFile.Close()

			_, _ = io.Copy(outFile, rc)
			_ = os.Remove(backupPath)

			if _, err := repository.InitDB(); err != nil {
				return fmt.Errorf("فشل إعادة تهيئة قاعدة البيانات: %v", err)
			}

			return nil
		}
	}

	_ = repository.RestoreBackup(backupPath)
	return fmt.Errorf("لم يتم العثور على ملف قاعدة البيانات في النسخة الاحتياطية")
}
