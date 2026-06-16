package repository

import (
	"beidar-desktop/internal/core/domain"
	"gorm.io/gorm"
)

type staffRepository struct {
	db *gorm.DB
}

func NewStaffRepository(db *gorm.DB) domain.StaffRepository {
	return &staffRepository{db: db}
}

func (r *staffRepository) WithTx(tx domain.Tx) domain.StaffRepository {
	return &staffRepository{db: getDB(tx, r.db)}
}

func (r *staffRepository) Transaction(fn func(tx domain.Tx) error) error {
	return r.db.Transaction(func(gdb *gorm.DB) error {
		return fn(domain.NewTx(gdb))
	})
}

func (r *staffRepository) GetByID(id string) (*domain.Staff, error) {
	var s domain.Staff
	if err := r.db.First(&s, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *staffRepository) GetByUsername(username string) (*domain.Staff, error) {
	var s domain.Staff
	if err := r.db.First(&s, "username = ?", username).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *staffRepository) GetByFastPIN(fastPIN string) (*domain.Staff, error) {
	var s domain.Staff
	if err := r.db.Where("fast_pin = ? AND active = ?", fastPIN, true).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *staffRepository) GetAll() ([]domain.Staff, error) {
	var staff []domain.Staff
	err := r.db.Order("created_at DESC").Find(&staff).Error
	return staff, err
}

func (r *staffRepository) GetActive() ([]domain.Staff, error) {
	var staff []domain.Staff
	err := r.db.Where("active = ?", true).Order("name ASC").Find(&staff).Error
	return staff, err
}

func (r *staffRepository) Create(staff *domain.Staff) error {
	return r.db.Create(staff).Error
}

func (r *staffRepository) Update(staff *domain.Staff) error {
	return r.db.Save(staff).Error
}

func (r *staffRepository) Updates(id string, updates map[string]interface{}) error {
	return r.db.Model(&domain.Staff{}).Where("id = ?", id).Updates(updates).Error
}

func (r *staffRepository) Delete(id string) error {
	return r.db.Delete(&domain.Staff{}, "id = ?", id).Error
}

func (r *staffRepository) GetStaffCount() (int64, error) {
	var count int64
	err := r.db.Model(&domain.Staff{}).Count(&count).Error
	return count, err
}

func (r *staffRepository) CountByRole(role domain.Role) (int64, error) {
	var count int64
	err := r.db.Model(&domain.Staff{}).Where("role = ?", role).Count(&count).Error
	return count, err
}

func (r *staffRepository) GetStaffSalesCount(staffID string) (int64, error) {
	var count int64
	err := r.db.Model(&domain.Sale{}).Where("staff_id = ?", staffID).Count(&count).Error
	return count, err
}

func (r *staffRepository) GetStaffPaymentsCount(staffID string) (int64, error) {
	var count int64
	err := r.db.Model(&domain.Payment{}).Where("staff_id = ?", staffID).Count(&count).Error
	return count, err
}

func (r *staffRepository) GetLoginAttempt(identifier string) (*domain.LoginAttempt, error) {
	var attempt domain.LoginAttempt
	if err := r.db.Where("identifier = ?", identifier).First(&attempt).Error; err != nil {
		return nil, err
	}
	return &attempt, nil
}

func (r *staffRepository) SaveLoginAttempt(attempt *domain.LoginAttempt) error {
	return r.db.Save(attempt).Error
}

func (r *staffRepository) DeleteLoginAttempt(identifier string) error {
	return r.db.Where("identifier = ?", identifier).Delete(&domain.LoginAttempt{}).Error
}
