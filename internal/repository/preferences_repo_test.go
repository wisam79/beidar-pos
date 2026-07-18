package repository

import (
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestPreferencesRepository(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	repo := NewPreferencesRepository(db)

	t.Run("Get_Empty", func(t *testing.T) {
		_, err := repo.Get()
		if err == nil {
			t.Error("Expected error fetching non-existent preferences row")
		}
	})

	t.Run("SaveAndGetDecrypted", func(t *testing.T) {
		prefs := &domain.AppPreferences{
			ID:             1,
			StoreName:      "Beidar Store",
			Currency:       "IQD",
			GeminiAPIKey:   "secret-gemini-key",
			GroqAPIKey:     "secret-groq-key",
			GeminiAPIKeys:  []string{"key-1", "key-2"},
		}

		if err := repo.Save(prefs); err != nil {
			t.Fatalf("Save failed: %v", err)
		}

		// Read back and assert it is decrypted correctly
		got, err := repo.Get()
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}

		if got.StoreName != "Beidar Store" {
			t.Errorf("Expected StoreName 'Beidar Store', got %q", got.StoreName)
		}
		if got.GeminiAPIKey != "secret-gemini-key" {
			t.Errorf("Expected GeminiAPIKey 'secret-gemini-key', got %q", got.GeminiAPIKey)
		}
		if got.GroqAPIKey != "secret-groq-key" {
			t.Errorf("Expected GroqAPIKey 'secret-groq-key', got %q", got.GroqAPIKey)
		}
		if len(got.GeminiAPIKeys) != 2 || got.GeminiAPIKeys[0] != "key-1" || got.GeminiAPIKeys[1] != "key-2" {
			t.Errorf("Expected decrypted keys list, got %v", got.GeminiAPIKeys)
		}

		// Read raw from DB to ensure it is encrypted inside database
		var raw domain.AppPreferences
		if err := db.First(&raw).Error; err != nil {
			t.Fatalf("Failed to query raw preferences: %v", err)
		}

		if raw.GeminiAPIKey == "secret-gemini-key" {
			t.Error("Expected GeminiAPIKey to be encrypted in database, got plain value")
		}
		if raw.GroqAPIKey == "secret-groq-key" {
			t.Error("Expected GroqAPIKey to be encrypted in database, got plain value")
		}
	})
}
