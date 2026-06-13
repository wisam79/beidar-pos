//go:build windows

package autostart

import (
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

const (
	registryKeyRun = `SOFTWARE\Microsoft\Windows\CurrentVersion\Run`
	appNameReg     = "BeidarPOS_V3"
)

// EnableAutoStart adds the application to Windows startup
func EnableAutoStart() error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	exePath, err = filepath.Abs(exePath)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	key, err := registry.OpenKey(registry.CURRENT_USER, registryKeyRun, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("failed to open registry key: %w", err)
	}
	defer key.Close()

	value := `"` + exePath + `"`
	if err := key.SetStringValue(appNameReg, value); err != nil {
		return fmt.Errorf("failed to set registry value: %w", err)
	}

	return nil
}

// DisableAutoStart removes the application from Windows startup
func DisableAutoStart() error {
	key, err := registry.OpenKey(registry.CURRENT_USER, registryKeyRun, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("failed to open registry key: %w", err)
	}
	defer key.Close()

	if err := key.DeleteValue(appNameReg); err != nil {
		if err != registry.ErrNotExist {
			return fmt.Errorf("failed to delete registry value: %w", err)
		}
	}

	return nil
}

// IsAutoStartEnabled checks if auto-start is enabled
func IsAutoStartEnabled() bool {
	key, err := registry.OpenKey(registry.CURRENT_USER, registryKeyRun, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer key.Close()

	_, _, err = key.GetStringValue(appNameReg)
	return err == nil
}

// GetAutoStartPath returns the path configured for auto-start
func GetAutoStartPath() (string, error) {
	key, err := registry.OpenKey(registry.CURRENT_USER, registryKeyRun, registry.QUERY_VALUE)
	if err != nil {
		return "", fmt.Errorf("failed to open registry key: %w", err)
	}
	defer key.Close()

	value, _, err := key.GetStringValue(appNameReg)
	if err != nil {
		return "", fmt.Errorf("failed to get registry value: %w", err)
	}

	return value, nil
}
