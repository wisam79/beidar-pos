package repository

import (
	"beidar-desktop/internal/core/domain"
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
	return &prefs, nil
}

func (r *preferencesRepository) Save(prefs *domain.AppPreferences) error {
	return r.db.Save(prefs).Error
}
