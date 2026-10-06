package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
)

// isolateConfigDir redirects the user config directory into a per-test temp
// folder so license caches, session caches and integration config never touch
// the developer's real profile.
func isolateConfigDir(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	if runtime.GOOS == "windows" {
		t.Setenv("AppData", dir)
	}
	t.Setenv("XDG_CONFIG_HOME", dir)
}

// mutableResponse is a race-free scripted HTTP response: the test changes the
// payload between requests while the server goroutine serves them.
type mutableResponse struct {
	mu     sync.Mutex
	body   string
	status int
}

func (m *mutableResponse) set(body string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.body = body
	m.status = http.StatusOK
}

// setRaw serves an arbitrary body with an explicit HTTP status.
func (m *mutableResponse) setRaw(body string, status int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.body = body
	m.status = status
}

func (m *mutableResponse) fail() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.body = "<html>bad gateway</html>"
	m.status = http.StatusBadGateway
}

func (m *mutableResponse) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	m.mu.Lock()
	body, status := m.body, m.status
	m.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	if status != 0 && status != http.StatusOK {
		w.WriteHeader(status)
	}
	_, _ = w.Write([]byte(body))
}

// pointSupabaseAt redirects the Supabase REST endpoints to a local test server
// and restores the previous values when the test ends.
func pointSupabaseAt(t *testing.T, serverURL string) {
	t.Helper()
	prevURL, prevKey, prevFuncs := supabaseURL, supabaseKey, functionsURL
	supabaseURL = serverURL
	supabaseKey = "test-anon-key"
	functionsURL = serverURL + "/functions/v1"
	t.Cleanup(func() {
		supabaseURL, supabaseKey, functionsURL = prevURL, prevKey, prevFuncs
	})
}

// setLocalSession installs an unexpired in-memory session so the licensed paths
// can resolve the current user without touching the network.
func setLocalSession(t *testing.T, userID string) {
	t.Helper()
	prev := currentSession
	currentSession = &domain.UserSession{
		UserID:    userID,
		Email:     "owner@example.com",
		StoreName: "متجر الاختبار",
		ExpiresAt: time.Now().Add(time.Hour).Unix(),
	}
	t.Cleanup(func() { currentSession = prev })
}

func clearLocalSession(t *testing.T) {
	t.Helper()
	prev := currentSession
	currentSession = nil
	t.Cleanup(func() { currentSession = prev })
}

// writeLicenseCache writes a correctly checksummed cache entry straight to the
// device cache path, mimicking what a previous run of the app would leave.
func writeLicenseCache(t *testing.T, s *cloudService, cache licenseCache) {
	t.Helper()
	payload := cache
	payload.Checksum = ""
	checksumData, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal cache payload: %v", err)
	}
	cache.Checksum = s.computeChecksum(checksumData)

	finalData, err := json.Marshal(cache)
	if err != nil {
		t.Fatalf("marshal cache: %v", err)
	}
	encrypted, err := s.encrypt(finalData)
	if err != nil {
		t.Fatalf("encrypt cache: %v", err)
	}
	if err := os.WriteFile(getCacheFilePath(), encrypted, 0600); err != nil {
		t.Fatalf("write cache: %v", err)
	}
}

func licensedResult(expiresAt string) *domain.LicenseResult {
	return &domain.LicenseResult{
		Licensed:      true,
		Success:       true,
		Message:       "ترخيص ساري",
		CustomerName:  "عميل",
		CustomerPhone: "07700000000",
		StoreName:     "متجر",
		Features:      map[string]bool{"ai_features": true},
		ExpiresAt:     expiresAt,
	}
}

func TestLicenseGuardClauses(t *testing.T) {
	isolateConfigDir(t)
	service, _, cleanup := setupTestIntegration(t)
	defer cleanup()
	s := service.(*cloudService)
	clearLocalSession(t)

	// Empty keys are rejected before any session or network work happens.
	res, err := s.VerifyLicense("   ")
	if err != nil || res == nil || res.Licensed {
		t.Fatalf("VerifyLicense(blank) = %+v, %v", res, err)
	}
	if res.Message == "" {
		t.Fatal("VerifyLicense must explain why the key was rejected")
	}

	res, err = s.ActivateLicense("")
	if err != nil || res == nil || res.Licensed {
		t.Fatalf("ActivateLicense(blank) = %+v, %v", res, err)
	}

	// Without a signed-in user the license cannot be bound to an account.
	res, err = s.VerifyLicense("KEY-1")
	if err != nil || res == nil || res.Licensed {
		t.Fatalf("VerifyLicense without a session = %+v, %v", res, err)
	}
	res, err = s.ActivateLicense("KEY-1")
	if err != nil || res == nil || res.Licensed {
		t.Fatalf("ActivateLicense without a session = %+v, %v", res, err)
	}
	res, err = s.GetCachedLicense()
	if err != nil || res == nil || res.Licensed {
		t.Fatalf("GetCachedLicense without a stored key = %+v, %v", res, err)
	}
	res, err = s.GetUserLicenseStatus()
	if err != nil || res == nil || res.Licensed {
		t.Fatalf("GetUserLicenseStatus without a session = %+v, %v", res, err)
	}
}

func TestStoredLicenseKeyRoundTrip(t *testing.T) {
	isolateConfigDir(t)
	service, _, cleanup := setupTestIntegration(t)
	defer cleanup()
	s := service.(*cloudService)

	if got := s.GetStoredLicenseKey(); got != "" {
		t.Fatalf("expected no stored key initially, got %q", got)
	}

	s.storeLicenseKey("BEIDAR-ABCD-1234")
	if got := s.GetStoredLicenseKey(); got != "BEIDAR-ABCD-1234" {
		t.Fatalf("stored key round trip failed: %q", got)
	}

	// The key file must never hold the plaintext key.
	raw, err := os.ReadFile(getStoredLicenseKeyPath())
	if err != nil {
		t.Fatalf("read stored key file: %v", err)
	}
	if strings.Contains(string(raw), "BEIDAR-ABCD-1234") {
		t.Fatal("stored license key must be encrypted at rest")
	}

	// Corrupted files must fail closed instead of leaking garbage.
	if err := os.WriteFile(getStoredLicenseKeyPath(), []byte("not-really-encrypted"), 0600); err != nil {
		t.Fatalf("write corrupt key file: %v", err)
	}
	if got := s.GetStoredLicenseKey(); got != "" {
		t.Fatalf("a corrupt key file must yield an empty key, got %q", got)
	}

	s.ClearLicenseCache()
	if got := s.GetStoredLicenseKey(); got != "" {
		t.Fatalf("ClearLicenseCache must drop the stored key, got %q", got)
	}
	if _, statErr := os.Stat(getCacheFilePath()); !os.IsNotExist(statErr) {
		t.Fatalf("ClearLicenseCache must drop the cache file, stat err = %v", statErr)
	}
}

func TestGetCachedLicenseRejectsBadCaches(t *testing.T) {
	isolateConfigDir(t)
	service, _, cleanup := setupTestIntegration(t)
	defer cleanup()
	s := service.(*cloudService)

	const key = "KEY-1"
	const user = "user-1"
	future := time.Now().AddDate(0, 1, 0).Format(time.RFC3339)
	base := func() licenseCache {
		return licenseCache{
			LicenseKey:     key,
			UserID:         user,
			Result:         *licensedResult(future),
			CachedAt:       time.Now().Unix(),
			LastServerTime: 0,
		}
	}

	cases := []struct {
		name    string
		mutate  func(c *licenseCache)
		wantErr string
	}{
		{"expired-license", func(c *licenseCache) {
			c.Result.ExpiresAt = time.Now().Add(-time.Hour).Format(time.RFC3339)
		}, "license expired"},
		{"unparseable-expiry-is-not-expired", func(c *licenseCache) {
			c.Result.ExpiresAt = "not-a-date"
		}, ""},
		{"stale-cache", func(c *licenseCache) {
			c.CachedAt = time.Now().Add(-31 * 24 * time.Hour).Unix()
		}, "cache expired"},
		{"clock-rollback", func(c *licenseCache) {
			c.CachedAt = time.Now().Add(10 * time.Minute).Unix()
		}, "time tampered"},
		{"server-time-ahead", func(c *licenseCache) {
			c.LastServerTime = time.Now().Add(time.Hour).Unix()
		}, "time tampered"},
		{"user-mismatch", func(c *licenseCache) {
			c.UserID = "someone-else"
		}, "user mismatch"},
		{"key-mismatch", func(c *licenseCache) {
			c.LicenseKey = "OTHER-KEY"
		}, "license key mismatch"},
		{"valid", func(c *licenseCache) {}, ""},
		{"valid-past-grace", func(c *licenseCache) {
			// Older than the grace period: still valid, but with a warning.
			c.CachedAt = time.Now().Add(-8 * 24 * time.Hour).Unix()
		}, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cache := base()
			tc.mutate(&cache)
			writeLicenseCache(t, s, cache)

			got, err := s.getCachedLicense(key, user)
			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("expected a valid cache, got %v", err)
				}
				if got == nil || !got.Licensed {
					t.Fatalf("expected a licensed result, got %+v", got)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("expected error %q, got %v", tc.wantErr, err)
			}
		})
	}

	// A cache written with no license key at all must still resolve.
	cache := base()
	cache.LicenseKey = ""
	writeLicenseCache(t, s, cache)
	if _, err := s.getCachedLicense("", user); err != nil {
		t.Fatalf("an unbound cache must resolve: %v", err)
	}

	// Corrupted ciphertext must be reported, never trusted.
	if err := os.WriteFile(getCacheFilePath(), []byte("garbage"), 0600); err != nil {
		t.Fatalf("write corrupt cache: %v", err)
	}
	if _, err := s.getCachedLicense(key, user); err == nil {
		t.Fatal("a corrupt cache must be rejected")
	}
}

func TestVerifyLicenseOnlinePaths(t *testing.T) {
	isolateConfigDir(t)
	service, _, cleanup := setupTestIntegration(t)
	defer cleanup()
	s := service.(*cloudService)

	script := &mutableResponse{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/verify_license") {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-anon-key" {
			t.Errorf("missing bearer key: %q", got)
		}
		script.ServeHTTP(w, r)
	}))
	defer server.Close()
	pointSupabaseAt(t, server.URL)
	setLocalSession(t, "user-1")

	// 1. Licensed online: cached for offline use.
	script.set(`{"licensed":true,"success":true,"customerName":"عميل","expiresAt":"` +
		time.Now().AddDate(0, 1, 0).Format(time.RFC3339) + `"}`)
	res, err := s.VerifyLicense("key-1")
	if err != nil || res == nil || !res.Licensed {
		t.Fatalf("VerifyLicense online = %+v, %v", res, err)
	}
	if _, statErr := os.Stat(getCacheFilePath()); statErr != nil {
		t.Fatalf("a licensed verification must be cached: %v", statErr)
	}
	cached, err := s.getCachedLicense("KEY-1", "user-1")
	if err != nil || cached == nil || !cached.Licensed {
		t.Fatalf("cache written by verification must be readable: %+v, %v", cached, err)
	}

	// 2. Denied online: the denial is cached too, so the app cannot fall back to
	//    a previous grant after a revocation.
	script.set(`{"licensed":false,"success":false,"message":"تم إلغاء الترخيص"}`)
	res, err = s.VerifyLicense("key-1")
	if err != nil || res == nil || res.Licensed {
		t.Fatalf("VerifyLicense revoked = %+v, %v", res, err)
	}

	// 3. A broken server body degrades to the offline cache instead of failing.
	script.set("not json")
	if _, err := s.VerifyLicense("key-1"); err != nil {
		t.Fatalf("VerifyLicense must not fail hard when the server is broken: %v", err)
	}
}

func TestVerifyLicenseOfflineUsesCache(t *testing.T) {
	isolateConfigDir(t)
	service, _, cleanup := setupTestIntegration(t)
	defer cleanup()
	s := service.(*cloudService)

	script := &mutableResponse{}
	script.fail()
	server := httptest.NewServer(script)
	defer server.Close()
	pointSupabaseAt(t, server.URL)
	setLocalSession(t, "user-1")

	future := time.Now().AddDate(0, 1, 0).Format(time.RFC3339)

	// Without any cache the caller gets a clear failure, not a panic or a nil.
	res, err := s.VerifyLicense("KEY-1")
	if err != nil || res == nil || res.Licensed {
		t.Fatalf("VerifyLicense with no cache = %+v, %v", res, err)
	}

	// With a valid cached grant the offline window keeps the app working.
	if err := s.cacheResult("KEY-1", "user-1", licensedResult(future)); err != nil {
		t.Fatalf("seed cache: %v", err)
	}
	res, err = s.VerifyLicense("KEY-1")
	if err != nil || res == nil || !res.Licensed {
		t.Fatalf("VerifyLicense offline fallback = %+v, %v", res, err)
	}
	if !strings.Contains(res.Message, "عدم الاتصال") {
		t.Fatalf("offline verification must announce itself, got %q", res.Message)
	}
}

func TestActivateLicenseStoresKeyAndCache(t *testing.T) {
	isolateConfigDir(t)
	service, _, cleanup := setupTestIntegration(t)
	defer cleanup()
	s := service.(*cloudService)

	script := &mutableResponse{}
	script.set(`{"licensed":true,"success":true,"customerName":"عميل","expiresAt":"` +
		time.Now().AddDate(0, 1, 0).Format(time.RFC3339) + `"}`)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/activate_license") {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		script.ServeHTTP(w, r)
	}))
	defer server.Close()
	pointSupabaseAt(t, server.URL)
	setLocalSession(t, "user-1")

	res, err := s.ActivateLicense("  key-9  ")
	if err != nil || res == nil || !res.Licensed {
		t.Fatalf("ActivateLicense = %+v, %v", res, err)
	}
	if got := s.GetStoredLicenseKey(); got != "KEY-9" {
		t.Fatalf("activation must persist the normalised key, got %q", got)
	}

	cached, err := s.GetCachedLicense()
	if err != nil || cached == nil || !cached.Licensed {
		t.Fatalf("GetCachedLicense after activation = %+v, %v", cached, err)
	}

	// A denial must not persist the key.
	script.set(`{"licensed":false,"success":false,"message":"مفتاح غير صالح"}`)
	s.ClearLicenseCache()
	if res, err := s.ActivateLicense("BAD-KEY"); err != nil || res == nil || res.Licensed {
		t.Fatalf("ActivateLicense denial = %+v, %v", res, err)
	}
	if got := s.GetStoredLicenseKey(); got != "" {
		t.Fatalf("a rejected key must not be stored, got %q", got)
	}
}

func TestActivateLicenseNetworkFailure(t *testing.T) {
	isolateConfigDir(t)
	service, _, cleanup := setupTestIntegration(t)
	defer cleanup()
	s := service.(*cloudService)

	script := &mutableResponse{}
	script.fail()
	server := httptest.NewServer(script)
	defer server.Close()
	pointSupabaseAt(t, server.URL)
	setLocalSession(t, "user-1")

	res, err := s.ActivateLicense("KEY-1")
	if err == nil {
		t.Fatal("a broken activation endpoint must surface an error")
	}
	if res == nil || res.Licensed {
		t.Fatalf("activation must fail closed, got %+v", res)
	}
	if got := s.GetStoredLicenseKey(); got != "" {
		t.Fatalf("nothing may be stored on a failed activation, got %q", got)
	}
}

func TestGetUserLicenseStatusOnlineAndOffline(t *testing.T) {
	isolateConfigDir(t)
	service, _, cleanup := setupTestIntegration(t)
	defer cleanup()
	s := service.(*cloudService)

	future := time.Now().AddDate(0, 1, 0).Format(time.RFC3339)
	script := &mutableResponse{}
	server := httptest.NewServer(script)
	defer server.Close()
	pointSupabaseAt(t, server.URL)
	setLocalSession(t, "user-42")

	// Licensed through the admin dashboard: no key was ever activated on this
	// device, so the offline cache is matched with a synthetic user key.
	script.set(`{"licensed":true,"success":true,"expiresAt":"` + future + `"}`)
	res, err := s.GetUserLicenseStatus()
	if err != nil || res == nil || !res.Licensed {
		t.Fatalf("GetUserLicenseStatus online = %+v, %v", res, err)
	}

	script.fail()
	res, err = s.GetUserLicenseStatus()
	if err != nil || res == nil || !res.Licensed {
		t.Fatalf("GetUserLicenseStatus offline must reuse the cache = %+v, %v", res, err)
	}
	if !strings.Contains(res.Message, "عدم الاتصال") {
		t.Fatalf("offline status must announce itself, got %q", res.Message)
	}

	// An unlicensed answer online must wipe the cached grant.
	script.set(`{"licensed":false,"success":false,"message":"لا يوجد ترخيص"}`)
	res, err = s.GetUserLicenseStatus()
	if err != nil || res == nil || res.Licensed {
		t.Fatalf("GetUserLicenseStatus unlicensed = %+v, %v", res, err)
	}
	if _, statErr := os.Stat(getCacheFilePath()); !os.IsNotExist(statErr) {
		t.Fatalf("an unlicensed answer must clear the cache, stat err = %v", statErr)
	}

	// Offline again with nothing left to fall back on: a clear message, no panic.
	script.fail()
	if res, err := s.GetUserLicenseStatus(); err != nil || res == nil || res.Licensed {
		t.Fatalf("GetUserLicenseStatus without any license = %+v, %v", res, err)
	}
}
