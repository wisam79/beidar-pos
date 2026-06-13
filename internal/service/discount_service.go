package service

import (
	"beidar-desktop/internal/core/domain"
	pkgerrors "beidar-desktop/pkg/errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type DiscountService interface {
	GetDiscounts() ([]domain.Discount, error)
	GetActiveDiscounts() ([]domain.Discount, error)
	GetDiscount(id string) (*domain.Discount, error)
	CreateDiscount(d domain.Discount) (*domain.Discount, error)
	UpdateDiscount(d domain.Discount) error
	DeleteDiscount(id string) error
	ToggleDiscountStatus(id string) error
	ValidateCoupon(code string) (*domain.Discount, error)
	ApplyDiscount(id string) error
	CalculateDiscountAmount(discountID string, subtotal domain.Amount, itemsCount int) (domain.Amount, error)
}

type discountService struct {
	discountRepo domain.DiscountRepository
}

func NewDiscountService(discountRepo domain.DiscountRepository) DiscountService {
	return &discountService{discountRepo: discountRepo}
}

func (s *discountService) GetDiscounts() ([]domain.Discount, error) {
	discounts, err := s.discountRepo.GetDiscounts()
	if err != nil {
		return nil, fmt.Errorf("failed to get discounts: %w", err)
	}
	return discounts, nil
}

func (s *discountService) GetActiveDiscounts() ([]domain.Discount, error) {
	now := time.Now().Format("2006-01-02")
	discounts, err := s.discountRepo.GetActiveDiscounts(now)
	if err != nil {
		return nil, fmt.Errorf("failed to get active discounts: %w", err)
	}
	return discounts, nil
}

func (s *discountService) GetDiscount(id string) (*domain.Discount, error) {
	discount, err := s.discountRepo.GetDiscountByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get discount by ID: %w", err)
	}
	return discount, nil
}

func (s *discountService) CreateDiscount(d domain.Discount) (*domain.Discount, error) {
	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	d.CreatedAt = time.Now().Unix()
	d.UsageCount = 0

	if err := s.discountRepo.CreateDiscount(&d); err != nil {
		return nil, fmt.Errorf("failed to create discount: %w", err)
	}
	return &d, nil
}

func (s *discountService) UpdateDiscount(d domain.Discount) error {
	err := s.discountRepo.UpdateDiscount(&d)
	if err != nil {
		return fmt.Errorf("failed to update discount: %w", err)
	}
	return nil
}

func (s *discountService) DeleteDiscount(id string) error {
	err := s.discountRepo.DeleteDiscount(id)
	if err != nil {
		return fmt.Errorf("failed to delete discount: %w", err)
	}
	return nil
}

func (s *discountService) ToggleDiscountStatus(id string) error {
	d, err := s.discountRepo.GetDiscountByID(id)
	if err != nil {
		return fmt.Errorf("failed to get discount for toggle: %w", err)
	}
	d.Active = !d.Active
	err = s.discountRepo.UpdateDiscount(d)
	if err != nil {
		return fmt.Errorf("failed to update discount status: %w", err)
	}
	return nil
}

func (s *discountService) ValidateCoupon(code string) (*domain.Discount, error) {
	now := time.Now().Format("2006-01-02")
	discount, err := s.discountRepo.ValidateCoupon(code, now)
	if err != nil {
		return nil, fmt.Errorf("failed to validate coupon: %w", err)
	}
	return discount, nil
}

func (s *discountService) ApplyDiscount(id string) error {
	err := s.discountRepo.IncrementUsageCount(id)
	if err != nil {
		return fmt.Errorf("failed to apply discount: %w", err)
	}
	return nil
}

func (s *discountService) CalculateDiscountAmount(discountID string, subtotal domain.Amount, itemsCount int) (domain.Amount, error) {
	d, err := s.discountRepo.GetDiscountByID(discountID)
	if err != nil {
		return domain.Zero(), fmt.Errorf("failed to get discount for calculation: %w", err)
	}

	// Check minimum purchase
	if d.MinPurchase > 0 && subtotal < d.MinPurchase {
		return domain.Zero(), nil
	}

	var discountAmount domain.Amount

	switch d.Type {
	case "percentage":
		discountAmount = subtotal.Percentage(d.Value)
	case "fixed":
		discountAmount = domain.NewAmount(d.Value)
	case "quantity":
		if itemsCount >= int(d.Value) {
			discountAmount = subtotal.Percentage(10) // 10% discount
		}
	case "buyXgetY":
		if itemsCount >= int(d.Value) {
			discountAmount = subtotal.Div(int64(itemsCount)) // One item free
		}
	default:
		return domain.Zero(), pkgerrors.NewAppError(pkgerrors.ModuleProduct, "INVALID_DISCOUNT_TYPE", "نوع الخصم غير صالح", "", "type")
	}

	// Apply max discount cap
	if d.MaxDiscount > 0 && discountAmount > d.MaxDiscount {
		discountAmount = d.MaxDiscount
	}

	return discountAmount, nil
}
