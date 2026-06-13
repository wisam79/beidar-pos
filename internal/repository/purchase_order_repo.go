package repository

import (
	"beidar-desktop/internal/core/domain"
	"gorm.io/gorm"
)

type purchaseOrderRepository struct {
	db *gorm.DB
}

func NewPurchaseOrderRepository(db *gorm.DB) domain.PurchaseOrderRepository {
	return &purchaseOrderRepository{db: db}
}

func (r *purchaseOrderRepository) WithTx(tx *gorm.DB) domain.PurchaseOrderRepository {
	return &purchaseOrderRepository{db: tx}
}

func (r *purchaseOrderRepository) Transaction(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
}

func (r *purchaseOrderRepository) GetByID(id string) (*domain.PurchaseOrder, error) {
	var order domain.PurchaseOrder
	if err := r.db.Preload("Items").First(&order, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &order, nil
}

func (r *purchaseOrderRepository) GetPurchaseOrders(status string, supplierID string) ([]domain.PurchaseOrder, error) {
	var orders []domain.PurchaseOrder
	query := r.db.Preload("Items").Order("created_at DESC")

	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	if supplierID != "" {
		query = query.Where("supplier_id = ?", supplierID)
	}

	if err := query.Find(&orders).Error; err != nil {
		return nil, err
	}
	return orders, nil
}

func (r *purchaseOrderRepository) Create(order *domain.PurchaseOrder) error {
	return r.db.Create(order).Error
}

func (r *purchaseOrderRepository) Update(order *domain.PurchaseOrder) error {
	return r.db.Save(order).Error
}

func (r *purchaseOrderRepository) Delete(id string) error {
	return r.db.Delete(&domain.PurchaseOrder{}, "id = ?", id).Error
}

func (r *purchaseOrderRepository) DeleteItemsByOrderID(orderID string) error {
	return r.db.Where("order_id = ?", orderID).Delete(&domain.PurchaseOrderItem{}).Error
}

func (r *purchaseOrderRepository) UpdateItemReceivedQty(itemID uint, newReceivedQty float64) error {
	return r.db.Model(&domain.PurchaseOrderItem{}).Where("id = ?", itemID).Update("received_qty", newReceivedQty).Error
}

func (r *purchaseOrderRepository) GetOrderItem(orderID string, productID string) (*domain.PurchaseOrderItem, error) {
	var item domain.PurchaseOrderItem
	if err := r.db.Where("order_id = ? AND product_id = ?", orderID, productID).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *purchaseOrderRepository) GetOrderItems(orderID string) ([]domain.PurchaseOrderItem, error) {
	var items []domain.PurchaseOrderItem
	if err := r.db.Where("order_id = ?", orderID).Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *purchaseOrderRepository) GetPurchaseOrderStats() (map[string]interface{}, error) {
	var stats struct {
		TotalOrders   int64   `json:"totalOrders"`
		PendingOrders int64   `json:"pendingOrders"`
		TotalValue    float64 `json:"totalValue"`
		TotalPaid     float64 `json:"totalPaid"`
		TotalUnpaid   float64 `json:"totalUnpaid"`
	}

	r.db.Model(&domain.PurchaseOrder{}).Count(&stats.TotalOrders)
	r.db.Model(&domain.PurchaseOrder{}).Where("status IN ?", []string{"pending", "partial"}).Count(&stats.PendingOrders)
	r.db.Model(&domain.PurchaseOrder{}).Select("COALESCE(SUM(total_amount), 0)").Scan(&stats.TotalValue)
	r.db.Model(&domain.PurchaseOrder{}).Select("COALESCE(SUM(paid_amount), 0)").Scan(&stats.TotalPaid)
	stats.TotalUnpaid = stats.TotalValue - stats.TotalPaid

	return map[string]interface{}{
		"totalOrders":   stats.TotalOrders,
		"pendingOrders": stats.PendingOrders,
		"totalValue":    stats.TotalValue,
		"totalPaid":     stats.TotalPaid,
		"totalUnpaid":   stats.TotalUnpaid,
	}, nil
}
