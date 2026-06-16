package repository

import (
	"beidar-desktop/internal/core/domain"
	"gorm.io/gorm"
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

func (r *supplierRepository) GetByID(id string) (*domain.Supplier, error) {
	var supplier domain.Supplier
	if err := r.db.First(&supplier, "id = ?", id).Error; err != nil {
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

func (r *supplierRepository) UpdateBalance(id string, amount domain.Amount) error {
	return r.db.Model(&domain.Supplier{}).Where("id = ?", id).UpdateColumn("balance", gorm.Expr("balance - ?", amount.Cents())).Error
}

func (r *supplierRepository) Delete(id string) error {
	return r.db.Delete(&domain.Supplier{}, "id = ?", id).Error
}
