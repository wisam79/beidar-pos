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
		for _, c := range data.Categories {
			tx.Create(&c)
		}
		for _, s := range data.Suppliers {
			tx.Create(&s)
		}
		for _, c := range data.Customers {
			tx.Create(&c)
		}
		for _, p := range data.Products {
			tx.Create(&p)
		}
		for _, s := range data.Sales {
			items := s.Items
			s.Items = nil
			tx.Create(&s)
			for _, item := range items {
				item.SaleID = s.ID
				tx.Create(&item)
			}
		}
		for _, e := range data.Expenses {
			tx.Create(&e)
		}
		for _, m := range data.StockMovements {
			tx.Create(&m)
		}
		if data.Preferences != nil {
			tx.Create(data.Preferences)
		}
		if len(data.Staff) > 0 {
			tx.Create(&data.Staff)
		}
		if len(data.Payments) > 0 {
			tx.Create(&data.Payments)
		}
		if len(data.ParkedSales) > 0 {
			tx.Create(&data.ParkedSales)
		}
		if len(data.Shifts) > 0 {
			tx.Create(&data.Shifts)
		}
		if len(data.CashMovements) > 0 {
			tx.Create(&data.CashMovements)
		}
		for _, po := range data.PurchaseOrders {
			items := po.Items
			po.Items = nil
			tx.Create(&po)
			for _, item := range items {
				item.OrderID = po.ID
				tx.Create(&item)
			}
		}

		return nil
	})
}

func (r *backupRepository) Reset() error {
	return ResetDB()
}
