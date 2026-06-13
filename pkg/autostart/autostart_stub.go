//go:build !windows

package autostart

import "errors"

func EnableAutoStart() error {
	return errors.New("autostart is not supported on this platform")
}

func DisableAutoStart() error {
	return nil
}

func IsAutoStartEnabled() bool {
	return false
}

func GetAutoStartPath() (string, error) {
	return "", errors.New("autostart is not supported on this platform")
}
