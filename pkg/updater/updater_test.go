//go:build windows

package updater

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func setConfig(t *testing.T, fn func(*UpdateConfig)) {
	t.Helper()
	configMutex.Lock()
	fn(&updateConfig)
	configMutex.Unlock()
}

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"1.0.0", "2.0.0", -1},
		{"2.0.0", "1.9.9", 1},
		{"1.2.3", "1.2.3", 0},
		{"v1.2.3", "1.2.3", 0},
		{"1.0", "1.0.0", 0},
		{"1.10.0", "1.9.0", 1},
	}
	for _, c := range cases {
		if got := compareVersions(c.a, c.b); got != c.want {
			t.Errorf("compareVersions(%q, %q) = %d, want %d", c.a, c.b, got, c.want)
		}
	}
}

func TestFormatBytes(t *testing.T) {
	cases := []struct {
		in   int64
		want string
	}{
		{512, "512 B"},
		{1024, "1.0 KB"},
		{5 * 1024 * 1024, "5.0 MB"},
		{0, "0 B"},
	}
	for _, c := range cases {
		if got := formatBytes(c.in); got != c.want {
			t.Errorf("formatBytes(%d) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestFormatDuration(t *testing.T) {
	if got := formatDuration(30 * time.Second); !strings.Contains(got, "ثانية") {
		t.Errorf("formatDuration under a minute should use seconds, got %q", got)
	}
	if got := formatDuration(2 * time.Minute); !strings.Contains(got, "دقيقة") {
		t.Errorf("formatDuration over a minute should use minutes, got %q", got)
	}
}

func TestCalculateSHA256(t *testing.T) {
	dir := t.TempDir()
	path := dir + "\\file.bin"
	content := []byte("hello beidar")
	if err := os.WriteFile(path, content, 0644); err != nil {
		t.Fatalf("write temp file: %v", err)
	}

	sum := sha256.Sum256(content)
	want := hex.EncodeToString(sum[:])

	got, err := calculateSHA256(path)
	if err != nil {
		t.Fatalf("calculateSHA256: %v", err)
	}
	if got != want {
		t.Errorf("sha256 = %q, want %q", got, want)
	}
}

func TestParseReleasePrefersInstaller(t *testing.T) {
	CurrentVersion = "1.0.0"
	updateStatus = UpdateStatus{}
	setConfig(t, func(c *UpdateConfig) {
		c.SkippedVersion = ""
		c.AllowPrerelease = false
	})

	release := GitHubRelease{
		TagName: "v1.2.3",
		Body: "Release notes\n" +
			"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef beidar-installer.exe\n",
		Assets: []GitHubAsset{
			{Name: "beidar.exe", Size: 500, BrowserDownloadURL: "https://x/beidar.exe"},
			{Name: "beidar-setup.exe", Size: 1000, BrowserDownloadURL: "https://x/beidar-setup.exe"},
		},
	}

	info := parseRelease(release)
	if info == nil {
		t.Fatal("parseRelease returned nil")
	}
	if info.Version != "1.2.3" {
		t.Errorf("version = %q, want 1.2.3", info.Version)
	}
	if !info.UpdateAvailable {
		t.Error("expected update available for newer version")
	}
	if info.DownloadURL != "https://x/beidar-setup.exe" {
		t.Errorf("download url = %q, want installer URL", info.DownloadURL)
	}
	if info.Size != 1000 {
		t.Errorf("size = %d, want 1000", info.Size)
	}
	if info.Checksum != "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" {
		t.Errorf("checksum = %q, want the 64-hex digest", info.Checksum)
	}
	if info.SizeFormatted == "" {
		t.Error("expected a formatted size")
	}
}

func TestParseReleaseNoUpdateWhenCurrent(t *testing.T) {
	CurrentVersion = "1.2.3"
	updateStatus = UpdateStatus{}

	info := parseRelease(GitHubRelease{TagName: "1.2.3"})
	if info.UpdateAvailable {
		t.Error("expected no update when version matches current")
	}
}

func TestParseReleaseSkipsPrereleaseAndSkippedVersion(t *testing.T) {
	CurrentVersion = "1.0.0"

	setConfig(t, func(c *UpdateConfig) {
		c.AllowPrerelease = false
		c.SkippedVersion = ""
	})
	pre := parseRelease(GitHubRelease{TagName: "v1.5.0", Prerelease: true})
	if pre.UpdateAvailable {
		t.Error("prerelease must not be offered when AllowPrerelease=false")
	}

	setConfig(t, func(c *UpdateConfig) {
		c.AllowPrerelease = true
		c.SkippedVersion = "1.5.0"
	})
	skipped := parseRelease(GitHubRelease{TagName: "v1.5.0", Prerelease: true})
	if skipped.UpdateAvailable {
		t.Error("skipped version must not be offered")
	}

	setConfig(t, func(c *UpdateConfig) {
		c.AllowPrerelease = true
		c.SkippedVersion = ""
	})
	allowed := parseRelease(GitHubRelease{TagName: "v1.5.0", Prerelease: true})
	if !allowed.UpdateAvailable {
		t.Error("prerelease should be offered when AllowPrerelease=true")
	}
}

func TestCheckFromURLSuccess(t *testing.T) {
	CurrentVersion = "1.0.0"

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"tag_name":"v2.0.0","name":"2.0.0","body":"notes","assets":[{"name":"beidar-installer.exe","size":2048,"browser_download_url":"https://x/setup.exe"}]}`))
	}))
	defer srv.Close()

	info, err := checkFromURL(srv.URL)
	if err != nil {
		t.Fatalf("checkFromURL: %v", err)
	}
	if info == nil || !info.UpdateAvailable {
		t.Fatal("expected update info with update available")
	}
	if info.Version != "2.0.0" {
		t.Errorf("version = %q, want 2.0.0", info.Version)
	}
	if st := GetUpdateStatus(); st.Info == nil || st.Info.Version != "2.0.0" {
		t.Error("update status should expose the parsed info")
	}
}

func TestCheckFromURLNotFoundIsNil(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	info, err := checkFromURL(srv.URL)
	if err != nil {
		t.Fatalf("checkFromURL 404 should not error: %v", err)
	}
	if info != nil {
		t.Errorf("expected nil info for 404, got %+v", info)
	}
}

func TestCheckFromURLServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	if _, err := checkFromURL(srv.URL); err == nil {
		t.Error("expected error for non-200 response")
	}
}

func TestCheckFromURLInvalidJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"tag_name":`))
	}))
	defer srv.Close()

	if _, err := checkFromURL(srv.URL); err == nil {
		t.Error("expected error for malformed JSON")
	}
}

func TestDownloadUpdateSuccess(t *testing.T) {
	payload := []byte("fake-installer-bytes")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write(payload)
	}))
	defer srv.Close()

	hash := sha256.Sum256(payload)
	path, err := DownloadUpdate(srv.URL, hex.EncodeToString(hash[:]))
	if err != nil {
		t.Fatalf("DownloadUpdate: %v", err)
	}
	defer os.Remove(path)

	if _, err := os.Stat(path); err != nil {
		t.Fatalf("downloaded file missing: %v", err)
	}
	got, _ := calculateSHA256(path)
	if got != hex.EncodeToString(hash[:]) {
		t.Error("downloaded file checksum mismatch")
	}
}

func TestDownloadUpdateChecksumMismatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("corrupted"))
	}))
	defer srv.Close()

	_, err := DownloadUpdate(srv.URL, "deadbeef")
	if err == nil || !strings.Contains(err.Error(), "checksum mismatch") {
		t.Fatalf("expected checksum mismatch error, got: %v", err)
	}
}

func TestInstallUpdateMissingFile(t *testing.T) {
	err := InstallUpdate("Z:\\nonexistent\\installer.exe")
	if err == nil || !strings.Contains(err.Error(), "installer file not found") {
		t.Fatalf("expected installer-not-found error, got: %v", err)
	}
}

func TestGettersAndStatus(t *testing.T) {
	CurrentVersion = "9.9.9"
	if got := GetCurrentVersion(); got != "9.9.9" {
		t.Errorf("GetCurrentVersion() = %q", got)
	}

	setStatus(func(s *UpdateStatus) {
		s.Stage = "checking"
		s.Progress = 50
	})
	st := GetUpdateStatus()
	if st.Stage != "checking" || st.Progress != 50 {
		t.Errorf("GetUpdateStatus() = %+v", st)
	}

	cfg := GetUpdateConfig()
	if !cfg.AutoCheck {
		t.Error("default config should have auto check enabled")
	}
}

func TestStartAutoUpdateCheckNoopPaths(t *testing.T) {
	// AutoCheck disabled -> returns immediately, no goroutine/network.
	setConfig(t, func(c *UpdateConfig) {
		c.AutoCheck = false
	})
	StartAutoUpdateCheck()

	// Recent last check -> interval not yet elapsed -> returns immediately.
	setConfig(t, func(c *UpdateConfig) {
		c.AutoCheck = true
		c.LastCheckTime = time.Now().Unix()
	})
	StartAutoUpdateCheck()
}
