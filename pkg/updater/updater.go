//go:build windows

package updater

import (
	"beidar-desktop/pkg/notification"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

var (
	CurrentVersion = "dev"
)

const (
	GitHubOwner = "wisam79"
	GitHubRepo  = "beidar"

	PrimaryUpdateURL  = "https://beidar-updater.wisamsamir78.workers.dev/releases/latest"
	FallbackUpdateURL = "https://api.github.com/repos/" + GitHubOwner + "/" + GitHubRepo + "/releases/latest"

	UpdateCheckInterval    = 6 // hours between auto-checks
	MinCheckInterval       = 1
	DownloadTimeoutMinutes = 30
	MaxDownloadRetries     = 3
)

type GitHubRelease struct {
	TagName     string        `json:"tag_name"`
	Name        string        `json:"name"`
	Body        string        `json:"body"`
	PublishedAt string        `json:"published_at"`
	Prerelease  bool          `json:"prerelease"`
	Assets      []GitHubAsset `json:"assets"`
}

type GitHubAsset struct {
	Name               string `json:"name"`
	Size               int64  `json:"size"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

type UpdateInfo struct {
	Version         string `json:"version"`
	DownloadURL     string `json:"download_url"`
	ReleaseNotes    string `json:"release_notes"`
	Mandatory       bool   `json:"mandatory"`
	Size            int64  `json:"size"`
	SizeFormatted   string `json:"size_formatted"`
	Checksum        string `json:"checksum"` // SHA256
	ReleaseDate     string `json:"release_date"`
	UpdateAvailable bool   `json:"update_available"`
	IsPrerelease    bool   `json:"is_prerelease"`
}

type UpdateStatus struct {
	Checking        bool        `json:"checking"`
	Downloading     bool        `json:"downloading"`
	Installing      bool        `json:"installing"`
	Progress        float64     `json:"progress"`
	Speed           string      `json:"speed"`
	ETA             string      `json:"eta"`
	Error           string      `json:"error"`
	Stage           string      `json:"stage"`
	UpdateAvailable bool        `json:"updateAvailable"`
	Info            *UpdateInfo `json:"info"`
}

type UpdateConfig struct {
	AutoCheck       bool   `json:"auto_check"`
	NotifyOnUpdate  bool   `json:"notify_on_update"`
	LastCheckTime   int64  `json:"last_check_time"`
	SkippedVersion  string `json:"skipped_version"`
	AllowPrerelease bool   `json:"allow_prerelease"`
}

var (
	updateStatus = UpdateStatus{}
	statusMutex  = sync.RWMutex{}
	updateConfig = UpdateConfig{
		AutoCheck:      true,
		NotifyOnUpdate: true,
	}
	configMutex = sync.RWMutex{}
)

// GetCurrentVersion returns the current version
func GetCurrentVersion() string {
	return CurrentVersion
}

// GetUpdateStatus thread-safely gets the current update status
func GetUpdateStatus() UpdateStatus {
	statusMutex.RLock()
	defer statusMutex.RUnlock()
	return updateStatus
}

// GetUpdateConfig gets the update config
func GetUpdateConfig() UpdateConfig {
	configMutex.RLock()
	defer configMutex.RUnlock()
	return updateConfig
}

// SetUpdateConfig updates the configuration
func SetUpdateConfig(cfg UpdateConfig) error {
	configMutex.Lock()
	updateConfig = cfg
	configMutex.Unlock()
	return saveUpdateConfig()
}

// CheckForUpdates checks for updates
func CheckForUpdates() (*UpdateInfo, error) {
	setStatus(func(s *UpdateStatus) {
		s.Checking = true
		s.Error = ""
		s.Stage = "checking"
	})
	defer setStatus(func(s *UpdateStatus) {
		s.Checking = false
	})

	urls := []string{PrimaryUpdateURL, FallbackUpdateURL}
	var lastErr error

	for _, url := range urls {
		info, err := checkFromURL(url)
		if err == nil {
			configMutex.Lock()
			updateConfig.LastCheckTime = time.Now().Unix()
			configMutex.Unlock()
			_ = saveUpdateConfig()

			return info, nil
		}
		lastErr = err
	}

	setStatus(func(s *UpdateStatus) {
		s.Error = "فشل الاتصال بخادم التحديثات"
	})
	return nil, lastErr
}

func checkFromURL(url string) (*UpdateInfo, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Beidar-Desktop-V3/"+CurrentVersion)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("server returned %d", resp.StatusCode)
	}

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, fmt.Errorf("invalid response: %w", err)
	}

	return parseRelease(release), nil
}

func parseRelease(release GitHubRelease) *UpdateInfo {
	var downloadURL string
	var size int64
	var checksum string

	for _, asset := range release.Assets {
		name := strings.ToLower(asset.Name)
		if strings.HasSuffix(name, ".exe") {
			if strings.Contains(name, "installer") || strings.Contains(name, "setup") {
				downloadURL = asset.BrowserDownloadURL
				size = asset.Size
				break
			}
			if downloadURL == "" {
				downloadURL = asset.BrowserDownloadURL
				size = asset.Size
			}
		}
	}

	lines := strings.Split(release.Body, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if len(line) > 64 && (strings.Contains(line, ".exe") || strings.Contains(line, "installer")) {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				if len(parts[0]) == 64 {
					_, err := hex.DecodeString(parts[0])
					if err == nil {
						checksum = parts[0]
						break
					}
				}
			}
		}
	}

	version := strings.TrimPrefix(release.TagName, "v")
	hasUpdate := compareVersions(version, CurrentVersion) > 0

	configMutex.RLock()
	skipped := updateConfig.SkippedVersion == version
	allowPre := updateConfig.AllowPrerelease
	configMutex.RUnlock()

	if skipped || (release.Prerelease && !allowPre) {
		hasUpdate = false
	}

	info := &UpdateInfo{
		Version:         version,
		DownloadURL:     downloadURL,
		ReleaseNotes:    release.Body,
		Mandatory:       false,
		Size:            size,
		SizeFormatted:   formatBytes(size),
		Checksum:        checksum,
		ReleaseDate:     release.PublishedAt,
		UpdateAvailable: hasUpdate,
		IsPrerelease:    release.Prerelease,
	}

	setStatus(func(s *UpdateStatus) {
		s.UpdateAvailable = hasUpdate
		s.Info = info
	})

	return info
}

// DownloadUpdate downloads the update
func DownloadUpdate(url string, expectedChecksum string) (string, error) {
	setStatus(func(s *UpdateStatus) {
		s.Downloading = true
		s.Progress = 0
		s.Error = ""
		s.Stage = "downloading"
		s.Speed = ""
		s.ETA = ""
	})
	defer setStatus(func(s *UpdateStatus) {
		s.Downloading = false
	})

	tempDir := filepath.Join(os.TempDir(), "beidar-updates-v3")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create temp dir: %w", err)
	}

	installerPath := filepath.Join(tempDir, "beidar-update-installer.exe")
	_ = os.Remove(installerPath)

	var lastErr error
	for attempt := 1; attempt <= MaxDownloadRetries; attempt++ {
		err := downloadFile(url, installerPath)
		if err == nil {
			setStatus(func(s *UpdateStatus) {
				s.Stage = "verifying"
				s.Progress = 100
			})

			info, err := os.Stat(installerPath)
			if err != nil || info.Size() == 0 {
				lastErr = fmt.Errorf("downloaded file is invalid")
				continue
			}

			// Verify Checksum if provided
			if expectedChecksum != "" {
				setStatus(func(s *UpdateStatus) {
					s.Stage = "verifying_checksum"
				})

				hash, err := calculateSHA256(installerPath)
				if err != nil {
					return "", fmt.Errorf("failed to calculate checksum: %w", err)
				}

				if hash != expectedChecksum {
					_ = os.Remove(installerPath)
					return "", fmt.Errorf("checksum mismatch! expected %s, got %s", expectedChecksum, hash)
				}
			}

			return installerPath, nil
		}
		lastErr = err

		if attempt < MaxDownloadRetries {
			time.Sleep(2 * time.Second)
		}
	}

	setStatus(func(s *UpdateStatus) {
		s.Error = "فشل تحميل التحديث بعد عدة محاولات"
	})
	return "", lastErr
}

func downloadFile(url, dest string) error {
	client := &http.Client{Timeout: time.Duration(DownloadTimeoutMinutes) * time.Minute}
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	totalSize := resp.ContentLength
	var downloaded int64
	startTime := time.Now()
	buf := make([]byte, 64*1024)

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			_, writeErr := out.Write(buf[:n])
			if writeErr != nil {
				return writeErr
			}
			downloaded += int64(n)

			if totalSize > 0 {
				progress := float64(downloaded) / float64(totalSize) * 100
				elapsed := time.Since(startTime).Seconds()
				speed := float64(downloaded) / elapsed
				remaining := float64(totalSize-downloaded) / speed

				setStatus(func(s *UpdateStatus) {
					s.Progress = progress
					s.Speed = formatBytes(int64(speed)) + "/s"
					s.ETA = formatDuration(time.Duration(remaining) * time.Second)
				})
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return readErr
		}
	}

	return nil
}

// InstallUpdate executes installer
func InstallUpdate(installerPath string) error {
	setStatus(func(s *UpdateStatus) {
		s.Installing = true
		s.Stage = "installing"
	})

	if _, err := os.Stat(installerPath); os.IsNotExist(err) {
		return fmt.Errorf("installer file not found: %s", installerPath)
	}

	err := runAsAdmin(installerPath, "/S")
	if err != nil {
		return fmt.Errorf("failed to start installer: %w", err)
	}

	os.Exit(0)
	return nil
}

func runAsAdmin(exePath string, args string) error {
	shell32 := syscall.NewLazyDLL("shell32.dll")
	shellExecute := shell32.NewProc("ShellExecuteW")

	verb, _ := syscall.UTF16PtrFromString("runas")
	exe, _ := syscall.UTF16PtrFromString(exePath)
	params, _ := syscall.UTF16PtrFromString(args)
	dir, _ := syscall.UTF16PtrFromString(filepath.Dir(exePath))

	ret, _, _ := shellExecute.Call(
		0,
		uintptr(unsafe.Pointer(verb)),
		uintptr(unsafe.Pointer(exe)),
		uintptr(unsafe.Pointer(params)),
		uintptr(unsafe.Pointer(dir)),
		1,
	)

	if ret <= 32 {
		return fmt.Errorf("ShellExecute failed with code %d", ret)
	}

	return nil
}

func calculateSHA256(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func compareVersions(v1, v2 string) int {
	parts1 := strings.Split(strings.TrimPrefix(v1, "v"), ".")
	parts2 := strings.Split(strings.TrimPrefix(v2, "v"), ".")

	for i := 0; i < 3; i++ {
		var n1, n2 int
		if i < len(parts1) {
			_, _ = fmt.Sscanf(parts1[i], "%d", &n1)
		}
		if i < len(parts2) {
			_, _ = fmt.Sscanf(parts2[i], "%d", &n2)
		}
		if n1 > n2 {
			return 1
		}
		if n1 < n2 {
			return -1
		}
	}
	return 0
}

func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%.0f ثانية", d.Seconds())
	}
	return fmt.Sprintf("%.0f دقيقة", d.Minutes())
}

func setStatus(fn func(*UpdateStatus)) {
	statusMutex.Lock()
	fn(&updateStatus)
	statusMutex.Unlock()
}

func saveUpdateConfig() error {
	configPath := filepath.Join(getConfigDir(), "update-config.json")
	configMutex.RLock()
	data, err := json.MarshalIndent(updateConfig, "", "  ")
	configMutex.RUnlock()
	if err != nil {
		return err
	}
	return os.WriteFile(configPath, data, 0644)
}

func LoadUpdateConfig() {
	configPath := filepath.Join(getConfigDir(), "update-config.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return
	}
	configMutex.Lock()
	_ = json.Unmarshal(data, &updateConfig)
	configMutex.Unlock()
}

func getConfigDir() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return os.TempDir()
	}
	dir := filepath.Join(configDir, "BeidarPOS_V3")
	_ = os.MkdirAll(dir, 0755)
	return dir
}

// SkipVersion skips a version
func SkipVersion(version string) error {
	configMutex.Lock()
	updateConfig.SkippedVersion = version
	configMutex.Unlock()
	return saveUpdateConfig()
}

// StartAutoUpdateCheck starts background update checking
func StartAutoUpdateCheck() {
	LoadUpdateConfig()

	configMutex.RLock()
	autoCheck := updateConfig.AutoCheck
	lastCheck := updateConfig.LastCheckTime
	configMutex.RUnlock()

	if !autoCheck {
		return
	}

	hoursSinceCheck := time.Since(time.Unix(lastCheck, 0)).Hours()
	if hoursSinceCheck < MinCheckInterval {
		return
	}

	go func() {
		time.Sleep(5 * time.Second) // Wait for app to stabilize

		info, err := CheckForUpdates()
		if err != nil || info == nil {
			return
		}

		if info.UpdateAvailable {
			configMutex.RLock()
			notify := updateConfig.NotifyOnUpdate
			configMutex.RUnlock()

			if notify {
				_ = notification.ShowUpdateAvailableNotification(info.Version)
			}
		}
	}()
}

func init() {
	LoadUpdateConfig()
}
