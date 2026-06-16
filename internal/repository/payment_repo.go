package repository

import (
	"beidar-desktop/internal/core/domain"
	"gorm.io/gorm"
)

type paymentRepository struct {
	db *gorm.DB
}

func NewPaymentRepository(db *gorm.DB) domain.PaymentRepository {
	return &paymentRepository{db: db}
}

func (r *paymentRepository) WithTx(tx domain.Tx) domain.PaymentRepository {
	return &paymentRepository{db: getDB(tx, r.db)}
}

func (r *paymentRepository) Transaction(fn func(tx domain.Tx) error) error {
	return r.db.Transaction(func(gdb *gorm.DB) error {
		return fn(domain.NewTx(gdb))
	})
}

func (r *paymentRepository) Create(payment *domain.Payment) error {
	return r.db.Create(payment).Error
}

func (r *paymentRepository) GetPaymentsBySale(saleID string) ([]domain.Payment, error) {
	var payments []domain.Payment
	err := r.db.Where("sale_id = ?", saleID).Order("timestamp desc").Find(&payments).Error
	return payments, err
}

func (r *paymentRepository) GetPaymentsByCustomer(customerID string) ([]domain.Payment, error) {
	var payments []domain.Payment
	err := r.db.Where("customer_id = ?", customerID).Order("timestamp desc").Find(&payments).Error
	return payments, err
}

func (r *paymentRepository) GetByID(id uint) (*domain.Payment, error) {
	var payment domain.Payment
	if err := r.db.First(&payment, id).Error; err != nil {
		return nil, err
	}
	return &payment, nil
}

func (r *paymentRepository) Delete(id uint) error {
	return r.db.Delete(&domain.Payment{}, id).Error
}
