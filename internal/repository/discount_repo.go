package repository

import (
	"errors"
	"fmt"

	"beidar-desktop/internal/core/domain"
	"gorm.io/gorm"
)

type discountRepository struct {
	db *gorm.DB
}

func NewDiscountRepository(db *gorm.DB) domain.DiscountRepository {
	return &discountRepository{db: db}
}

func (r *discountRepository) GetDiscounts() ([]domain.Discount, error) {
	var discounts []domain.Discount
	err := r.db.Order("created_at desc").Find(&discounts).Error
	if discounts == nil {
		discounts = []domain.Discount{}
	}
	return discounts, err
}

func (r *discountRepository) GetActiveDiscounts(now string) ([]domain.Discount, error) {
	var discounts []domain.Discount
	err := r.db.Where("active = ? AND (start_date IS NULL OR start_date = '' OR start_date <= ?) AND (end_date IS NULL OR end_date = '' OR end_date >= ?)", true, now, now).Find(&discounts).Error
	if discounts == nil {
		discounts = []domain.Discount{}
	}
	return discounts, err
}

func (r *discountRepository) GetDiscountByID(id string) (*domain.Discount, error) {
	var d domain.Discount
	if err := r.db.First(&d, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrRecordNotFound
		}
		return nil, err
	}
	return &d, nil
}

func (r *discountRepository) CreateDiscount(d *domain.Discount) error {
	return r.db.Create(d).Error
}

func (r *discountRepository) UpdateDiscount(d *domain.Discount) error {
	return r.db.Save(d).Error
}

func (r *discountRepository) DeleteDiscount(id string) error {
	return r.db.Delete(&domain.Discount{}, "id = ?", id).Error
}

func (r *discountRepository) ValidateCoupon(code string, now string) (*domain.Discount, error) {
	var d domain.Discount
	err := r.db.Where(
		"code = ? AND active = ? AND (start_date IS NULL OR start_date = '' OR start_date <= ?) AND (end_date IS NULL OR end_date = '' OR end_date >= ?) AND (usage_limit = 0 OR usage_count < usage_limit)",
		code, true, now, now,
	).First(&d).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrRecordNotFound
		}
		return nil, err
	}
	return &d, nil
}

func (r *discountRepository) IncrementUsageCount(id string) error {
	res := r.db.Model(&domain.Discount{}).
		Where("id = ? AND (usage_limit = 0 OR usage_count < usage_limit)", id).
		Update("usage_count", gorm.Expr("usage_count + 1"))
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("discount usage limit reached")
	}
	return nil
}
