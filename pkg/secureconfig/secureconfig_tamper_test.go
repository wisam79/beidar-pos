package secureconfig

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSecureConfig_TamperAndCorruptionDefense(t *testing.T) {
	origConfigPath := configPath
	origLoadedSecrets := loadedSecrets
	origAppData := os.Getenv("APPDATA")
	origXdg := os.Getenv("XDG_CONFIG_HOME")
	defer func() {
		configPath = origConfigPath
		loadedSecrets = origLoadedSecrets
		os.Setenv("APPDATA", origAppData)
		os.Setenv("XDG_CONFIG_HOME", origXdg)
	}()

	tmpDir := t.TempDir()
	os.Setenv("APPDATA", tmpDir)
	os.Setenv("XDG_CONFIG_HOME", tmpDir)
	configPath = filepath.Join(tmpDir, "BeidarPOS_V3", "secrets.enc")

	t.Run("TamperedCiphertext_DoesNotLoadSecrets", func(t *testing.T) {
		ResetCache()

		secrets := &Secrets{
			SupabaseURL:     "https://tamper.supabase.co",
			SupabaseAnonKey: "valid-key-12345",
			GeminiAPIKey:    "ai-key-secret",
			GroqAPIKey:      "groq-key-secret",
		}

		if err := Save(secrets); err != nil {
			t.Fatalf("Save failed: %v", err)
		}

		// Read the encrypted file and modify bytes
		data, err := os.ReadFile(configPath)
		if err != nil {
			t.Fatalf("ReadFile failed: %v", err)
		}

		// Tamper with ciphertext payload
		if len(data) > 10 {
			data[len(data)-5] ^= 0xFF
			data[len(data)-6] ^= 0xAA
		}

		if err := os.WriteFile(configPath, data, 0600); err != nil {
			t.Fatalf("WriteFile failed: %v", err)
		}

		ResetCache()
		loaded, err := Load()
		if err != nil {
			t.Fatalf("unexpected fatal error from Load: %v", err)
		}
		if loaded.SupabaseURL != "" {
			t.Errorf("expected empty SupabaseURL on tampered file, got %q", loaded.SupabaseURL)
		}
	})

	t.Run("TruncatedFile_RecoversSafelyWithoutPanic", func(t *testing.T) {
		ResetCache()

		// Write a file that is too short for AES-GCM nonce + tag
		truncated := []byte("short")
		if err := os.WriteFile(configPath, truncated, 0600); err != nil {
			t.Fatalf("WriteFile failed: %v", err)
		}

		ResetCache()
		loaded, err := Load()
		if err != nil {
			t.Fatalf("unexpected fatal error from Load on truncated file: %v", err)
		}
		if loaded == nil {
			t.Fatal("expected non-nil secrets struct on safe fallback")
		}
	})

	t.Run("EmptySecrets_SavesAndLoadsSuccessfully", func(t *testing.T) {
		ResetCache()

		emptySecrets := &Secrets{}
		if err := Save(emptySecrets); err != nil {
			t.Fatalf("Save empty secrets failed: %v", err)
		}

		ResetCache()
		loaded, err := Load()
		if err != nil {
			t.Fatalf("Load empty secrets failed: %v", err)
		}

		if loaded.SupabaseURL != "" || loaded.GeminiAPIKey != "" {
			t.Errorf("expected empty fields, got SupabaseURL=%q, GeminiAPIKey=%q", loaded.SupabaseURL, loaded.GeminiAPIKey)
		}
	})
}
