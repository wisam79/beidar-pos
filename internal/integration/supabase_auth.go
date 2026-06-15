package integration

import (
	"bytes"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/secureconfig"
)

const (
	MaxBackupSizeMB     = 1
	MaxBackupsPerUser   = 1
	BackupRetentionDays = 30
	MaxChunkSize        = 700 * 1024
)

var (
	supabaseURL        string
	supabaseKey        string
	functionsURL       string
	currentSession     *domain.UserSession
	currentSessionLock sync.RWMutex
	supabaseCertPool   *x509.CertPool
	pinnedHTTPClient   *http.Client
)

func initCertPinning() {
	supabaseCertPool, _ = x509.SystemCertPool()
	if supabaseCertPool == nil {
		supabaseCertPool = x509.NewCertPool()
	}

	host := ""
	if strings.HasPrefix(supabaseURL, "https://") {
		host = strings.TrimPrefix(supabaseURL, "https://")
	}

	tlsConfig := &tls.Config{
		RootCAs:    supabaseCertPool,
		MinVersion: tls.VersionTLS12,
		ServerName: host,
	}

	transport := &http.Transport{
		TLSClientConfig: tlsConfig,
	}

	pinnedHTTPClient = &http.Client{
		Transport: transport,
		Timeout:   30 * time.Second,
	}
}

func getPinnedClient() *http.Client {
	if pinnedHTTPClient == nil {
		initCertPinning()
	}
	return pinnedHTTPClient
}

func (s *cloudService) InitSecrets() {
	if supabaseURL == "" {
		if url, err := secureconfig.GetSupabaseURL(); err == nil {
			supabaseURL = url
		}
	}
	if supabaseKey == "" {
		if key, err := secureconfig.GetSupabaseKey(); err == nil {
			supabaseKey = key
		}
	}
	if supabaseURL != "" {
		functionsURL = supabaseURL + "/functions/v1"
	}
	initCertPinning()
}

func getSessionCachePath() string {
	configDir, _ := os.UserConfigDir()
	appDir := filepath.Join(configDir, "BeidarPOS_V3")
	_ = os.MkdirAll(appDir, 0755)
	return filepath.Join(appDir, "session.json")
}

func (s *cloudService) loadSessionFromCache() {
	currentSessionLock.Lock()
	defer currentSessionLock.Unlock()

	if currentSession != nil {
		return
	}

	data, err := os.ReadFile(getSessionCachePath())
	if err != nil {
		return
	}
	var session domain.UserSession
	if json.Unmarshal(data, &session) == nil {
		currentSession = &session
	}
}

func (s *cloudService) saveSessionToCache() {
	currentSessionLock.RLock()
	session := currentSession
	currentSessionLock.RUnlock()

	if session == nil {
		return
	}
	jsonData, _ := json.Marshal(session)
	_ = os.WriteFile(getSessionCachePath(), jsonData, 0600)
}

func (s *cloudService) clearSessionCache() {
	currentSessionLock.Lock()
	currentSession = nil
	currentSessionLock.Unlock()
	_ = os.Remove(getSessionCachePath())
}

func (s *cloudService) IsLoggedIn() bool {
	s.loadSessionFromCache()
	currentSessionLock.RLock()
	session := currentSession
	currentSessionLock.RUnlock()

	if session == nil {
		return false
	}

	if time.Now().Unix() > (session.ExpiresAt - 300) {
		fmt.Println("🔄 Session expired/expiring. Attempting refresh...")
		if err := s.RefreshSession(); err != nil {
			fmt.Printf("❌ Auto-refresh failed: %v\n", err)
			s.clearSessionCache()
			return false
		}
		fmt.Println("✅ Session refreshed successfully!")
	}

	return true
}

func (s *cloudService) RefreshSession() error {
	currentSessionLock.RLock()
	session := currentSession
	currentSessionLock.RUnlock()

	if session == nil || session.RefreshToken == "" {
		return fmt.Errorf("no refresh token available")
	}

	url := supabaseURL + "/auth/v1/token?grant_type=refresh_token"
	body := map[string]interface{}{
		"refresh_token": session.RefreshToken,
	}
	jsonBody, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", url, bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", supabaseKey)

	client := getPinnedClient()
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("network error: %v", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&result)

	if resp.StatusCode >= 400 {
		msg, _ := result["error_description"].(string)
		return fmt.Errorf("refresh failed: %s", msg)
	}

	accessToken, _ := result["access_token"].(string)
	refreshToken, _ := result["refresh_token"].(string)
	expiresIn, _ := result["expires_in"].(float64)

	currentSessionLock.Lock()
	if currentSession != nil {
		currentSession.AccessToken = accessToken
		if refreshToken != "" {
			currentSession.RefreshToken = refreshToken
		}
		currentSession.ExpiresAt = time.Now().Unix() + int64(expiresIn)
	}
	currentSessionLock.Unlock()

	s.saveSessionToCache()
	return nil
}

func (s *cloudService) GetCurrentUser() *domain.UserSession {
	if !s.IsLoggedIn() {
		return nil
	}
	currentSessionLock.RLock()
	defer currentSessionLock.RUnlock()
	return currentSession
}

func (s *cloudService) GetLocalSession() *domain.UserSession {
	s.loadSessionFromCache()
	currentSessionLock.RLock()
	defer currentSessionLock.RUnlock()
	return currentSession
}

func (s *cloudService) CheckSessionValidity() *domain.SessionValidityResult {
	session := s.GetLocalSession()
	if session == nil {
		return &domain.SessionValidityResult{Valid: false, Message: "غير مسجل"}
	}

	err := s.verifySessionLock()
	if err != nil {
		return &domain.SessionValidityResult{Valid: false, Message: err.Error()}
	}

	return &domain.SessionValidityResult{Valid: true, Message: "الجلسة صالحة"}
}

func (s *cloudService) Register(email, password, storeName string) (*domain.SupabaseAuthResult, error) {
	email = strings.TrimSpace(email)
	password = strings.TrimSpace(password)
	storeName = strings.TrimSpace(storeName)

	if email == "" || password == "" {
		return &domain.SupabaseAuthResult{Success: false, Message: "البريد الإلكتروني وكلمة المرور مطلوبان"}, nil
	}

	if len(password) < 6 {
		return &domain.SupabaseAuthResult{Success: false, Message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل"}, nil
	}

	url := supabaseURL + "/auth/v1/signup"
	body := map[string]interface{}{
		"email":    email,
		"password": password,
		"data": map[string]interface{}{
			"store_name": storeName,
		},
	}
	jsonBody, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", url, bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", supabaseKey)

	client := getPinnedClient()
	resp, err := client.Do(req)
	if err != nil {
		return &domain.SupabaseAuthResult{Success: false, Message: "فشل الاتصال بالسيرفر"}, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&result)

	if resp.StatusCode >= 400 {
		msg, _ := result["msg"].(string)
		if msg == "" {
			msg, _ = result["message"].(string)
		}
		if strings.Contains(msg, "already registered") {
			return &domain.SupabaseAuthResult{Success: false, Message: "هذا البريد الإلكتروني مسجل مسبقاً"}, nil
		}
		return &domain.SupabaseAuthResult{Success: false, Message: "فشل إنشاء الحساب: " + msg}, nil
	}

	user, ok := result["user"].(map[string]interface{})
	if !ok {
		if identities, hasIdentities := result["identities"]; hasIdentities {
			_ = identities
			return &domain.SupabaseAuthResult{Success: false, Message: "يرجى تأكيد بريدك الإلكتروني أولاً"}, nil
		}
		responseBytes, _ := json.Marshal(result)
		return &domain.SupabaseAuthResult{Success: false, Message: fmt.Sprintf("استجابة غير متوقعة: %s", string(responseBytes))}, nil
	}

	accessToken, _ := result["access_token"].(string)
	refreshToken, _ := result["refresh_token"].(string)
	expiresIn, _ := result["expires_in"].(float64)
	userID := user["id"].(string)

	sessionToken, err := s.lockSession(userID, accessToken, storeName)
	if err != nil {
		return &domain.SupabaseAuthResult{Success: false, Message: "فشل تأمين الجلسة: " + err.Error()}, nil
	}

	session := domain.UserSession{
		UserID:       userID,
		Email:        email,
		StoreName:    storeName,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		SessionToken: sessionToken,
		ExpiresAt:    time.Now().Unix() + int64(expiresIn),
	}

	currentSessionLock.Lock()
	currentSession = &session
	currentSessionLock.Unlock()
	s.saveSessionToCache()

	// Link cloud identity in repository
	if s.staffRepo != nil {
		s.linkCloudIdentity(userID)
	}

	return &domain.SupabaseAuthResult{
		Success: true,
		Message: "تم إنشاء الحساب بنجاح!",
		User:    session,
	}, nil
}

func (s *cloudService) Login(email, password string) (*domain.SupabaseAuthResult, error) {
	email = strings.TrimSpace(email)
	password = strings.TrimSpace(password)

	if email == "" || password == "" {
		return &domain.SupabaseAuthResult{Success: false, Message: "البريد الإلكتروني وكلمة المرور مطلوبان"}, nil
	}

	url := supabaseURL + "/auth/v1/token?grant_type=password"
	body := map[string]interface{}{
		"email":    email,
		"password": password,
	}
	jsonBody, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", url, bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", supabaseKey)

	client := getPinnedClient()
	resp, err := client.Do(req)
	if err != nil {
		return &domain.SupabaseAuthResult{Success: false, Message: "فشل الاتصال بالسيرفر"}, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&result)

	if resp.StatusCode >= 400 {
		errMsg, _ := result["error_description"].(string)
		if errMsg == "" {
			errMsg, _ = result["msg"].(string)
		}
		if strings.Contains(errMsg, "Invalid login") {
			return &domain.SupabaseAuthResult{Success: false, Message: "البريد الإلكتروني أو كلمة المرور غير صحيحة"}, nil
		}
		return &domain.SupabaseAuthResult{Success: false, Message: "فشل تسجيل الدخول: " + errMsg}, nil
	}

	user, ok := result["user"].(map[string]interface{})
	if !ok {
		return &domain.SupabaseAuthResult{Success: false, Message: "استجابة غير متوقعة"}, nil
	}

	accessToken, _ := result["access_token"].(string)
	expiresIn, _ := result["expires_in"].(float64)
	userID := user["id"].(string)

	storeName := ""
	backupLimit := MaxBackupSizeMB
	maxBackups := MaxBackupsPerUser
	features := domain.UserFeatures{
		EnableAI:       false,
		EnableLAN:      false,
		EnableWhatsApp: false,
	}

	if meta, ok := user["user_metadata"].(map[string]interface{}); ok {
		if val, exists := meta["store_name"].(string); exists {
			storeName = val
		}
		if val, exists := meta["backup_limit_mb"].(float64); exists {
			backupLimit = int(val)
		}
		if val, exists := meta["max_backups"].(float64); exists {
			maxBackups = int(val)
		}
		if val, exists := meta["enable_ai"].(bool); exists {
			features.EnableAI = val
		}
		if val, exists := meta["enable_lan"].(bool); exists {
			features.EnableLAN = val
		}
		if val, exists := meta["enable_whatsapp"].(bool); exists {
			features.EnableWhatsApp = val
		}
	}

	sessionToken, err := s.lockSession(userID, accessToken, storeName)
	if err != nil {
		return &domain.SupabaseAuthResult{Success: false, Message: "فشل تأمين الجلسة: " + err.Error()}, nil
	}

	refreshToken, _ := result["refresh_token"].(string)

	session := domain.UserSession{
		UserID:        userID,
		Email:         email,
		StoreName:     storeName,
		AccessToken:   accessToken,
		RefreshToken:  refreshToken,
		SessionToken:  sessionToken,
		ExpiresAt:     time.Now().Unix() + int64(expiresIn),
		BackupLimitMB: backupLimit,
		MaxBackups:    maxBackups,
		Features:      features,
	}

	currentSessionLock.Lock()
	currentSession = &session
	currentSessionLock.Unlock()
	s.saveSessionToCache()

	if s.staffRepo != nil {
		s.linkCloudIdentity(userID)
	}

	return &domain.SupabaseAuthResult{
		Success: true,
		Message: "تم تسجيل الدخول بنجاح!",
		User:    session,
	}, nil
}

func (s *cloudService) linkCloudIdentity(userID string) {
	if s.staffRepo == nil {
		return
	}
	staff, err := s.staffRepo.GetAll()
	if err == nil {
		for _, member := range staff {
			if member.Role == "admin" && member.SupabaseUserID == "" {
				_ = s.staffRepo.Updates(member.ID, map[string]interface{}{"supabase_user_id": userID})
				break
			}
		}
	}
}

func (s *cloudService) SyncSessionFeatures() {
	session := s.GetLocalSession()
	if session == nil {
		return
	}

	fmt.Println("🔄 Silent Sync: Checking for feature updates...")

	url := supabaseURL + "/auth/v1/user"
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+session.AccessToken)
	req.Header.Set("apikey", supabaseKey)

	client := getPinnedClient()
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("⚠️ Silent Sync: Network error (Offline mode kept): %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fmt.Printf("⚠️ Silent Sync: Server returned %d\n", resp.StatusCode)
		return
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return
	}

	if meta, ok := result["user_metadata"].(map[string]interface{}); ok {
		updated := false

		currentSessionLock.Lock()
		if currentSession != nil {
			if val, exists := meta["backup_limit_mb"].(float64); exists && int(val) != currentSession.BackupLimitMB {
				currentSession.BackupLimitMB = int(val)
				updated = true
			}
			if val, exists := meta["max_backups"].(float64); exists && int(val) != currentSession.MaxBackups {
				currentSession.MaxBackups = int(val)
				updated = true
			}
			if val, exists := meta["enable_ai"].(bool); exists && val != currentSession.Features.EnableAI {
				currentSession.Features.EnableAI = val
				updated = true
			}
			if val, exists := meta["enable_lan"].(bool); exists && val != currentSession.Features.EnableLAN {
				currentSession.Features.EnableLAN = val
				updated = true
			}
			if val, exists := meta["enable_whatsapp"].(bool); exists && val != currentSession.Features.EnableWhatsApp {
				currentSession.Features.EnableWhatsApp = val
				updated = true
			}
		}
		currentSessionLock.Unlock()

		if updated {
			fmt.Println("✅ Silent Sync: User features updated from server")
			s.saveSessionToCache()
		} else {
			fmt.Println("✨ Silent Sync: No changes detected")
		}
	}
}

func (s *cloudService) Logout() {
	s.clearSessionCache()
}

func (s *cloudService) RecoverPassword(email string) (*domain.SupabaseAuthResult, error) {
	email = strings.TrimSpace(email)
	if email == "" {
		return &domain.SupabaseAuthResult{Success: false, Message: "البريد الإلكتروني مطلوب"}, nil
	}

	url := supabaseURL + "/auth/v1/recover"
	body := map[string]interface{}{
		"email": email,
	}
	jsonBody, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", url, bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", supabaseKey)

	client := getPinnedClient()
	resp, err := client.Do(req)
	if err != nil {
		return &domain.SupabaseAuthResult{Success: false, Message: "فشل الاتصال بالسيرفر"}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var result map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&result)

		msg, _ := result["msg"].(string)
		if msg == "" {
			msg, _ = result["message"].(string)
		}
		if msg == "" {
			msg = "حدث خطأ أثناء محاولة استعادة كلمة المرور"
		}
		return &domain.SupabaseAuthResult{Success: false, Message: msg}, nil
	}

	return &domain.SupabaseAuthResult{Success: true, Message: "تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني"}, nil
}

func (s *cloudService) DeleteCurrentUser() error {
	session := s.GetLocalSession()
	if session == nil {
		return fmt.Errorf("يجب تسجيل الدخول أولاً")
	}

	url := functionsURL + "/delete-account"
	req, _ := http.NewRequest("POST", url, nil)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+session.AccessToken)

	client := getPinnedClient()
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("server returned status: %d", resp.StatusCode)
	}

	s.Logout()
	return nil
}

func (s *cloudService) generateSessionToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *cloudService) lockSession(userID, accessToken, deviceName string) (string, error) {
	if deviceName == "" {
		deviceName = "Unknown Device"
	}
	newToken := s.generateSessionToken()

	url := fmt.Sprintf("%s/rest/v1/active_sessions", supabaseURL)
	body := map[string]string{
		"user_id":       userID,
		"session_token": newToken,
		"device_name":   deviceName,
		"last_seen":     time.Now().UTC().Format(time.RFC3339),
	}

	jsonBody, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", url, bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("apikey", supabaseKey)
	req.Header.Set("Prefer", "resolution=merge-duplicates")

	client := getPinnedClient()
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("server error %d", resp.StatusCode)
	}

	return newToken, nil
}

func (s *cloudService) verifySessionLock() error {
	session := s.GetLocalSession()
	if session == nil {
		return fmt.Errorf("not logged in")
	}

	url := fmt.Sprintf("%s/rest/v1/active_sessions?user_id=eq.%s&select=session_token", supabaseURL, session.UserID)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+session.AccessToken)
	req.Header.Set("apikey", supabaseKey)

	client := getPinnedClient()
	resp, err := client.Do(req)
	if err != nil {
		return nil // Allow offline mode to bypass check in case of connection errors
	}
	defer resp.Body.Close()

	var results []map[string]string
	_ = json.NewDecoder(resp.Body).Decode(&results)

	if len(results) == 0 {
		s.Logout()
		return fmt.Errorf("الجلسة غير صحيحة، يرجى تسجيل الدخول مرة أخرى")
	}

	remoteToken := results[0]["session_token"]
	if remoteToken != session.SessionToken {
		s.Logout()
		return fmt.Errorf("تم تسجيل الدخول من جهاز آخر. تم إنهاء الجلسة هنا.")
	}

	return nil
}

func (s *cloudService) CloudBackupNow() error {
	if !s.IsLoggedIn() {
		return fmt.Errorf("يجب تسجيل الدخول أولاً")
	}

	if err := s.verifySessionLock(); err != nil {
		return err
	}

	session := s.GetLocalSession()

	limitCount := MaxBackupsPerUser
	if session.MaxBackups > 0 {
		limitCount = session.MaxBackups
	}

	backups, err := s.ListCloudBackupsForUser()
	if err == nil && len(backups) >= limitCount {
		if len(backups) > 0 {
			oldest := backups[len(backups)-1]
			_ = s.DeleteCloudBackup(oldest.ID)
		}
	}

	compressed, err := compressDatabaseForBackup()
	if err != nil {
		return fmt.Errorf("فشل ضغط قاعدة البيانات: %v", err)
	}

	limitMB := MaxBackupSizeMB
	if session.BackupLimitMB > 0 {
		limitMB = session.BackupLimitMB
	}

	sizeMB := float64(len(compressed)) / (1024 * 1024)
	if sizeMB > float64(limitMB) {
		return fmt.Errorf("حجم النسخة تجاوز الحد المسموح (%d ميجابايت). يرجى التواصل مع الإدارة لتمديد الاشتراك", limitMB)
	}

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	backupID := fmt.Sprintf("%s_%s", session.UserID[:8], timestamp)
	encoded := base64.StdEncoding.EncodeToString(compressed)
	chunks := splitStringIntoChunks(encoded, MaxChunkSize)

	client := getPinnedClient()

	// Upload chunks 1..N-1 first, and chunk 0 last as a commit marker.
	// This prevents incomplete backups from being listed (since listing filters by chunk_index=0).
	uploadOrder := make([]int, len(chunks))
	if len(chunks) > 1 {
		idx := 0
		for i := 1; i < len(chunks); i++ {
			uploadOrder[idx] = i
			idx++
		}
		uploadOrder[idx] = 0
	} else {
		uploadOrder[0] = 0
	}

	for _, i := range uploadOrder {
		chunk := chunks[i]
		chunkID := fmt.Sprintf("%s_chunk_%d", backupID, i)
		url := fmt.Sprintf("%s/rest/v1/user_backups", supabaseURL)

		doc := map[string]interface{}{
			"id":           chunkID,
			"backup_id":    backupID,
			"user_id":      session.UserID,
			"store_name":   session.StoreName,
			"chunk_index":  i,
			"total_chunks": len(chunks),
			"total_size":   len(compressed),
			"data":         chunk,
		}

		jsonData, _ := json.Marshal(doc)
		req, _ := http.NewRequest("POST", url, bytes.NewReader(jsonData))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+session.AccessToken)
		req.Header.Set("apikey", supabaseKey)

		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("فشل رفع الجزء %d: %v", i+1, err)
		}
		resp.Body.Close()

		if resp.StatusCode >= 400 {
			return fmt.Errorf("فشل رفع الجزء %d (HTTP %d)", i+1, resp.StatusCode)
		}
	}

	return nil
}

func (s *cloudService) ListCloudBackupsForUser() ([]domain.CloudBackup, error) {
	if !s.IsLoggedIn() {
		return nil, fmt.Errorf("يجب تسجيل الدخول أولاً")
	}

	if err := s.verifySessionLock(); err != nil {
		return nil, err
	}

	session := s.GetLocalSession()

	url := fmt.Sprintf("%s/rest/v1/user_backups?user_id=eq.%s&chunk_index=eq.0&order=created_at.desc",
		supabaseURL, session.UserID)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+session.AccessToken)
	req.Header.Set("apikey", supabaseKey)

	client := getPinnedClient()
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		s.Logout()
		return nil, fmt.Errorf("انتهت صلاحية الجلسة")
	}

	var results []map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&results)

	var backups []domain.CloudBackup
	for _, r := range results {
		backup := domain.CloudBackup{
			ID:        getString(r, "backup_id"),
			UserID:    getString(r, "user_id"),
			StoreName: getString(r, "store_name"),
			SizeBytes: getInt64(r, "total_size"),
			Chunks:    int(getInt64(r, "total_chunks")),
			CreatedAt: getString(r, "created_at"),
		}
		backups = append(backups, backup)
	}

	return backups, nil
}

func (s *cloudService) DeleteCloudBackup(backupID string) error {
	if !s.IsLoggedIn() {
		return fmt.Errorf("يجب تسجيل الدخول أولاً")
	}

	if err := s.verifySessionLock(); err != nil {
		return err
	}

	session := s.GetLocalSession()

	url := fmt.Sprintf("%s/rest/v1/user_backups?backup_id=eq.%s&user_id=eq.%s",
		supabaseURL, backupID, session.UserID)

	req, _ := http.NewRequest("DELETE", url, nil)
	req.Header.Set("Authorization", "Bearer "+session.AccessToken)
	req.Header.Set("apikey", supabaseKey)

	client := getPinnedClient()
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()

	return nil
}

func (s *cloudService) RestoreCloudBackup(backupID string) error {
	if !s.IsLoggedIn() {
		return fmt.Errorf("يجب تسجيل الدخول أولاً")
	}

	if err := s.verifySessionLock(); err != nil {
		return err
	}

	session := s.GetLocalSession()

	url := fmt.Sprintf("%s/rest/v1/user_backups?backup_id=eq.%s&user_id=eq.%s&order=chunk_index.asc",
		supabaseURL, backupID, session.UserID)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+session.AccessToken)
	req.Header.Set("apikey", supabaseKey)

	client := getPinnedClient()
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var chunks []map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&chunks)

	if len(chunks) == 0 {
		return fmt.Errorf("النسخة الاحتياطية غير موجودة")
	}

	var encodedData strings.Builder
	for _, chunk := range chunks {
		data, _ := chunk["data"].(string)
		encodedData.WriteString(data)
	}

	compressed, err := base64.StdEncoding.DecodeString(encodedData.String())
	if err != nil {
		return fmt.Errorf("فشل فك التشفير: %v", err)
	}

	return restoreFromCompressed(compressed)
}

func splitStringIntoChunks(s string, chunkSize int) []string {
	var chunks []string
	for len(s) > 0 {
		if len(s) < chunkSize {
			chunks = append(chunks, s)
			break
		}
		chunks = append(chunks, s[:chunkSize])
		s = s[chunkSize:]
	}
	return chunks
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getInt64(m map[string]interface{}, key string) int64 {
	if v, ok := m[key].(float64); ok {
		return int64(v)
	}
	return 0
}
