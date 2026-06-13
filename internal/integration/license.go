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
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

var (
	encryptionSalt = "BeidarPOS_Dev_Salt"
	masterKey      string
)

const (
	cacheDuration      = 30 * 24 * time.Hour
	gracePeriodWarning = 7 * 24 * time.Hour
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
	hash := sha256.Sum256(append(data, []byte(encryptionSalt)...))
	return hex.EncodeToString(hash[:])
}

func (s *cloudService) ClearLicenseCache() {
	_ = os.Remove(getCacheFilePath())
	_ = os.Remove(getStoredLicenseKeyPath())
}

func (s *cloudService) getEncryptionKey() []byte {
	hash := sha256.Sum256([]byte(encryptionSalt + "BeidarPOS_Encryption_Key_v3"))
	return hash[:]
}

func (s *cloudService) encrypt(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(s.getEncryptionKey())
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

	block, err := aes.NewCipher(s.getEncryptionKey())
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
		s.cacheResult(licenseKey, user.UserID, result)
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
		s.cacheResult(licenseKey, user.UserID, result)
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
			s.cacheResult(storedKey, user.UserID, result)
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

func (s *cloudService) CheckLicenseStatus(licenseKey string) (*domain.LicenseResult, error) {
	licenseKey = strings.ToUpper(strings.TrimSpace(licenseKey))

	if licenseKey == "" {
		return &domain.LicenseResult{Licensed: false, Message: "مفتاح الترخيص مطلوب"}, nil
	}

	url := fmt.Sprintf("%s/rest/v1/licenses?license_key=eq.%s&select=id,status,user_id,expires_at", supabaseURL, licenseKey)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	req.Header.Set("apikey", s.getAdminKey())

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return &domain.LicenseResult{Licensed: false, Message: "تعذر الاتصال بالخادم"}, err
	}
	defer resp.Body.Close()

	var rows []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&rows)

	if len(rows) == 0 {
		return &domain.LicenseResult{Licensed: false, Message: "مفتاح الترخيص غير موجود"}, nil
	}

	license := rows[0]

	if license["status"] != "active" {
		return &domain.LicenseResult{Licensed: false, Message: "الترخيص غير نشط"}, nil
	}

	if license["user_id"] != nil {
		return &domain.LicenseResult{Licensed: false, Message: "هذا الترخيص مستخدم بالفعل"}, nil
	}

	return &domain.LicenseResult{Licensed: true, Message: "مفتاح الترخيص صالح ومتاح"}, nil
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

func (s *cloudService) getAdminKey() string {
	if masterKey != "" {
		return masterKey
	}
	return supabaseKey
}

func (s *cloudService) SetMasterKey(key string) {
	if key != "" {
		masterKey = key
	}
}

func (s *cloudService) AdminLogin(username, password string) (*domain.AdminLoginResult, error) {
	username = strings.TrimSpace(username)
	password = strings.TrimSpace(password)

	if username == "" || password == "" {
		return &domain.AdminLoginResult{Success: false, Message: "الرجاء إدخال اسم المستخدم وكلمة المرور"}, nil
	}

	url := fmt.Sprintf("%s/rest/v1/app_admins?username=ilike.%s&select=password_hash", supabaseURL, username)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	req.Header.Set("apikey", s.getAdminKey())

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return &domain.AdminLoginResult{Success: false, Message: "فشل الاتصال: " + err.Error()}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return &domain.AdminLoginResult{Success: false, Message: fmt.Sprintf("خطأ في الخادم: %d", resp.StatusCode)}, nil
	}

	var results []map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return &domain.AdminLoginResult{Success: false, Message: "خطأ في معالجة البيانات"}, nil
	}

	if len(results) == 0 {
		return &domain.AdminLoginResult{Success: false, Message: "اسم المستخدم غير موجود"}, nil
	}

	dbPassword := results[0]["password_hash"]
	if err := bcrypt.CompareHashAndPassword([]byte(dbPassword), []byte(password)); err != nil {
		return &domain.AdminLoginResult{Success: false, Message: "كلمة المرور غير صحيحة"}, nil
	}

	return &domain.AdminLoginResult{Success: true, Message: "تم تسجيل الدخول"}, nil
}

func (s *cloudService) FetchAllLicenses() ([]domain.LicenseInfo, error) {
	url := supabaseURL + "/rest/v1/licenses?select=*&order=created_at.desc"

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	req.Header.Set("apikey", s.getAdminKey())

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rows []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&rows)

	licenses := make([]domain.LicenseInfo, len(rows))
	for i, row := range rows {
		licenses[i] = domain.LicenseInfo{
			ID:            int(licenseGetFloat(row, "id")),
			LicenseKey:    licenseGetString(row, "license_key"),
			CustomerName:  licenseGetString(row, "customer_name"),
			CustomerPhone: licenseGetString(row, "customer_phone"),
			StoreName:     licenseGetString(row, "store_name"),
			Status:        licenseGetString(row, "status"),
			ExpiresAt:     licenseGetString(row, "expires_at"),
			CreatedAt:     licenseGetString(row, "created_at"),
			UserID:        licenseGetString(row, "user_id"),
			BoundAt:       licenseGetString(row, "bound_at"),
			LastCheckIn:   licenseGetString(row, "last_check_in"),
			AppVersion:    licenseGetString(row, "app_version"),
			IsPaid:        licenseGetBool(row, "is_paid"),
		}
		if features, ok := row["features"].(map[string]interface{}); ok {
			licenses[i].Features = make(map[string]bool)
			for k, v := range features {
				if b, ok := v.(bool); ok {
					licenses[i].Features[k] = b
				}
			}
		}
	}

	return licenses, nil
}

func (s *cloudService) CreateLicense(customerName, customerPhone string, months int, features map[string]bool) (*domain.LicenseInfo, error) {
	licenseKey := generateLicenseKey()

	var expiresAt string
	if months == 0 {
		expiresAt = time.Now().AddDate(0, 0, 7).Format(time.RFC3339)
	} else {
		expiresAt = time.Now().AddDate(0, months, 0).Format(time.RFC3339)
	}

	featuresJSON, _ := json.Marshal(features)

	body := fmt.Sprintf(`{
		"license_key": "%s",
		"customer_name": "%s",
		"customer_phone": "%s",
		"status": "active",
		"expires_at": "%s",
		"features": %s
	}`, licenseKey, customerName, customerPhone, expiresAt, string(featuresJSON))

	req, _ := http.NewRequest("POST", supabaseURL+"/rest/v1/licenses", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	req.Header.Set("apikey", s.getAdminKey())
	req.Header.Set("Prefer", "return=representation")

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 201 {
		return nil, fmt.Errorf("فشل إنشاء الترخيص: %d", resp.StatusCode)
	}

	return &domain.LicenseInfo{
		LicenseKey:    licenseKey,
		CustomerName:  customerName,
		CustomerPhone: customerPhone,
		Status:        "active",
		ExpiresAt:     expiresAt,
	}, nil
}

func generateLicenseKey() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return "BIDAR-" + strings.ToUpper(hex.EncodeToString(bytes))
}

func (s *cloudService) UpdateLicenseStatus(id int, status string) error {
	body := fmt.Sprintf(`{"status": "%s", "updated_at": "%s"}`, status, time.Now().Format(time.RFC3339))

	req, _ := http.NewRequest("PATCH", fmt.Sprintf("%s/rest/v1/licenses?id=eq.%d", supabaseURL, id), strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	req.Header.Set("apikey", s.getAdminKey())

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (s *cloudService) ExtendLicense(id int, currentExpiry string, months int) error {
	current, _ := time.Parse(time.RFC3339, currentExpiry)
	newExpiry := current.AddDate(0, months, 0).Format(time.RFC3339)

	body := fmt.Sprintf(`{"expires_at": "%s", "updated_at": "%s"}`, newExpiry, time.Now().Format(time.RFC3339))

	req, _ := http.NewRequest("PATCH", fmt.Sprintf("%s/rest/v1/licenses?id=eq.%d", supabaseURL, id), strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	req.Header.Set("apikey", s.getAdminKey())

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (s *cloudService) ResetLicenseToTrial(id int) error {
	url := fmt.Sprintf("%s/rest/v1/licenses?id=eq.%d&select=created_at", supabaseURL, id)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	req.Header.Set("apikey", s.getAdminKey())

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var rows []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return fmt.Errorf("failed to parse response: %v", err)
	}

	if len(rows) == 0 {
		return fmt.Errorf("license not found")
	}

	createdAtStr := licenseGetString(rows[0], "created_at")
	if createdAtStr == "" {
		return fmt.Errorf("created_at not found")
	}

	createdAt, err := time.Parse(time.RFC3339, createdAtStr)
	if err != nil {
		createdAt, err = time.Parse("2006-01-02T15:04:05.999999-07:00", createdAtStr)
		if err != nil {
			return fmt.Errorf("failed to parse created_at: %v", err)
		}
	}

	newExpiry := createdAt.AddDate(0, 0, 7).Format(time.RFC3339)
	updateBody := fmt.Sprintf(`{"expires_at": "%s", "updated_at": "%s"}`, newExpiry, time.Now().Format(time.RFC3339))

	updateReq, _ := http.NewRequest("PATCH", fmt.Sprintf("%s/rest/v1/licenses?id=eq.%d", supabaseURL, id), strings.NewReader(updateBody))
	updateReq.Header.Set("Content-Type", "application/json")
	updateReq.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	updateReq.Header.Set("apikey", s.getAdminKey())

	updateResp, err := getPinnedClient().Do(updateReq)
	if err != nil {
		return err
	}
	defer updateResp.Body.Close()

	return nil
}

func (s *cloudService) UpdatePaymentStatus(id int, isPaid bool) error {
	body := fmt.Sprintf(`{"is_paid": %t, "updated_at": "%s"}`, isPaid, time.Now().Format(time.RFC3339))

	req, _ := http.NewRequest("PATCH", fmt.Sprintf("%s/rest/v1/licenses?id=eq.%d", supabaseURL, id), strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	req.Header.Set("apikey", s.getAdminKey())

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (s *cloudService) DeleteLicenseRemote(id int) error {
	req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/rest/v1/licenses?id=eq.%d", supabaseURL, id), nil)
	req.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	req.Header.Set("apikey", s.getAdminKey())

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (s *cloudService) FetchAdminLogs() ([]domain.AdminLogEntry, error) {
	url := supabaseURL + "/rest/v1/admin_logs?select=*&order=created_at.desc&limit=100"

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	req.Header.Set("apikey", s.getAdminKey())

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rows []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&rows)

	logs := make([]domain.AdminLogEntry, len(rows))
	for i, row := range rows {
		logs[i] = domain.AdminLogEntry{
			ID:            int(licenseGetFloat(row, "id")),
			AdminUsername: licenseGetString(row, "admin_username"),
			Action:        licenseGetString(row, "action"),
			TargetLicense: licenseGetString(row, "target_license"),
			Details:       licenseGetString(row, "details"),
			CreatedAt:     licenseGetString(row, "created_at"),
		}
	}

	return logs, nil
}

func (s *cloudService) LogAdminAction(adminUsername, action, targetLicense, details string) {
	body := fmt.Sprintf(`{
		"admin_username": "%s",
		"action": "%s",
		"target_license": "%s",
		"details": "%s"
	}`, adminUsername, action, targetLicense, details)

	req, _ := http.NewRequest("POST", supabaseURL+"/rest/v1/admin_logs", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	req.Header.Set("apikey", s.getAdminKey())

	resp, err := getPinnedClient().Do(req)
	if err == nil {
		resp.Body.Close()
	}
}

func (s *cloudService) GetLicenseUserDetails(userID string) (*domain.UserDetails, error) {
	details := &domain.UserDetails{
		UserID: userID,
	}

	url := fmt.Sprintf("%s/rest/v1/rpc/get_user_by_id", supabaseURL)
	bodyBytes, _ := json.Marshal(map[string]string{"user_id": userID})
	userReq, _ := http.NewRequest("POST", url, strings.NewReader(string(bodyBytes)))
	userReq.Header.Set("Content-Type", "application/json")
	userReq.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	userReq.Header.Set("apikey", s.getAdminKey())

	userResp, err := getPinnedClient().Do(userReq)
	if err == nil && userResp.StatusCode == 200 {
		var userData map[string]interface{}
		json.NewDecoder(userResp.Body).Decode(&userData)
		details.Email = licenseGetString(userData, "email")
		details.StoreName = licenseGetString(userData, "raw_user_meta_data.store_name")
		details.CreatedAt = licenseGetString(userData, "created_at")
		details.LastSignIn = licenseGetString(userData, "last_sign_in_at")
	}
	if userResp != nil {
		userResp.Body.Close()
	}

	backupsURL := fmt.Sprintf("%s/rest/v1/user_backups?user_id=eq.%s&select=*&order=created_at.desc", supabaseURL, userID)
	backupsReq, _ := http.NewRequest("GET", backupsURL, nil)
	backupsReq.Header.Set("Authorization", "Bearer "+supabaseKey)
	backupsReq.Header.Set("apikey", supabaseKey)

	backupsResp, err := getPinnedClient().Do(backupsReq)
	if err == nil {
		var backupsData []map[string]interface{}
		json.NewDecoder(backupsResp.Body).Decode(&backupsData)
		backupsResp.Body.Close()

		for _, b := range backupsData {
			details.Backups = append(details.Backups, domain.DashboardBackupInfo{
				ID:        licenseGetString(b, "id"),
				BackupID:  licenseGetString(b, "backup_id"),
				StoreName: licenseGetString(b, "store_name"),
				Size:      int64(licenseGetFloat(b, "total_size")),
				CreatedAt: licenseGetString(b, "created_at"),
			})
		}
	}

	sessionsURL := fmt.Sprintf("%s/rest/v1/active_sessions?user_id=eq.%s&select=*", supabaseURL, userID)
	sessionsReq, _ := http.NewRequest("GET", sessionsURL, nil)
	sessionsReq.Header.Set("Authorization", "Bearer "+supabaseKey)
	sessionsReq.Header.Set("apikey", supabaseKey)

	sessionsResp, err := getPinnedClient().Do(sessionsReq)
	if err == nil {
		var sessionsData []map[string]interface{}
		json.NewDecoder(sessionsResp.Body).Decode(&sessionsData)
		sessionsResp.Body.Close()

		for _, sRef := range sessionsData {
			details.Sessions = append(details.Sessions, domain.DashboardSessionInfo{
				DeviceName: licenseGetString(sRef, "device_name"),
				LoginTime:  licenseGetString(sRef, "login_time"),
				LastSeen:   licenseGetString(sRef, "last_seen"),
			})
		}
	}

	return details, nil
}

func (s *cloudService) UpdateLicenseFeatures(id int, features map[string]bool) error {
	featuresJSON, err := json.Marshal(features)
	if err != nil {
		return err
	}

	body := fmt.Sprintf(`{"features": %s, "updated_at": "%s"}`, string(featuresJSON), time.Now().Format(time.RFC3339))

	req, _ := http.NewRequest("PATCH", fmt.Sprintf("%s/rest/v1/licenses?id=eq.%d", supabaseURL, id), strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	req.Header.Set("apikey", s.getAdminKey())

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("failed to update features: %d", resp.StatusCode)
	}

	go s.syncUserFeaturesFromLicense(id)

	return nil
}

func (s *cloudService) syncUserFeaturesFromLicense(licenseID int) {
	url := fmt.Sprintf("%s/rest/v1/licenses?id=eq.%d&select=*", supabaseURL, licenseID)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+s.getAdminKey())
	req.Header.Set("apikey", s.getAdminKey())

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		fmt.Printf("Sync Failed: %v\n", err)
		return
	}
	defer resp.Body.Close()

	var rows []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&rows)

	if len(rows) == 0 {
		return
	}
	license := rows[0]

	userID := licenseGetString(license, "user_id")
	if userID == "" {
		return
	}

	status := licenseGetString(license, "status")
	features := make(map[string]bool)
	if f, ok := license["features"].(map[string]interface{}); ok {
		for k, v := range f {
			if b, ok := v.(bool); ok {
				features[k] = b
			}
		}
	}

	metaUpdates := make(map[string]interface{})
	isActive := status == "active"

	enableAI := false
	if isActive && features["ai_features"] {
		enableAI = true
	}
	metaUpdates["enable_ai"] = enableAI

	enableLAN := false
	if isActive && features["cloud_sync"] {
		enableLAN = true
	}
	metaUpdates["enable_lan"] = enableLAN

	enableWhatsApp := false
	if isActive && features["whatsapp_integration"] {
		enableWhatsApp = true
	}
	metaUpdates["enable_whatsapp"] = enableWhatsApp

	err = UpdateUserMetadata(userID, metaUpdates)
	if err != nil {
		fmt.Printf("Failed to sync metadata for user %s: %v\n", userID, err)
	} else {
		s.LogAdminAction("SYSTEM", "SYNC_FEATURES", licenseGetString(license, "license_key"), "Synced features to user metadata")
	}
}

func UpdateUserMetadata(userID string, updates map[string]interface{}) error {
	if userID == "" {
		return fmt.Errorf("user ID is required")
	}

	url := fmt.Sprintf("%s/auth/v1/admin/users/%s", supabaseURL, userID)

	body := map[string]interface{}{
		"user_metadata": updates,
	}
	jsonBody, _ := json.Marshal(body)

	req, _ := http.NewRequest("PUT", url, bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", supabaseKey)
	req.Header.Set("Authorization", "Bearer "+supabaseKey)

	resp, err := getPinnedClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to update user metadata (Status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

func licenseGetString(m map[string]interface{}, key string) string {
	parts := strings.Split(key, ".")
	var current interface{} = m
	for _, part := range parts {
		if currentMap, ok := current.(map[string]interface{}); ok {
			current = currentMap[part]
		} else {
			return ""
		}
	}
	if s, ok := current.(string); ok {
		return s
	}
	return ""
}

func licenseGetFloat(m map[string]interface{}, key string) float64 {
	if v, ok := m[key].(float64); ok {
		return v
	}
	return 0
}

func licenseGetBool(m map[string]interface{}, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}

func compressDatabaseForBackup() ([]byte, error) {
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	dbPath := filepath.Join(configDir, "BeidarPOS_V3", "beidar_v3.db")

	dbFile, err := os.Open(dbPath)
	if err != nil {
		return nil, err
	}
	defer dbFile.Close()

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

	io.Copy(writer, dbFile)
	zipWriter.Close()

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
