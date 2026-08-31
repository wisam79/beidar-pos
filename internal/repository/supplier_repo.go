package repository

import (
	"beidar-desktop/internal/core/domain"
	"errors"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type supplierRepository struct {
	db *gorm.DB
}

func NewSupplierRepository(db *gorm.DB) domain.SupplierRepository {
	return &supplierRepository{db: db}
}

func (r *supplierRepository) WithTx(tx domain.Tx) domain.SupplierRepository {
	return &supplierRepository{db: getDB(tx, r.db)}
}

func (r *supplierRepository) Transaction(fn func(tx domain.Tx) error) error {
	return r.db.Transaction(func(gdb *gorm.DB) error {
		return fn(domain.NewTx(gdb))
	})
}

func (r *supplierRepository) GetAll() ([]domain.Supplier, error) {
	var suppliers []domain.Supplier
	err := r.db.Find(&suppliers).Error
	return suppliers, err
}

func (r *supplierRepository) GetSuppliersPaged(page int, pageSize int, search string) (*domain.PaginatedSuppliers, error) {
	const maxPageSize = 200
	if pageSize <= 0 || pageSize > maxPageSize {
		pageSize = 50
	}
	if page < 1 {
		page = 1
	}

	query := r.db.Model(&domain.Supplier{})

	if search != "" {
		trimmed := strings.TrimSpace(search)
		query = query.Where("name LIKE ? OR company_name LIKE ? OR phone LIKE ? OR email LIKE ? OR notes LIKE ?",
			"%"+trimmed+"%", "%"+trimmed+"%", "%"+trimmed+"%", "%"+trimmed+"%", "%"+trimmed+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	offset := (page - 1) * pageSize
	var suppliers []domain.Supplier
	if err := query.Order("name ASC").Offset(offset).Limit(pageSize).Find(&suppliers).Error; err != nil {
		return nil, err
	}

	totalPages := int(total) / pageSize
	if pageSize > 0 && int(total)%pageSize > 0 {
		totalPages++
	}

	if suppliers == nil {
		suppliers = []domain.Supplier{}
	}

	return &domain.PaginatedSuppliers{
		Data:       suppliers,
		Total:      total,
		TotalPages: totalPages,
		Page:       page,
		PageSize:   pageSize,
	}, nil
}

func (r *supplierRepository) GetByID(id string) (*domain.Supplier, error) {
	var supplier domain.Supplier
	if err := r.db.First(&supplier, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrRecordNotFound
		}
		return nil, err
	}
	return &supplier, nil
}

func (r *supplierRepository) GetForUpdate(id string) (*domain.Supplier, error) {
	var supplier domain.Supplier
	if err := r.db.Clauses(clause.Locking{Strength: "UPDATE"}).First(&supplier, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrRecordNotFound
		}
		return nil, err
	}
	return &supplier, nil
}

func (r *supplierRepository) Create(supplier *domain.Supplier) error {
	return r.db.Create(supplier).Error
}

func (r *supplierRepository) Update(supplier *domain.Supplier) error {
	return r.db.Save(supplier).Error
}

func (r *supplierRepository) Updates(id string, updates map[string]interface{}) error {
	return r.db.Model(&domain.Supplier{}).Where("id = ?", id).Updates(updates).Error
}

func (r *supplierRepository) UpdateBalance(id string, amount domain.Amount) error {
	return r.db.Model(&domain.Supplier{}).
		Where("id = ?", id).
		UpdateColumn("balance", gorm.Expr("CASE WHEN balance - ? < 0 THEN 0 ELSE balance - ? END", amount.Cents(), amount.Cents())).
		Error
}

func (r *supplierRepository) Delete(id string) error {
	return r.db.Delete(&domain.Supplier{}, "id = ?", id).Error
}
