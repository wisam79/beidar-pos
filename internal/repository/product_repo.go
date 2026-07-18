package repository

import (
	"beidar-desktop/internal/core/domain"
	"gorm.io/gorm"
)

// productRepository is the SQLite/Gorm implementation of domain.ProductRepository
type productRepository struct {
	db *gorm.DB
}

// NewProductRepository creates a new instance of domain.ProductRepository
func NewProductRepository(db *gorm.DB) domain.ProductRepository {
	return &productRepository{
		db: db,
	}
}

func (r *productRepository) WithTx(tx domain.Tx) domain.ProductRepository {
	return &productRepository{
		db: getDB(tx, r.db),
	}
}

func (r *productRepository) Transaction(fn func(tx domain.Tx) error) error {
	return r.db.Transaction(func(gdb *gorm.DB) error {
		return fn(domain.NewTx(gdb))
	})
}

func (r *productRepository) GetAll() ([]domain.Product, error) {
	var products []domain.Product
	if err := r.db.Select("id, name, barcode, price, cost, stock, min_stock, category, CASE WHEN length(image) > 500 THEN '' ELSE image END as image, supplier, wholesale_price, description, custom_details").Find(&products).Error; err != nil {
		return nil, err
	}
	return products, nil
}

func (r *productRepository) GetByID(id string) (*domain.Product, error) {
	var product domain.Product
	if err := r.db.First(&product, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *productRepository) GetByIDs(ids []string) ([]domain.Product, error) {
	if len(ids) == 0 {
		return []domain.Product{}, nil
	}
	var products []domain.Product
	if err := r.db.Select("id, name, barcode, price, cost, stock, min_stock, category, CASE WHEN length(image) > 500 THEN '' ELSE image END as image, supplier, wholesale_price, description, custom_details").Where("id IN ?", ids).Find(&products).Error; err != nil {
		return nil, err
	}
	return products, nil
}

func (r *productRepository) Create(product *domain.Product) error {
	return r.db.Create(product).Error
}

func (r *productRepository) Update(product *domain.Product) error {
	return r.db.Save(product).Error
}

func (r *productRepository) Delete(id string) error {
	return r.db.Delete(&domain.Product{}, "id = ?", id).Error
}

func (r *productRepository) Search(query string) ([]domain.Product, error) {
	var products []domain.Product
	if err := r.db.Select("id, name, barcode, price, cost, stock, min_stock, category, CASE WHEN length(image) > 500 THEN '' ELSE image END as image, supplier, wholesale_price, description, custom_details").Where("name LIKE ? OR barcode LIKE ?", "%"+query+"%", "%"+query+"%").Find(&products).Error; err != nil {
		return nil, err
	}
	return products, nil
}

func (r *productRepository) UpdateStock(id string, qty float64) error {
	result := r.db.Model(&domain.Product{}).
		Where("id = ? AND stock + ? >= 0", id, qty).
		UpdateColumn("stock", gorm.Expr("stock + ?", qty))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return domain.ErrInsufficientStock
	}
	return nil
}

func (r *productRepository) CreateStockMovement(movement *domain.StockMovement) error {
	return r.db.Create(movement).Error
}

func (r *productRepository) GetStockMovements() ([]domain.StockMovement, error) {
	var moves []domain.StockMovement
	err := r.db.Order("timestamp desc").Limit(200).Find(&moves).Error
	return moves, err
}

func (r *productRepository) CountBySupplier(supplierName string) (int64, error) {
	var count int64
	err := r.db.Model(&domain.Product{}).Where("supplier = ?", supplierName).Count(&count).Error
	return count, err
}

func (r *productRepository) UnlinkSupplier(supplierName string) error {
	return r.db.Model(&domain.Product{}).Where("supplier = ?", supplierName).Update("supplier", "").Error
}

func (r *productRepository) GetByBarcode(barcode string) (*domain.Product, error) {
	var product domain.Product
	if err := r.db.First(&product, "barcode = ?", barcode).Error; err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *productRepository) GetProductsWithBase64Images() ([]domain.Product, error) {
	var products []domain.Product
	// base64 images are typically long strings (> 200 characters)
	if err := r.db.Where("length(image) > ?", 200).Find(&products).Error; err != nil {
		return nil, err
	}
	return products, nil
}

func (r *productRepository) CountProductsWithBase64Images() (int64, error) {
	var count int64
	err := r.db.Model(&domain.Product{}).Where("length(image) > ?", 200).Count(&count).Error
	return count, err
}

func (r *productRepository) Vacuum() error {
	return r.db.Exec("VACUUM").Error
}

