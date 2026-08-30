package repository

import (
	"beidar-desktop/internal/core/domain"

	"gorm.io/gorm"
)

type auditRepository struct {
	db *gorm.DB
}

// NewAuditRepository creates a new audit repository
func NewAuditRepository(db *gorm.DB) domain.AuditRepository {
	return &auditRepository{db: db}
}

func (r *auditRepository) WithTx(tx domain.Tx) domain.AuditRepository {
	return &auditRepository{db: getDB(tx, r.db)}
}

func (r *auditRepository) Log(entry *domain.AuditLog) error {
	return r.db.Create(entry).Error
}

func (r *auditRepository) GetRecent(limit int) ([]domain.AuditLog, error) {
	var logs []domain.AuditLog
	err := r.db.Order("timestamp desc").Limit(limit).Find(&logs).Error
	if logs == nil {
		logs = []domain.AuditLog{}
	}
	return logs, err
}
