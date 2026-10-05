package network

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"beidar-desktop/pkg/crypto"
)

// serverSecretStore persists the LAN server pairing secret so already-paired
// devices keep working after the app restarts. Tests inject an in-memory fake.
type serverSecretStore interface {
	Get() string
	Set(secret string) error
}

// fileServerSecretStore keeps the secret in an encrypted file bound to this
// machine (same key derivation and permissions as lan_config.json). It is
// deliberately not stored in pkg/secureconfig: that file holds third-party
// credentials and must never be rewritten from an automatic LAN startup path.
type fileServerSecretStore struct{}

func (fileServerSecretStore) Get() string {
	path := serverSecretFilePath()
	if path == "" {
		return ""
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	decrypted, err := crypto.Decrypt(string(data), deriveLanTLSKey())
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(decrypted))
}

func (fileServerSecretStore) Set(secret string) error {
	path := serverSecretFilePath()
	if path == "" {
		return fmt.Errorf("تعذر تحديد مجلد إعدادات المستخدم لحفظ سر الخادم")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	encrypted, err := crypto.Encrypt([]byte(secret), deriveLanTLSKey())
	if err != nil {
		return err
	}
	return os.WriteFile(path, []byte(encrypted), 0600)
}

// serverSecretFilePath mirrors getLanConfigPath() so the pairing secret lives
// beside the client LAN config in the app's per-user config directory.
func serverSecretFilePath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(configDir, "BeidarPOS_V3", "lan_server_secret.enc")
}
