package secureconfig

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"beidar-desktop/pkg/crypto"
)

// Secrets holds all sensitive configuration values.
type Secrets struct {
	SupabaseURL    string   `json:"supabase_url,omitempty"`
	SupabaseAnonKey string  `json:"supabase_anon_key,omitempty"`
	GeminiAPIKeys  []string `json:"gemini_api_keys,omitempty"`
	LicenseMasterKey string `json:"license_master_key,omitempty"`
}

var (
	loadedSecrets *Secrets
	configPath    string
)

func configDir() (string, error) {
	cd, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(cd, "BeidarPOS_V3"), nil
}

func init() {
	dir, err := configDir()
	if err != nil {
		return
	}
	_ = os.MkdirAll(dir, 0755)
	configPath = filepath.Join(dir, "secrets.enc")
}

// Load reads secrets from the encrypted file and env vars (env takes priority).
func Load() (*Secrets, error) {
	if loadedSecrets != nil {
		return loadedSecrets, nil
	}

	s := &Secrets{}

	// 1. Try reading from encrypted file
	if configPath != "" {
		if data, err := os.ReadFile(configPath); err == nil {
			key := deriveMachineKey()
			decrypted, err := crypto.Decrypt(string(data), key)
			if err == nil && json.Unmarshal(decrypted, s) == nil && s.SupabaseURL != "" {
				// Successfully loaded with new device-bound key
			} else {
				// Fallback: Try decrypting with legacy key derivation (windows-default)
				legacyKey := deriveLegacyMachineKey()
				decryptedLegacy, errLegacy := crypto.Decrypt(string(data), legacyKey)
				if errLegacy == nil {
					var legacySecrets Secrets
					if json.Unmarshal(decryptedLegacy, &legacySecrets) == nil && legacySecrets.SupabaseURL != "" {
						// Migration: Re-save using the new device-bound key
						*s = legacySecrets
						_ = Save(s)
					}
				}
			}
		}
	}

	// 2. Environment variables override everything
	if v := os.Getenv("BEIDAR_SUPABASE_URL"); v != "" {
		s.SupabaseURL = v
	}
	if v := os.Getenv("BEIDAR_SUPABASE_KEY"); v != "" {
		s.SupabaseAnonKey = v
	}
	if v := os.Getenv("BEIDAR_LICENSE_MASTER_KEY"); v != "" {
		s.LicenseMasterKey = v
	}

	loadedSecrets = s
	return s, nil
}

// deriveLegacyMachineKey derives the legacy machine key using "windows-default"
// as the Windows machine ID fallback, allowing decryption of legacy config files.
func deriveLegacyMachineKey() []byte {
	host, _ := os.Hostname()
	seed := fmt.Sprintf("beidar-v3-secure-%s-windows-default", host)
	return crypto.DeriveKey(seed)
}

// ResetCache clears the cached secrets, forcing a reload on the next access.
func ResetCache() {
	loadedSecrets = nil
}

// Save persists secrets to an encrypted file.
func Save(s *Secrets) error {
	dir, err := configDir()
	if err != nil {
		return err
	}
	_ = os.MkdirAll(dir, 0755)

	path := filepath.Join(dir, "secrets.enc")
	data, err := json.Marshal(s)
	if err != nil {
		return err
	}

	key := deriveMachineKey()
	encrypted, err := crypto.Encrypt(data, key)
	if err != nil {
		return err
	}

	return os.WriteFile(path, []byte(encrypted), 0600)
}

// GetSupabaseURL returns the configured Supabase URL or an error.
func GetSupabaseURL() (string, error) {
	s, err := Load()
	if err != nil {
		return "", err
	}
	if s.SupabaseURL == "" {
		return "", fmt.Errorf("Supabase URL غير مضبوط. قم بتعيين BEIDAR_SUPABASE_URL في متغيرات البيئة أو من شاشة الإعدادات")
	}
	return s.SupabaseURL, nil
}

// GetSupabaseKey returns the configured Supabase anon key or an error.
func GetSupabaseKey() (string, error) {
	s, err := Load()
	if err != nil {
		return "", err
	}
	if s.SupabaseAnonKey == "" {
		return "", fmt.Errorf("Supabase Key غير مضبوط. قم بتعيين BEIDAR_SUPABASE_KEY في متغيرات البيئة أو من شاشة الإعدادات")
	}
	return s.SupabaseAnonKey, nil
}

// deriveMachineKey creates a device-bound encryption key using hostname + machine ID.
func deriveMachineKey() []byte {
	host, _ := os.Hostname()
	machineID := readMachineID()
	seed := fmt.Sprintf("beidar-v3-secure-%s-%s", host, machineID)
	return crypto.DeriveKey(seed)
}
