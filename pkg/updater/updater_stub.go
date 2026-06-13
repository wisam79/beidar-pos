//go:build !windows

package updater

import "errors"

type GitHubRelease struct{}
type GitHubAsset struct{}

type UpdateInfo struct {
	Version         string `json:"version"`
	DownloadURL     string `json:"download_url"`
	ReleaseNotes    string `json:"release_notes"`
	Mandatory       bool   `json:"mandatory"`
	Size            int64  `json:"size"`
	SizeFormatted   string `json:"size_formatted"`
	Checksum        string `json:"checksum"`
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

func GetCurrentVersion() string {
	return "0.0.0"
}

func GetUpdateStatus() UpdateStatus {
	return UpdateStatus{}
}

func GetUpdateConfig() UpdateConfig {
	return UpdateConfig{}
}

func SetUpdateConfig(cfg UpdateConfig) error {
	return nil
}

func CheckForUpdates() (*UpdateInfo, error) {
	return nil, errors.New("updater is not supported on this platform")
}

func DownloadUpdate(url string, expectedChecksum string) (string, error) {
	return "", errors.New("updater is not supported on this platform")
}

func InstallUpdate(installerPath string) error {
	return errors.New("updater is not supported on this platform")
}

func SkipVersion(version string) error {
	return nil
}

func StartAutoUpdateCheck() {}

func LoadUpdateConfig() {}
