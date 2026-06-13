//go:build !windows

package updater

import "errors"

type GitHubRelease struct{}
type GitHubAsset struct{}
type UpdateInfo struct{}
type UpdateStatus struct{}
type UpdateConfig struct{}

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
