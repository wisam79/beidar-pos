package repository

import (
	"beidar-desktop/internal/core/domain"
	"gorm.io/gorm"
)

type networkRepository struct {
	db *gorm.DB
}

func NewNetworkRepository(db *gorm.DB) domain.NetworkRepository {
	return &networkRepository{db: db}
}

func (r *networkRepository) BlockDevice(device *domain.BlockedDevice) error {
	return r.db.Create(device).Error
}

func (r *networkRepository) UnblockDevice(id uint) error {
	result := r.db.Delete(&domain.BlockedDevice{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *networkRepository) GetBlockedDevices() ([]domain.BlockedDevice, error) {
	var devices []domain.BlockedDevice
	err := r.db.Order("blocked_at desc").Find(&devices).Error
	return devices, err
}

func (r *networkRepository) IsDeviceBlocked(deviceID string) (bool, error) {
	var count int64
	err := r.db.Model(&domain.BlockedDevice{}).Where("device_id = ?", deviceID).Count(&count).Error
	return count > 0, err
}
