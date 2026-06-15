package repository

import (
	"beidar-desktop/internal/core/domain"
	"gorm.io/gorm"
)

// getDB extracts *gorm.DB from domain.Tx, falling back to the repo's db.
func getDB(tx domain.Tx, db *gorm.DB) *gorm.DB {
	if gdb, ok := tx.(*gorm.DB); ok {
		return gdb
	}
	return db
}
