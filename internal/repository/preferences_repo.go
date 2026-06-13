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
	decryptPrefs(&prefs)
	return &prefs, nil
}

func (r *preferencesRepository) Save(prefs *domain.AppPreferences) error {
	encrypted := *prefs
	encryptPrefs(&encrypted)
	return r.db.Save(&encrypted).Error
}

func derivePrefsKey() []byte {
	host, err := os.Hostname()
	if err != nil {
		host = "beidar-default"
	}
	return crypto.DeriveKey(fmt.Sprintf("beidar-prefs-key-%s", host))
}

func encryptPrefs(prefs *domain.AppPreferences) {
	key := derivePrefsKey()

	if prefs.GeminiAPIKey != "" {
		if enc, err := crypto.Encrypt([]byte(prefs.GeminiAPIKey), key); err == nil {
			prefs.GeminiAPIKey = enc
		}
	}

	if len(prefs.GeminiAPIKeys) > 0 {
		encrypted := make([]string, 0, len(prefs.GeminiAPIKeys))
		for _, k := range prefs.GeminiAPIKeys {
			if enc, err := crypto.Encrypt([]byte(k), key); err == nil {
				encrypted = append(encrypted, enc)
			} else {
				encrypted = append(encrypted, k)
			}
		}
		prefs.GeminiAPIKeys = encrypted
	}
}

func decryptPrefs(prefs *domain.AppPreferences) {
	key := derivePrefsKey()

	if prefs.GeminiAPIKey != "" {
		if dec, err := crypto.Decrypt(prefs.GeminiAPIKey, key); err == nil {
			prefs.GeminiAPIKey = string(dec)
		}
	}

	if len(prefs.GeminiAPIKeys) > 0 {
		decrypted := make([]string, 0, len(prefs.GeminiAPIKeys))
		for _, k := range prefs.GeminiAPIKeys {
			if dec, err := crypto.Decrypt(k, key); err == nil {
				decrypted = append(decrypted, string(dec))
			} else {
				decrypted = append(decrypted, k)
			}
		}
		prefs.GeminiAPIKeys = decrypted
	}
}
