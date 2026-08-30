package repository

import (
	"beidar-desktop/internal/core/domain"
	"errors"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
	if customers == nil {
		customers = []domain.Customer{}
	}
	return customers, err
}

func (r *customerRepository) GetCustomersPaged(page int, pageSize int, search string) (*domain.PaginatedCustomers, error) {
	const maxPageSize = 200
	if pageSize <= 0 || pageSize > maxPageSize {
		pageSize = 50
	}
	if page < 1 {
		page = 1
	}

	query := r.db.Model(&domain.Customer{})

	if search != "" {
		trimmed := strings.TrimSpace(search)
		query = query.Where("name LIKE ? OR phone LIKE ? OR notes LIKE ?", "%"+trimmed+"%", "%"+trimmed+"%", "%"+trimmed+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	offset := (page - 1) * pageSize
	var customers []domain.Customer
	if err := query.Order("name ASC").Offset(offset).Limit(pageSize).Find(&customers).Error; err != nil {
		return nil, err
	}

	totalPages := int(total) / pageSize
	if pageSize > 0 && int(total)%pageSize > 0 {
		totalPages++
	}

	if customers == nil {
		customers = []domain.Customer{}
	}

	return &domain.PaginatedCustomers{
		Data:       customers,
		Total:      total,
		TotalPages: totalPages,
		Page:       page,
		PageSize:   pageSize,
	}, nil
}

func (r *customerRepository) GetByID(id string) (*domain.Customer, error) {
	var customer domain.Customer
	if err := r.db.First(&customer, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrRecordNotFound
		}
		return nil, err
	}
	return &customer, nil
}

func (r *customerRepository) GetForUpdate(id string) (*domain.Customer, error) {
	var customer domain.Customer
	if err := r.db.Clauses(clause.Locking{Strength: "UPDATE"}).First(&customer, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrRecordNotFound
		}
		return nil, err
	}
	return &customer, nil
}

func (r *customerRepository) GetByIDs(ids []string) ([]domain.Customer, error) {
	if len(ids) == 0 {
		return []domain.Customer{}, nil
	}
	var customers []domain.Customer
	err := r.db.Find(&customers, "id IN ?", ids).Error
	if customers == nil {
		customers = []domain.Customer{}
	}
	return customers, err
}

func (r *customerRepository) GetByPhone(phone string) (*domain.Customer, error) {
	var customer domain.Customer
	if err := r.db.First(&customer, "phone = ?", phone).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrRecordNotFound
		}
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
	if customers == nil {
		customers = []domain.Customer{}
	}
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
	// Clamp at zero so concurrent decrements can never push debt below 0
	// (mirrors the CASE WHEN pattern used by DecrementPurchases).
	return r.db.Model(&domain.Customer{}).
		Where("id = ?", id).
		UpdateColumn("debt", gorm.Expr("CASE WHEN debt - ? < 0 THEN 0 ELSE debt - ? END", amount.Cents(), amount.Cents())).
		Error
}

func (r *customerRepository) DecrementInstallmentDebt(id string, amount domain.Amount) error {
	// Clamp at zero to prevent negative installment balances.
	return r.db.Model(&domain.Customer{}).
		Where("id = ?", id).
		UpdateColumn("installment_debt", gorm.Expr("CASE WHEN installment_debt - ? < 0 THEN 0 ELSE installment_debt - ? END", amount.Cents(), amount.Cents())).
		Error
}

func (r *customerRepository) IncrementPurchasesAndDebt(id string, totalPurchases domain.Amount, points int, debtIncrease domain.Amount, installmentDebtIncrease domain.Amount, lastVisit string) error {
	updates := map[string]interface{}{
		"total_purchases": gorm.Expr("total_purchases + ?", totalPurchases.Cents()),
		"last_visit":      lastVisit,
		"points":          gorm.Expr("points + ?", points),
	}
	if debtIncrease > 0 {
		updates["debt"] = gorm.Expr("debt + ?", debtIncrease.Cents())
	}
	if installmentDebtIncrease > 0 {
		updates["installment_debt"] = gorm.Expr("installment_debt + ?", installmentDebtIncrease.Cents())
	}
	return r.db.Model(&domain.Customer{}).Where("id = ?", id).Updates(updates).Error
}

