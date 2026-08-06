package domain

import (
	"time"
)

// AuditLog represents a record of a critical action performed in the system.
type AuditLog struct {
	ID        int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	StaffID   string    `json:"staffId" gorm:"index;size:36;not null"`
	Action    string    `json:"action" gorm:"index;size:50;not null"`
	Entity    string    `json:"entity" gorm:"index;size:50;not null"`
	EntityID  string    `json:"entityId" gorm:"index;size:36;not null"`
	Details   string    `json:"details" gorm:"type:text"`
	IPAddress string    `json:"ipAddress" gorm:"size:45"`
	Timestamp time.Time `json:"timestamp" gorm:"index;autoCreateTime"`
}
