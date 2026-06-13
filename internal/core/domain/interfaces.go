package domain

import "gorm.io/gorm"

//go:generate mockgen -source=interfaces.go -destination=../../../internal/repository/mocks/mock_repository.go -package=mocks

// ---------- Repository Interfaces (in domain per Clean Architecture) ----------
// NOTE: *gorm.DB in Transaction/WithTx is a known leak (TODO: opaque Tx type)

// ProductRepository defines database operations for products
type ProductRepository interface {
	WithTx(tx *gorm.DB) ProductRepository
	GetAll() ([]Product, error)
	GetByID(id string) (*Product, error)
	GetByBarcode(barcode string) (*Product, error)
	GetProductsWithBase64Images() ([]Product, error)
	CountProductsWithBase64Images() (int64, error)
	Create(product *Product) error
	Update(product *Product) error
	Delete(id string) error
	Search(query string) ([]Product, error)
	UpdateStock(id string, qty float64) error
	CreateStockMovement(movement *StockMovement) error
	GetStockMovements() ([]StockMovement, error)
	CountBySupplier(supplierName string) (int64, error)
	UnlinkSupplier(supplierName string) error
	Vacuum() error
}

// SaleRepository defines database operations for sales
type SaleRepository interface {
	WithTx(tx *gorm.DB) SaleRepository
	Transaction(fn func(tx *gorm.DB) error) error
	GetSales(page int, pageSize int, search string, statusFilter string, dateFilter string) (*PaginatedSales, error)
	GetByID(id string) (*Sale, error)
	Create(sale *Sale) error
	Update(sale *Sale) error
	GetSaleItems(saleID string) ([]SaleItem, error)
	UpdateSaleItem(item *SaleItem) error
	GetSaleItem(saleID string, productID string) (*SaleItem, error)
	ParkSale(parked *ParkedSale) error
	GetParkedSales() ([]ParkedSale, error)
	GetParkedSalesCount() (int, error)
	RetrieveParkedSale(id uint) (*ParkedSale, error)
	DeleteParkedSale(id uint) error
	GetCustomerInstallments(customerID string) ([]Sale, error)
	GetUnsyncedSales() ([]Sale, error)
	MarkSaleAsSynced(id string) error
	UpdateSaleInstallmentPlan(saleID string, planJSON string, status string) error
}

// CustomerRepository defines database operations for customers
type CustomerRepository interface {
	WithTx(tx *gorm.DB) CustomerRepository
	Transaction(fn func(tx *gorm.DB) error) error
	GetAll() ([]Customer, error)
	GetByID(id string) (*Customer, error)
	GetByPhone(phone string) (*Customer, error)
	Create(customer *Customer) error
	Update(customer *Customer) error
	Updates(id string, updates map[string]interface{}) error
	Delete(id string) error
	Search(query string) ([]Customer, error)
	GetActiveInstallmentsCount(customerID string) (int64, error)
	DecrementPurchases(id string, amount Amount) error
	AdjustPoints(id string, delta int) error
	DecrementDebt(id string, amount Amount) error
	DecrementInstallmentDebt(id string, amount Amount) error
}

// StaffRepository defines database operations for staff
type StaffRepository interface {
	WithTx(tx *gorm.DB) StaffRepository
	Transaction(fn func(tx *gorm.DB) error) error
	GetByID(id string) (*Staff, error)
	GetByUsername(username string) (*Staff, error)
	GetByFastPIN(fastPIN string) (*Staff, error)
	GetAll() ([]Staff, error)
	GetActive() ([]Staff, error)
	Create(staff *Staff) error
	Update(staff *Staff) error
	Updates(id string, updates map[string]interface{}) error
	Delete(id string) error
	GetStaffCount() (int64, error)
	GetStaffSalesCount(staffID string) (int64, error)
	GetStaffPaymentsCount(staffID string) (int64, error)
	GetLoginAttempt(identifier string) (*LoginAttempt, error)
	SaveLoginAttempt(attempt *LoginAttempt) error
	DeleteLoginAttempt(identifier string) error
}

// PaymentRepository defines database operations for payments
type PaymentRepository interface {
	WithTx(tx *gorm.DB) PaymentRepository
	Transaction(fn func(tx *gorm.DB) error) error
	Create(payment *Payment) error
	GetPaymentsBySale(saleID string) ([]Payment, error)
	GetPaymentsByCustomer(customerID string) ([]Payment, error)
	GetByID(id uint) (*Payment, error)
	Delete(id uint) error
}

// ShiftRepository defines database operations for shifts
type ShiftRepository interface {
	WithTx(tx *gorm.DB) ShiftRepository
	Transaction(fn func(tx *gorm.DB) error) error
	GetActiveShift() (*Shift, error)
	UpdateShiftSales(saleTotal, cashAmount Amount, requireShift bool) error
	Save(shift *Shift) error
	GetByID(id string) (*Shift, error)
	GetShiftMovements(shiftID string) ([]CashMovement, error)
	GetShiftHistory(limit int) ([]Shift, error)
	CreateCashMovement(move *CashMovement) error
	GetCashInAndOut(shiftID string) (cashIn Amount, cashOut Amount, err error)
}

// PreferencesRepository defines database operations for app preferences
type PreferencesRepository interface {
	Get() (*AppPreferences, error)
	Save(prefs *AppPreferences) error
}

// ExpenseRepository defines database operations for expenses and categories
type ExpenseRepository interface {
	WithTx(tx *gorm.DB) ExpenseRepository
	Transaction(fn func(tx *gorm.DB) error) error
	GetExpenses() ([]Expense, error)
	GetExpenseByID(id string) (*Expense, error)
	CreateExpense(e *Expense) error
	UpdateExpense(e *Expense) error
	DeleteExpense(id string) error
	GetCategories() ([]Category, error)
	GetCategoryByID(id string) (*Category, error)
	GetCategoryByName(name string) (*Category, error)
	CreateCategory(c *Category) error
	UpdateCategory(c *Category) error
	DeleteCategory(id string) error
	CountProductsInCategory(categoryName string) (int64, error)
	UpdateProductCategory(oldCategoryName, newCategoryName string) error
}

// SupplierRepository defines database operations for suppliers
type SupplierRepository interface {
	WithTx(tx *gorm.DB) SupplierRepository
	Transaction(fn func(tx *gorm.DB) error) error
	GetAll() ([]Supplier, error)
	GetByID(id string) (*Supplier, error)
	Create(supplier *Supplier) error
	Update(supplier *Supplier) error
	UpdateBalance(id string, amount Amount) error
	Delete(id string) error
}

// PurchaseOrderRepository defines database operations for purchase orders
type PurchaseOrderRepository interface {
	WithTx(tx *gorm.DB) PurchaseOrderRepository
	Transaction(fn func(tx *gorm.DB) error) error
	GetByID(id string) (*PurchaseOrder, error)
	GetPurchaseOrders(status string, supplierID string) ([]PurchaseOrder, error)
	Create(order *PurchaseOrder) error
	Update(order *PurchaseOrder) error
	Delete(id string) error
	DeleteItemsByOrderID(orderID string) error
	UpdateItemReceivedQty(itemID uint, newReceivedQty float64) error
	GetOrderItem(orderID string, productID string) (*PurchaseOrderItem, error)
	GetOrderItems(orderID string) ([]PurchaseOrderItem, error)
	GetPurchaseOrderStats() (map[string]interface{}, error)
}

// StatsRepository defines database operations for statistics
type StatsRepository interface {
	GetBasicStats(today string) (totalRevenue float64, totalOrders int64, dailyRevenue float64, dailyOrders int64, totalProducts int64, lowStockCount int64, err error)
	GetRecentSales(limit int) ([]Sale, error)
	GetTopSellingProducts(limit int) ([]TopProduct, error)
	GetProfitAndExpenses() (totalCOGS float64, totalExpenses float64, expenseBreakdown []ChartDataPoint, err error)
	GetTopCustomers(limit int) ([]TopCustomer, error)
	GetChartData(startDate string, dateFormat string) ([]ChartDataResult, error)
	GetMonthStats(startDate, endDate string) (revenue float64, orders int64, expenses float64, cogs float64, err error)
}

// BackupRepository defines database operations for backup
type BackupRepository interface {
	Export() (*DatabaseExport, error)
	Import(data DatabaseExport) error
	Reset() error
}

// NetworkRepository defines database operations for LAN device blocking
type NetworkRepository interface {
	BlockDevice(device *BlockedDevice) error
	UnblockDevice(id uint) error
	GetBlockedDevices() ([]BlockedDevice, error)
	IsDeviceBlocked(deviceID string) (bool, error)
}

// DiscountRepository defines database operations for discounts/coupons
type DiscountRepository interface {
	GetDiscounts() ([]Discount, error)
	GetActiveDiscounts(now string) ([]Discount, error)
	GetDiscountByID(id string) (*Discount, error)
	CreateDiscount(d *Discount) error
	UpdateDiscount(d *Discount) error
	DeleteDiscount(id string) error
	ValidateCoupon(code string, now string) (*Discount, error)
	IncrementUsageCount(id string) error
}
