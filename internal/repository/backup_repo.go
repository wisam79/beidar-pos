package repository

import (
	"beidar-desktop/internal/core/domain"
	"gorm.io/gorm"
)

type backupRepository struct {
	db *gorm.DB
}

func NewBackupRepository(db *gorm.DB) domain.BackupRepository {
	return &backupRepository{db: db}
}

func (r *backupRepository) Export() (*domain.DatabaseExport, error) {
	var products []domain.Product
	var sales []domain.Sale
	var customers []domain.Customer
	var suppliers []domain.Supplier
	var expenses []domain.Expense
	var categories []domain.Category
	var stockMovements []domain.StockMovement
	var prefs domain.AppPreferences
	var staff []domain.Staff
	var payments []domain.Payment
	var parked []domain.ParkedSale
	var shifts []domain.Shift
	var cashMovements []domain.CashMovement
	var purchaseOrders []domain.PurchaseOrder
	var purchaseOrderItems []domain.PurchaseOrderItem

	r.db.Find(&products)
	r.db.Preload("Items").Find(&sales)
	r.db.Find(&customers)
	r.db.Find(&suppliers)
	r.db.Find(&expenses)
	r.db.Find(&categories)
	r.db.Find(&stockMovements)
	r.db.First(&prefs)
	r.db.Find(&staff)
	r.db.Find(&payments)
	r.db.Find(&parked)
	r.db.Find(&shifts)
	r.db.Find(&cashMovements)
	r.db.Preload("Items").Find(&purchaseOrders)
	r.db.Find(&purchaseOrderItems)

	return &domain.DatabaseExport{
		Products:           products,
		Sales:              sales,
		Customers:          customers,
		Suppliers:          suppliers,
		Expenses:           expenses,
		Categories:         categories,
		StockMovements:     stockMovements,
		Preferences:        &prefs,
		Staff:              staff,
		Payments:           payments,
		ParkedSales:        parked,
		Shifts:             shifts,
		CashMovements:      cashMovements,
		PurchaseOrders:     purchaseOrders,
		PurchaseOrderItems: purchaseOrderItems,
	}, nil
}

func (r *backupRepository) Import(data domain.DatabaseExport) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// Drop and re-initialize tables
		err := tx.Migrator().DropTable(
			&domain.Product{}, &domain.Sale{}, &domain.SaleItem{}, &domain.Customer{}, &domain.Supplier{},
			&domain.Expense{}, &domain.Category{}, &domain.StockMovement{}, &domain.AppPreferences{},
			&domain.Payment{}, &domain.ParkedSale{}, &domain.LoginAttempt{}, &domain.Staff{}, &domain.Shift{},
			&domain.CashMovement{}, &domain.PurchaseOrder{}, &domain.PurchaseOrderItem{},
		)
		if err != nil {
			return err
		}

		err = tx.AutoMigrate(
			&domain.Product{},
			&domain.Sale{},
			&domain.SaleItem{},
			&domain.Customer{},
			&domain.Supplier{},
			&domain.Expense{},
			&domain.Payment{},
			&domain.Category{},
			&domain.StockMovement{},
			&domain.AppPreferences{},
			&domain.ParkedSale{},
			&domain.LoginAttempt{},
			&domain.Staff{},
			&domain.Shift{},
			&domain.CashMovement{},
			&domain.PurchaseOrder{},
			&domain.PurchaseOrderItem{},
		)
		if err != nil {
			return err
		}

		// Import in order (dependencies first)
		if len(data.Categories) > 0 {
			tx.Create(&data.Categories)
		}
		if len(data.Suppliers) > 0 {
			tx.Create(&data.Suppliers)
		}
		if len(data.Customers) > 0 {
			if err := tx.CreateInBatches(&data.Customers, 100).Error; err != nil {
				return err
			}
		}
		if len(data.Products) > 0 {
			if err := tx.CreateInBatches(&data.Products, 100).Error; err != nil {
				return err
			}
		}

		var allSaleItems []domain.SaleItem
		for i := range data.Sales {
			s := &data.Sales[i]
			for j := range s.Items {
				item := s.Items[j]
				item.SaleID = s.ID
				allSaleItems = append(allSaleItems, item)
			}
			s.Items = nil
		}
		if len(data.Sales) > 0 {
			if err := tx.CreateInBatches(&data.Sales, 100).Error; err != nil {
				return err
			}
		}
		if len(allSaleItems) > 0 {
			if err := tx.CreateInBatches(&allSaleItems, 100).Error; err != nil {
				return err
			}
		}

		if len(data.Expenses) > 0 {
			if err := tx.CreateInBatches(&data.Expenses, 100).Error; err != nil {
				return err
			}
		}
		if len(data.StockMovements) > 0 {
			if err := tx.CreateInBatches(&data.StockMovements, 100).Error; err != nil {
				return err
			}
		}
		if data.Preferences != nil {
			if err := tx.Create(data.Preferences).Error; err != nil {
				return err
			}
		}
		if len(data.Staff) > 0 {
			if err := tx.CreateInBatches(&data.Staff, 100).Error; err != nil {
				return err
			}
		}
		if len(data.Payments) > 0 {
			if err := tx.CreateInBatches(&data.Payments, 100).Error; err != nil {
				return err
			}
		}
		if len(data.ParkedSales) > 0 {
			if err := tx.CreateInBatches(&data.ParkedSales, 100).Error; err != nil {
				return err
			}
		}
		if len(data.Shifts) > 0 {
			if err := tx.CreateInBatches(&data.Shifts, 100).Error; err != nil {
				return err
			}
		}
		if len(data.CashMovements) > 0 {
			if err := tx.CreateInBatches(&data.CashMovements, 100).Error; err != nil {
				return err
			}
		}

		var allPurchaseItems []domain.PurchaseOrderItem
		for i := range data.PurchaseOrders {
			po := &data.PurchaseOrders[i]
			for j := range po.Items {
				item := po.Items[j]
				item.OrderID = po.ID
				allPurchaseItems = append(allPurchaseItems, item)
			}
			po.Items = nil
		}
		if len(data.PurchaseOrders) > 0 {
			if err := tx.CreateInBatches(&data.PurchaseOrders, 100).Error; err != nil {
				return err
			}
		}
		if len(allPurchaseItems) > 0 {
			if err := tx.CreateInBatches(&allPurchaseItems, 100).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func (r *backupRepository) Reset() error {
	return ResetDB()
}
