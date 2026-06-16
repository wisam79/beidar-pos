package repository

import (
	"beidar-desktop/internal/core/domain"
	"time"

	"gorm.io/gorm"
)

type saleRepository struct {
	db *gorm.DB
}

func NewSaleRepository(db *gorm.DB) domain.SaleRepository {
	return &saleRepository{db: db}
}

func (r *saleRepository) WithTx(tx domain.Tx) domain.SaleRepository {
	return &saleRepository{db: getDB(tx, r.db)}
}

func (r *saleRepository) Transaction(fn func(tx domain.Tx) error) error {
	return r.db.Transaction(func(gdb *gorm.DB) error {
		return fn(domain.NewTx(gdb))
	})
}

func (r *saleRepository) GetCustomerInstallments(customerID string) ([]domain.Sale, error) {
	var sales []domain.Sale
	err := r.db.Where("customer_id = ? AND payment_method = ?", customerID, "installment").
		Order("timestamp desc").
		Find(&sales).Error
	return sales, err
}

const maxPageSize = 200

func (r *saleRepository) GetSales(page int, pageSize int, search string, statusFilter string, dateFilter string) (*domain.PaginatedSales, error) {
	var sales []domain.Sale
	var total int64

	if pageSize <= 0 || pageSize > maxPageSize {
		pageSize = maxPageSize
	}

	query := r.db.Model(&domain.Sale{})

	if search != "" {
		query = query.Where("id LIKE ? OR customer_name LIKE ?", "%"+search+"%", "%"+search+"%")
	}

	if statusFilter != "" && statusFilter != "all" {
		query = query.Where("status = ?", statusFilter)
	}

	if dateFilter != "" && dateFilter != "all" {
		now := time.Now()
		switch dateFilter {
		case "today":
			y, m, d := now.Date()
			startOfDay := time.Date(y, m, d, 0, 0, 0, 0, now.Location()).UnixMilli()
			query = query.Where("timestamp >= ?", startOfDay)
		case "week":
			startOfWeek := now.AddDate(0, 0, -7).UnixMilli()
			query = query.Where("timestamp >= ?", startOfWeek)
		}
	}

	var stats domain.InvoiceStats
	type DBStats struct {
		Count   int64
		Total   int64
		Pending int64
		Returns int64
	}
	var dbStats DBStats

	statsQuery := query.Session(&gorm.Session{})
	statsQuery.Select("COUNT(*) as count, IFNULL(SUM(total),0) as total, IFNULL(SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END),0) as returns, IFNULL(SUM(CASE WHEN status = 'pending' THEN total ELSE 0 END),0) as pending").Scan(&dbStats)

	stats.Count = dbStats.Count
	stats.Total = domain.Amount(dbStats.Total)
	stats.Returns = dbStats.Returns
	stats.Pending = domain.Amount(dbStats.Pending)
	total = dbStats.Count

	offset := page * pageSize
	result := query.Preload("Items").Order("timestamp desc").Offset(offset).Limit(pageSize).Find(&sales)

	if result.Error != nil {
		return nil, result.Error
	}

	totalPages := int(total) / pageSize
	if pageSize > 0 && int(total)%pageSize > 0 {
		totalPages++
	}

	return &domain.PaginatedSales{
		Data:       sales,
		Total:      total,
		TotalPages: totalPages,
		Page:       page,
		Stats:      stats,
	}, nil
}

func (r *saleRepository) GetByID(id string) (*domain.Sale, error) {
	var sale domain.Sale
	if err := r.db.Preload("Items").First(&sale, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &sale, nil
}

func (r *saleRepository) Create(sale *domain.Sale) error {
	return r.db.Create(sale).Error
}

func (r *saleRepository) Update(sale *domain.Sale) error {
	return r.db.Save(sale).Error
}

func (r *saleRepository) GetSaleItems(saleID string) ([]domain.SaleItem, error) {
	var items []domain.SaleItem
	err := r.db.Where("sale_id = ?", saleID).Find(&items).Error
	return items, err
}

func (r *saleRepository) UpdateSaleItem(item *domain.SaleItem) error {
	return r.db.Save(item).Error
}

func (r *saleRepository) GetSaleItem(saleID string, productID string) (*domain.SaleItem, error) {
	var item domain.SaleItem
	if err := r.db.Where("sale_id = ? AND product_id = ?", saleID, productID).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *saleRepository) ParkSale(parked *domain.ParkedSale) error {
	return r.db.Create(parked).Error
}

func (r *saleRepository) GetParkedSales() ([]domain.ParkedSale, error) {
	var parked []domain.ParkedSale
	if err := r.db.Order("created_at desc").Find(&parked).Error; err != nil {
		return nil, err
	}
	return parked, nil
}

func (r *saleRepository) GetParkedSalesCount() (int, error) {
	var count int64
	if err := r.db.Model(&domain.ParkedSale{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return int(count), nil
}

func (r *saleRepository) RetrieveParkedSale(id uint) (*domain.ParkedSale, error) {
	var parked domain.ParkedSale
	if err := r.db.First(&parked, id).Error; err != nil {
		return nil, err
	}
	if err := r.db.Delete(&parked).Error; err != nil {
		return nil, err
	}
	return &parked, nil
}

func (r *saleRepository) DeleteParkedSale(id uint) error {
	return r.db.Delete(&domain.ParkedSale{}, id).Error
}

func (r *saleRepository) GetUnsyncedSales() ([]domain.Sale, error) {
	var sales []domain.Sale
	err := r.db.Preload("Items").Where("zoho_synced = ?", false).Find(&sales).Error
	return sales, err
}

func (r *saleRepository) MarkSaleAsSynced(id string) error {
	return r.db.Model(&domain.Sale{}).Where("id = ?", id).Update("zoho_synced", true).Error
}

func (r *saleRepository) UpdateSaleInstallmentPlan(saleID string, planJSON string, status string) error {
	return r.db.Model(&domain.Sale{}).Where("id = ?", saleID).Updates(map[string]interface{}{
		"installment_plan": planJSON,
		"status":           status,
	}).Error
}

func (r *saleRepository) GetInstallmentSales() ([]domain.Sale, error) {
	var sales []domain.Sale
	err := r.db.Where("payment_method = ?", "installment").
		Preload("Items").
		Order("timestamp desc").
		Find(&sales).Error
	return sales, err
}
