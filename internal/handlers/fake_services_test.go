package handlers

import (
	"beidar-desktop/internal/core/domain"
)

// ---------- Product ----------

type fakeProductService struct {
	domain.ProductService

	products []domain.Product
	product  *domain.Product
	movement []domain.StockMovement
	err      error
}

func (f *fakeProductService) GetAllProducts() ([]domain.Product, error) {
	return f.products, f.err
}

func (f *fakeProductService) GetProductByID(id string) (*domain.Product, error) {
	return f.product, f.err
}

func (f *fakeProductService) CreateProduct(product *domain.Product) error { return f.err }

func (f *fakeProductService) UpdateProduct(product *domain.Product) error { return f.err }

func (f *fakeProductService) DeleteProduct(id string) error { return f.err }

func (f *fakeProductService) SearchProducts(query string) ([]domain.Product, error) {
	return f.products, f.err
}

func (f *fakeProductService) GetStockMovements() ([]domain.StockMovement, error) {
	return f.movement, f.err
}

func (f *fakeProductService) LogStockMovement(productID string, productName string, movementType string, qty float64, reason string) error {
	return f.err
}

// ---------- Sale ----------

type fakeSaleService struct {
	domain.SaleService

	sales    *domain.PaginatedSales
	sale     *domain.Sale
	salesRaw []domain.Sale
	items    []domain.SaleItem
	parked   *domain.ParkedSale
	parkedL  []domain.ParkedSale
	count    int
	err      error
}

func (f *fakeSaleService) GetSales(page int, pageSize int, search string, statusFilter string, dateFilter string) (*domain.PaginatedSales, error) {
	return f.sales, f.err
}

func (f *fakeSaleService) GetSale(id string) (*domain.Sale, error) { return f.sale, f.err }

func (f *fakeSaleService) ProcessSale(sale *domain.Sale) error { return f.err }

func (f *fakeSaleService) ReturnSale(id string) error { return f.err }

func (f *fakeSaleService) ReturnSalePartial(saleID string, productID string, qtyToReturn float64) error {
	return f.err
}

func (f *fakeSaleService) GetSaleItems(saleID string) ([]domain.SaleItem, error) {
	return f.items, f.err
}

func (f *fakeSaleService) DeleteSale(id string) error { return f.err }

func (f *fakeSaleService) ParkSale(itemsJSON string, customerName string, customerID string, note string, total domain.Amount, itemsCount float64) (*domain.ParkedSale, error) {
	return f.parked, f.err
}

func (f *fakeSaleService) GetParkedSales() ([]domain.ParkedSale, error) { return f.parkedL, f.err }

func (f *fakeSaleService) GetParkedSalesCount() (int, error) { return f.count, f.err }

func (f *fakeSaleService) RetrieveParkedSale(id uint) (*domain.ParkedSale, error) {
	return f.parked, f.err
}

func (f *fakeSaleService) DeleteParkedSale(id uint) error { return f.err }

func (f *fakeSaleService) GetInstallmentSales() ([]domain.Sale, error) { return f.salesRaw, f.err }

// ---------- Payment ----------

type fakePaymentService struct {
	domain.PaymentService

	payment   *domain.Payment
	payments  []domain.Payment
	sales     []domain.Sale
	plan      *domain.InstallmentPlan
	summary   *domain.InstallmentAlertSummary
	total     int
	paid      int
	remaining domain.Amount
	err       error
}

func (f *fakePaymentService) CreatePayment(payment domain.Payment) (*domain.Payment, error) {
	return f.payment, f.err
}

func (f *fakePaymentService) CreatePaymentForced(payment domain.Payment) error { return f.err }

func (f *fakePaymentService) GetPaymentsBySale(saleID string) ([]domain.Payment, error) {
	return f.payments, f.err
}

func (f *fakePaymentService) GetPaymentsByCustomer(customerID string) ([]domain.Payment, error) {
	return f.payments, f.err
}

func (f *fakePaymentService) DeletePayment(id uint) error { return f.err }

func (f *fakePaymentService) PayInstallment(saleID string, installmentIndex int, amount domain.Amount, method string) error {
	return f.err
}

func (f *fakePaymentService) GetCustomerInstallments(customerID string) ([]domain.Sale, error) {
	return f.sales, f.err
}

func (f *fakePaymentService) GetInstallmentSummary(saleID string) (int, int, domain.Amount, error) {
	return f.total, f.paid, f.remaining, f.err
}

func (f *fakePaymentService) CalculateInstallmentPlan(total, downPayment domain.Amount, months int) (*domain.InstallmentPlan, error) {
	return f.plan, f.err
}

func (f *fakePaymentService) GetInstallmentAlertSummary() (*domain.InstallmentAlertSummary, error) {
	return f.summary, f.err
}

// ---------- CRM ----------

type fakeCRMService struct {
	domain.CRMService

	customers []domain.Customer
	suppliers []domain.Supplier
	custPage  *domain.PaginatedCustomers
	supPage   *domain.PaginatedSuppliers
	err       error
}

func (f *fakeCRMService) GetCustomers() ([]domain.Customer, error) { return f.customers, f.err }

func (f *fakeCRMService) GetCustomersPaged(page int, pageSize int, search string) (*domain.PaginatedCustomers, error) {
	return f.custPage, f.err
}

func (f *fakeCRMService) SaveCustomer(c domain.Customer) error { return f.err }

func (f *fakeCRMService) DeleteCustomer(id string, force bool) error { return f.err }

func (f *fakeCRMService) SearchCustomers(query string) ([]domain.Customer, error) {
	return f.customers, f.err
}

func (f *fakeCRMService) GetSuppliers() ([]domain.Supplier, error) { return f.suppliers, f.err }

func (f *fakeCRMService) GetSuppliersPaged(page int, pageSize int, search string) (*domain.PaginatedSuppliers, error) {
	return f.supPage, f.err
}

func (f *fakeCRMService) SaveSupplier(s domain.Supplier) error { return f.err }

func (f *fakeCRMService) DeleteSupplier(id string, force bool) error { return f.err }

// ---------- Staff ----------

type fakeStaffService struct {
	domain.StaffService

	staff    *domain.Staff
	all      []domain.Staff
	result   *domain.AuthResult
	allowed  bool
	count    int64
	isDflt   bool
	err      error
	authCall string
}

func (f *fakeStaffService) CreateStaff(s domain.Staff, password string) (*domain.Staff, error) {
	return f.staff, f.err
}

func (f *fakeStaffService) UpdateStaff(s domain.Staff) error { return f.err }

func (f *fakeStaffService) UpdateStaffPassword(id string, newPassword string) error { return f.err }

func (f *fakeStaffService) DeleteStaff(id string, force bool) error { return f.err }

func (f *fakeStaffService) GetStaff(id string) (*domain.Staff, error) { return f.staff, f.err }

func (f *fakeStaffService) GetAllStaff() ([]domain.Staff, error) { return f.all, f.err }

func (f *fakeStaffService) GetActiveStaff() ([]domain.Staff, error) { return f.all, f.err }

func (f *fakeStaffService) ToggleStaffStatus(id string) error { return f.err }

func (f *fakeStaffService) AuthenticateByUsername(username, password string) (*domain.AuthResult, error) {
	f.authCall = "username:" + username
	return f.result, f.err
}

func (f *fakeStaffService) AuthenticateByPIN(pin string) (*domain.AuthResult, error) {
	f.authCall = "pin:" + pin
	return f.result, f.err
}

func (f *fakeStaffService) RestoreSession(staffID string) (*domain.AuthResult, error) {
	return f.result, f.err
}

func (f *fakeStaffService) HasPermission(staffID, permission string) (bool, error) {
	return f.allowed, f.err
}

func (f *fakeStaffService) GetStaffCount() (int64, error) { return f.count, f.err }

func (f *fakeStaffService) IsUsingDefaultPassword(staffID string) (bool, error) {
	return f.isDflt, f.err
}

// ---------- Stats ----------

type fakeStatsService struct {
	domain.StatsService

	dashboard *domain.DashboardStats
	monthly   *domain.MonthlyComparison
	err       error
}

func (f *fakeStatsService) GetDashboardStats(timeRange string) (*domain.DashboardStats, error) {
	return f.dashboard, f.err
}

func (f *fakeStatsService) GetMonthlyComparison() (*domain.MonthlyComparison, error) {
	return f.monthly, f.err
}

// ---------- Print ----------

type fakePrintService struct {
	domain.PrintService

	path     string
	printers []domain.PrinterInfo
	printer  string
	qr       string
	err      error
}

func (f *fakePrintService) GenerateInvoicePDFToPath(saleID string, format string, path string) (string, error) {
	return f.path, f.err
}

func (f *fakePrintService) GenerateQRCode(data string, size int) (string, error) {
	return f.qr, f.err
}

func (f *fakePrintService) GetAvailablePrinters() ([]domain.PrinterInfo, error) {
	return f.printers, f.err
}

func (f *fakePrintService) GetDefaultPrinter() (string, error) { return f.printer, f.err }

func (f *fakePrintService) TestPrinter(printerName string) error { return f.err }

func (f *fakePrintService) PrintBitmapReceipt(printerName, base64Image string) error { return f.err }

// ---------- Discount ----------

type fakeDiscountService struct {
	domain.DiscountService

	discounts []domain.Discount
	discount  *domain.Discount
	err       error
}

func (f *fakeDiscountService) GetDiscounts() ([]domain.Discount, error) { return f.discounts, f.err }

func (f *fakeDiscountService) GetActiveDiscounts() ([]domain.Discount, error) {
	return f.discounts, f.err
}

func (f *fakeDiscountService) GetDiscount(id string) (*domain.Discount, error) {
	return f.discount, f.err
}

func (f *fakeDiscountService) CreateDiscount(d domain.Discount) (*domain.Discount, error) {
	return f.discount, f.err
}

func (f *fakeDiscountService) UpdateDiscount(d domain.Discount) error { return f.err }

func (f *fakeDiscountService) DeleteDiscount(id string) error { return f.err }

func (f *fakeDiscountService) ToggleDiscountStatus(id string) error { return f.err }

func (f *fakeDiscountService) ValidateCoupon(code string) (*domain.Discount, error) {
	return f.discount, f.err
}

func (f *fakeDiscountService) ApplyDiscount(id string) error { return f.err }

// ---------- AI ----------

type fakeAIService struct {
	domain.AIService

	streamErr  error
	cancelCall int
}

func (f *fakeAIService) GenerateStream(prompt string, onChunk func(string), onError func(string), onComplete func()) error {
	return f.streamErr
}

func (f *fakeAIService) CancelStream() { f.cancelCall++ }
