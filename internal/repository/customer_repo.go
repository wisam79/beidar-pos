package repository

import (
	"beidar-desktop/internal/core/domain"
	"gorm.io/gorm"
)

type customerRepository struct {
	db *gorm.DB
}

func NewCustomerRepository(db *gorm.DB) domain.CustomerRepository {
	return &customerRepository{db: db}
}

func (r *customerRepository) WithTx(tx domain.Tx) domain.CustomerRepository {
	return &customerRepository{db: getDB(tx, r.db)}
}

func (r *customerRepository) Transaction(fn func(tx domain.Tx) error) error {
	return r.db.Transaction(func(gdb *gorm.DB) error {
		return fn(domain.NewTx(gdb))
	})
}

func (r *customerRepository) GetAll() ([]domain.Customer, error) {
	var customers []domain.Customer
	err := r.db.Find(&customers).Error
	return customers, err
}

func (r *customerRepository) GetByID(id string) (*domain.Customer, error) {
	var customer domain.Customer
	if err := r.db.First(&customer, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &customer, nil
}

func (r *customerRepository) GetByPhone(phone string) (*domain.Customer, error) {
	var customer domain.Customer
	if err := r.db.First(&customer, "phone = ?", phone).Error; err != nil {
		return nil, err
	}
	return &customer, nil
}

func (r *customerRepository) Create(customer *domain.Customer) error {
	return r.db.Create(customer).Error
}

func (r *customerRepository) Update(customer *domain.Customer) error {
	return r.db.Save(customer).Error
}

func (r *customerRepository) Updates(id string, updates map[string]interface{}) error {
	return r.db.Model(&domain.Customer{}).Where("id = ?", id).Updates(updates).Error
}

func (r *customerRepository) Delete(id string) error {
	return r.db.Delete(&domain.Customer{}, "id = ?", id).Error
}

func (r *customerRepository) Search(query string) ([]domain.Customer, error) {
	var customers []domain.Customer
	err := r.db.Where("name LIKE ? OR phone LIKE ?", "%"+query+"%", "%"+query+"%").Find(&customers).Error
	return customers, err
}

func (r *customerRepository) GetActiveInstallmentsCount(customerID string) (int64, error) {
	var count int64
	err := r.db.Model(&domain.Sale{}).
		Where("customer_id = ? AND payment_method = ? AND status != ?", customerID, "installment", "paid").
		Count(&count).Error
	return count, err
}

func (r *customerRepository) DecrementPurchases(id string, amount domain.Amount) error {
	return r.db.Model(&domain.Customer{}).
		Where("id = ?", id).
		UpdateColumn("total_purchases", gorm.Expr("CASE WHEN total_purchases - ? < 0 THEN 0 ELSE total_purchases - ? END", amount.Cents(), amount.Cents())).
		Error
}

func (r *customerRepository) AdjustPoints(id string, delta int) error {
	if delta >= 0 {
		return r.db.Model(&domain.Customer{}).
			Where("id = ?", id).
			UpdateColumn("points", gorm.Expr("points + ?", delta)).
			Error
	}
	absDelta := -delta
	return r.db.Model(&domain.Customer{}).
		Where("id = ?", id).
		UpdateColumn("points", gorm.Expr("CASE WHEN points - ? < 0 THEN 0 ELSE points - ? END", absDelta, absDelta)).
		Error
}

func (r *customerRepository) DecrementDebt(id string, amount domain.Amount) error {
	return r.db.Model(&domain.Customer{}).
		Where("id = ?", id).
		UpdateColumn("debt", gorm.Expr("debt - ?", amount.Cents())).
		Error
}

func (r *customerRepository) DecrementInstallmentDebt(id string, amount domain.Amount) error {
	return r.db.Model(&domain.Customer{}).
		Where("id = ?", id).
		UpdateColumn("installment_debt", gorm.Expr("installment_debt - ?", amount.Cents())).
		Error
}
