package service

import (
	"beidar-desktop/pkg/crypto"
	"os"
)

// settingsMachineKey is a device-bound encryption key for at-rest secrets.
var settingsMachineKey = func() []byte {
	h, _ := os.Hostname()
	return crypto.DeriveKey("beidar-v3-" + h)
}()
