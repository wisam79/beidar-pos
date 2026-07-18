package repository

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/crypto"
	"fmt"
	"os"

	"gorm.io/gorm"
)

type preferencesRepository struct {
	db *gorm.DB
}

func NewPreferencesRepository(db *gorm.DB) domain.PreferencesRepository {
	return &preferencesRepository{db: db}
}

func (r *preferencesRepository) Get() (*domain.AppPreferences, error) {
	var prefs domain.AppPreferences
	if err := r.db.First(&prefs).Error; err != nil {
		return nil, err
	}
	if err := decryptPrefs(&prefs); err != nil {
		return nil, err
	}
	return &prefs, nil
}

func (r *preferencesRepository) Save(prefs *domain.AppPreferences) error {
	encrypted := *prefs
	if err := encryptPrefs(&encrypted); err != nil {
		return err
	}
	return r.db.Save(&encrypted).Error
}

func derivePrefsKey() []byte {
	host, err := os.Hostname()
	if err != nil {
		host = "beidar-default"
	}
	return crypto.DeriveKey(fmt.Sprintf("beidar-prefs-key-%s", host))
}

func encryptPrefs(prefs *domain.AppPreferences) error {
	key := derivePrefsKey()

	if prefs.GeminiAPIKey != "" {
		enc, err := crypto.Encrypt([]byte(prefs.GeminiAPIKey), key)
		if err != nil {
			return fmt.Errorf("failed to encrypt Gemini API Key: %w", err)
		}
		prefs.GeminiAPIKey = enc
	}

	if prefs.GroqAPIKey != "" {
		enc, err := crypto.Encrypt([]byte(prefs.GroqAPIKey), key)
		if err != nil {
			return fmt.Errorf("failed to encrypt Groq API Key: %w", err)
		}
		prefs.GroqAPIKey = enc
	}

	if len(prefs.GeminiAPIKeys) > 0 {
		encrypted := make([]string, 0, len(prefs.GeminiAPIKeys))
		for _, k := range prefs.GeminiAPIKeys {
			enc, err := crypto.Encrypt([]byte(k), key)
			if err != nil {
				return fmt.Errorf("failed to encrypt Gemini API Keys list item: %w", err)
			}
			encrypted = append(encrypted, enc)
		}
		prefs.GeminiAPIKeys = encrypted
	}
	return nil
}

func decryptPrefs(prefs *domain.AppPreferences) error {
	key := derivePrefsKey()

	if prefs.GeminiAPIKey != "" {
		dec, err := crypto.Decrypt(prefs.GeminiAPIKey, key)
		if err != nil {
			return fmt.Errorf("failed to decrypt Gemini API Key: %w", err)
		}
		prefs.GeminiAPIKey = string(dec)
	}

	if prefs.GroqAPIKey != "" {
		dec, err := crypto.Decrypt(prefs.GroqAPIKey, key)
		if err != nil {
			return fmt.Errorf("failed to decrypt Groq API Key: %w", err)
		}
		prefs.GroqAPIKey = string(dec)
	}

	if len(prefs.GeminiAPIKeys) > 0 {
		decrypted := make([]string, 0, len(prefs.GeminiAPIKeys))
		for _, k := range prefs.GeminiAPIKeys {
			dec, err := crypto.Decrypt(k, key)
			if err != nil {
				return fmt.Errorf("failed to decrypt Gemini API Keys list item: %w", err)
			}
			decrypted = append(decrypted, string(dec))
		}
		prefs.GeminiAPIKeys = decrypted
	}
	return nil
}
