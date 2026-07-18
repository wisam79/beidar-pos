package domain

//go:generate mockgen -source=interfaces.go -destination=../../../internal/repository/mocks/mock_repository.go -package=mocks

// ---------- Repository Interfaces (in domain per Clean Architecture) ----------

// ProductRepository defines database operations for products
type ProductRepository interface {
	WithTx(tx Tx) ProductRepository
	Transaction(fn func(tx Tx) error) error
	GetAll() ([]Product, error)
	GetByID(id string) (*Product, error)
	GetByIDs(ids []string) ([]Product, error)
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
	WithTx(tx Tx) SaleRepository
	Transaction(fn func(tx Tx) error) error
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
	GetInstallmentSales() ([]Sale, error)
}

// CustomerRepository defines database operations for customers
type CustomerRepository interface {
	WithTx(tx Tx) CustomerRepository
	Transaction(fn func(tx Tx) error) error
	GetAll() ([]Customer, error)
	GetByID(id string) (*Customer, error)
	GetByIDs(ids []string) ([]Customer, error)
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
	WithTx(tx Tx) StaffRepository
	Transaction(fn func(tx Tx) error) error
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
	CountByRole(role Role) (int64, error)
	GetStaffSalesCount(staffID string) (int64, error)
	GetStaffPaymentsCount(staffID string) (int64, error)
	GetLoginAttempt(identifier string) (*LoginAttempt, error)
	SaveLoginAttempt(attempt *LoginAttempt) error
	DeleteLoginAttempt(identifier string) error
}

// PaymentRepository defines database operations for payments
type PaymentRepository interface {
	WithTx(tx Tx) PaymentRepository
	Transaction(fn func(tx Tx) error) error
	Create(payment *Payment) error
	GetPaymentsBySale(saleID string) ([]Payment, error)
	GetPaymentsByCustomer(customerID string) ([]Payment, error)
	GetByID(id uint) (*Payment, error)
	Delete(id uint) error
}

// ShiftRepository defines database operations for shifts
type ShiftRepository interface {
	WithTx(tx Tx) ShiftRepository
	Transaction(fn func(tx Tx) error) error
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
	WithTx(tx Tx) ExpenseRepository
	Transaction(fn func(tx Tx) error) error
	GetExpenses(month string) ([]Expense, error)
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
	WithTx(tx Tx) SupplierRepository
	Transaction(fn func(tx Tx) error) error
	GetAll() ([]Supplier, error)
	GetByID(id string) (*Supplier, error)
	Create(supplier *Supplier) error
	Update(supplier *Supplier) error
	UpdateBalance(id string, amount Amount) error
	Delete(id string) error
}

// PurchaseOrderRepository defines database operations for purchase orders
type PurchaseOrderRepository interface {
	WithTx(tx Tx) PurchaseOrderRepository
	Transaction(fn func(tx Tx) error) error
	GetByID(id string) (*PurchaseOrder, error)
	GetPurchaseOrders(status string, supplierID string) ([]PurchaseOrder, error)
	Create(order *PurchaseOrder) error
	Update(order *PurchaseOrder) error
	Delete(id string) error
	DeleteItemsByOrderID(orderID string) error
	UpdateItemReceivedQty(itemID uint, newReceivedQty float64) error
	GetOrderItem(orderID string, productID string) (*PurchaseOrderItem, error)
	GetOrderItems(orderID string) ([]PurchaseOrderItem, error)
	GetPurchaseOrderStats() (*PurchaseOrderStats, error)
}

// StatsRepository defines database operations for statistics
type StatsRepository interface {
	GetBasicStats(today string) (totalRevenue Amount, totalOrders int64, dailyRevenue Amount, dailyOrders int64, totalProducts int64, lowStockCount int64, err error)
	GetRecentSales(limit int) ([]Sale, error)
	GetTopSellingProducts(limit int) ([]TopProduct, error)
	GetProfitAndExpenses() (totalCOGS Amount, totalExpenses Amount, expenseBreakdown []ChartDataPoint, err error)
	GetTopCustomers(limit int) ([]TopCustomer, error)
	GetChartData(startDate string, dateFormat string) ([]ChartDataResult, error)
	GetMonthStats(startDate, endDate string) (revenue Amount, orders int64, expenses Amount, cogs Amount, err error)
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

// ---------- Service Interfaces ----------

// ProductService defines the business logic for products
type ProductService interface {
	GetAllProducts() ([]Product, error)
	GetProductByID(id string) (*Product, error)
	CreateProduct(product *Product) error
	UpdateProduct(product *Product) error
	DeleteProduct(id string) error
	SearchProducts(query string) ([]Product, error)
	GetStockMovements() ([]StockMovement, error)
	LogStockMovement(productID string, productName string, movementType string, qty float64, reason string) error
	ClearCache()
}

// SaleService defines the business logic for sales
type SaleService interface {
	GetSales(page int, pageSize int, search string, statusFilter string, dateFilter string) (*PaginatedSales, error)
	GetSale(id string) (*Sale, error)
	ProcessSale(sale *Sale) error
	ReturnSale(id string) error
	ReturnSalePartial(saleID string, productID string, qtyToReturn float64) error
	GetSaleItems(saleID string) ([]SaleItem, error)
	DeleteSale(id string) error
	ParkSale(itemsJSON string, customerName string, customerID string, note string, total float64, itemsCount float64) (*ParkedSale, error)
	GetParkedSales() ([]ParkedSale, error)
	GetParkedSalesCount() (int, error)
	RetrieveParkedSale(id uint) (*ParkedSale, error)
	DeleteParkedSale(id uint) error
	GetInstallmentSales() ([]Sale, error)
}

// PaymentService defines the business logic for payments
type PaymentService interface {
	CreatePayment(payment Payment) (*Payment, error)
	GetPaymentsBySale(saleID string) ([]Payment, error)
	GetPaymentsByCustomer(customerID string) ([]Payment, error)
	DeletePayment(id uint) error
	PayInstallment(saleID string, installmentIndex int, amount Amount, method string) error
	GetCustomerInstallments(customerID string) ([]Sale, error)
	GetInstallmentSummary(saleID string) (total int, paid int, remaining Amount, err error)
	CalculateInstallmentPlan(total, downPayment Amount, months int) (*InstallmentPlan, error)
	GetInstallmentAlertSummary() (*InstallmentAlertSummary, error)
}

// FinanceService defines the business logic for finance, expenses, categories, and POs
type FinanceService interface {
	// Expense & Category Management
	GetExpenses(month string) ([]Expense, error)
	SaveExpense(e Expense) error
	DeleteExpense(id string) error
	GetCategories() ([]Category, error)
	SaveCategory(c Category) error
	DeleteCategory(id string, force bool) error

	// Preferences & PIN Management
	GetPreferences() (*AppPreferences, error)
	UpdatePreferences(newPrefs AppPreferences) error
	VerifyAdminPin(pin string) (bool, error)

	// Shift & Cash Register Management
	OpenShift(staffID, staffName string, openingBalance Amount) (*Shift, error)
	CloseShift(shiftID string, closingBalance Amount, note string) (*Shift, error)
	GetActiveShift() (*Shift, error)
	AddCashMovement(shiftID, moveType, reason, staffID, staffName string, amount Amount) (*CashMovement, error)
	GetShiftMovements(shiftID string) ([]CashMovement, error)
	GetShiftHistory(limit int) ([]Shift, error)

	// Purchase Orders (Procurement)
	CreatePurchaseOrder(order PurchaseOrder) (*PurchaseOrder, error)
	GetPurchaseOrders(status string, supplierID string) ([]PurchaseOrder, error)
	GetPurchaseOrder(id string) (*PurchaseOrder, error)
	UpdatePurchaseOrder(order PurchaseOrder) error
	DeletePurchaseOrder(id string) error
	CancelPurchaseOrder(id string) error
	ReceivePurchaseOrder(orderID string, items []PurchaseOrderItem) error
	PayPurchaseOrder(orderID string, amount Amount, method string) error
	GetPurchaseOrderStats() (*PurchaseOrderStats, error)
}

// CRMService defines the business logic for customers and suppliers
type CRMService interface {
	GetCustomers() ([]Customer, error)
	SaveCustomer(c Customer) error
	DeleteCustomer(id string, force bool) error
	SearchCustomers(query string) ([]Customer, error)

	GetSuppliers() ([]Supplier, error)
	SaveSupplier(s Supplier) error
	DeleteSupplier(id string, force bool) error
}

// StaffService defines the business logic for staff management and authentication
type StaffService interface {
	CreateStaff(s Staff, password string) (*Staff, error)
	UpdateStaff(s Staff) error
	UpdateStaffPassword(id string, newPassword string) error
	DeleteStaff(id string, force bool) error
	GetStaff(id string) (*Staff, error)
	GetAllStaff() ([]Staff, error)
	GetActiveStaff() ([]Staff, error)
	ToggleStaffStatus(id string) error

	AuthenticateByUsername(username, password string) (*AuthResult, error)
	AuthenticateByPIN(pin string) (*AuthResult, error)
	HasPermission(staffID, permission string) (bool, error)
	SeedDefaultAdmin() error
	GetStaffCount() (int64, error)
	IsUsingDefaultPassword(staffID string) (bool, error)
}

// StatsService defines the business logic for dashboard and reports statistics
type StatsService interface {
	GetDashboardStats(timeRange string) (*DashboardStats, error)
	GetMonthlyComparison() (*MonthlyComparison, error)
}

// PrintService defines the business logic for invoice PDFs and receipt printers
type PrintService interface {
	GenerateInvoicePDFToPath(saleID string, format string, path string) (string, error)
	GenerateQRCode(data string, size int) (string, error)
	GetAvailablePrinters() ([]PrinterInfo, error)
	GetDefaultPrinter() (string, error)
	PrintReceiptDirect(printerName, storeName string, items []ReceiptItem, total float64, currency string) error
	TestPrinter(printerName string) error
	PrintBitmapReceipt(printerName, base64Image string) error
}

// BackupService defines the business logic for DB backup/restore
type BackupService interface {
	CreateBackup() (*BackupResult, error)
	ListBackups() ([]BackupInfo, error)
	RestoreBackup(backupPath string) error
	DeleteBackup(backupPath string) error
	CleanOldBackups(retainDays int) (int, error)
	ResetDatabase() error
	ExportDatabase() (*DatabaseExport, error)
	ImportDatabase(data DatabaseExport) error
	ExportProductsCSV() (*CSVExportResult, error)
	ImportProductsCSV(csvData string, updateExisting bool) (*CSVImportResult, error)
	GetCSVTemplate() string
	MigrateImagesToFilesystem() (int, error)
	GetImageStorageStats() (*ImageStorageStats, error)
}

// SettingsService defines the business logic for general settings and preferences
type SettingsService interface {
	GetPreferences() (*AppPreferences, error)
	UpdatePreferences(prefs AppPreferences) error
	VerifyAdminPin(pin string) bool
	GetDeviceID() (string, error)

	// AutoStart
	IsAutoStartEnabled() bool
	EnableAutoStart() error
	DisableAutoStart() error

	// Crash Reports
	GetCrashReports() ([]string, error)
	GetCrashReportContent(filename string) (string, error)
	ClearCrashReports() error

	// Updates
	CheckForUpdates() (*UpdateInfo, error)
	GetUpdateStatus() UpdateStatus
	DownloadUpdate(url, expectedChecksum string) (string, error)
	InstallUpdate(installerPath string) error
	SkipVersion(version string) error

	// Supabase global settings
	FetchGlobalAIKeys() ([]string, error)
	FetchGlobalGroqKeys() ([]string, error)
	SaveGlobalAIKeys(keys []string, userToken string) error
	SaveGlobalGroqKeys(keys []string, userToken string) error
}

// DiscountService defines the business logic for sales discounts
type DiscountService interface {
	GetDiscounts() ([]Discount, error)
	GetActiveDiscounts() ([]Discount, error)
	GetDiscount(id string) (*Discount, error)
	CreateDiscount(d Discount) (*Discount, error)
	UpdateDiscount(d Discount) error
	DeleteDiscount(id string) error
	ToggleDiscountStatus(id string) error
	ValidateCoupon(code string) (*Discount, error)
	ApplyDiscount(id string) error
	CalculateDiscountAmount(discountID string, subtotal Amount, itemsCount int) (Amount, error)
}

// AIService defines the business logic for AI content generation and streaming
type AIService interface {
	GenerateStream(prompt string, onChunk func(string), onError func(string), onComplete func()) error
	CancelStream()
}

