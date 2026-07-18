package secureconfig

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSecureConfig(t *testing.T) {
	// Backup original state
	origConfigPath := configPath
	origLoadedSecrets := loadedSecrets
	origAppData := os.Getenv("APPDATA")
	defer func() {
		configPath = origConfigPath
		loadedSecrets = origLoadedSecrets
		os.Setenv("APPDATA", origAppData)
	}()

	// Setup a temporary config directory using APPDATA env var
	tmpDir := t.TempDir()
	os.Setenv("APPDATA", tmpDir)

	// Recompute configPath to match the temp directory
	configPath = filepath.Join(tmpDir, "BeidarPOS_V3", "secrets.enc")

	t.Run("SaveAndLoadSecrets", func(t *testing.T) {
		ResetCache()

		secrets := &Secrets{
			SupabaseURL:     "https://test.supabase.co",
			SupabaseAnonKey: "test-anon-key",
			GeminiAPIKey:    "test-gemini-key",
			GroqAPIKey:      "test-groq-key",
		}

		err := Save(secrets)
		if err != nil {
			t.Fatalf("Failed to save secrets: %v", err)
		}

		// Ensure file exists
		if _, err := os.Stat(configPath); os.IsNotExist(err) {
			t.Fatalf("Encrypted secrets file was not created")
		}

		// Clear cache and load
		ResetCache()
		loaded, err := Load()
		if err != nil {
			t.Fatalf("Failed to load secrets: %v", err)
		}

		if loaded.SupabaseURL != secrets.SupabaseURL {
			t.Errorf("Expected SupabaseURL %q, got %q", secrets.SupabaseURL, loaded.SupabaseURL)
		}
		if loaded.SupabaseAnonKey != secrets.SupabaseAnonKey {
			t.Errorf("Expected SupabaseAnonKey %q, got %q", secrets.SupabaseAnonKey, loaded.SupabaseAnonKey)
		}
		if loaded.GeminiAPIKey != secrets.GeminiAPIKey {
			t.Errorf("Expected GeminiAPIKey %q, got %q", secrets.GeminiAPIKey, loaded.GeminiAPIKey)
		}
		if loaded.GroqAPIKey != secrets.GroqAPIKey {
			t.Errorf("Expected GroqAPIKey %q, got %q", secrets.GroqAPIKey, loaded.GroqAPIKey)
		}
	})

	t.Run("EnvironmentOverrides", func(t *testing.T) {
		ResetCache()

		os.Setenv("BEIDAR_SUPABASE_URL", "https://env.supabase.co")
		os.Setenv("BEIDAR_SUPABASE_KEY", "env-anon-key")
		defer func() {
			os.Unsetenv("BEIDAR_SUPABASE_URL")
			os.Unsetenv("BEIDAR_SUPABASE_KEY")
		}()

		loaded, err := Load()
		if err != nil {
			t.Fatalf("Failed to load: %v", err)
		}

		if loaded.SupabaseURL != "https://env.supabase.co" {
			t.Errorf("Expected env-overridden SupabaseURL, got %q", loaded.SupabaseURL)
		}
		if loaded.SupabaseAnonKey != "env-anon-key" {
			t.Errorf("Expected env-overridden SupabaseAnonKey, got %q", loaded.SupabaseAnonKey)
		}
	})

	t.Run("GettersAndSetters", func(t *testing.T) {
		// Remove existing file and clear cache to test default empty states first
		_ = os.Remove(configPath)
		ResetCache()

		url, err := GetSupabaseURL()
		if err == nil {
			t.Errorf("Expected error for empty SupabaseURL, got %q", url)
		}

		key, err := GetSupabaseKey()
		if err == nil {
			t.Errorf("Expected error for empty SupabaseKey, got %q", key)
		}

		err = SetGeminiAPIKey("new-gemini-key")
		if err != nil {
			t.Fatalf("SetGeminiAPIKey failed: %v", err)
		}

		geminiKey := GetGeminiAPIKey()
		if geminiKey != "new-gemini-key" {
			t.Errorf("Expected Gemini API key 'new-gemini-key', got %q", geminiKey)
		}

		err = SetGroqAPIKey("new-groq-key")
		if err != nil {
			t.Fatalf("SetGroqAPIKey failed: %v", err)
		}

		groqKey := GetGroqAPIKey()
		if groqKey != "new-groq-key" {
			t.Errorf("Expected Groq API key 'new-groq-key', got %q", groqKey)
		}
	})
}
