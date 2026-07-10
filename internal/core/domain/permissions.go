package domain

// Permission constants used across the application for access control.
// Defined in domain so both pkg/auth and internal/service can import them
// without creating import cycles.
const (
	PermSales       = "sales"
	PermProducts    = "products"
	PermInventory   = "inventory"
	PermCustomers   = "customers"
	PermInvoices    = "invoices"
	PermReports     = "reports"
	PermFinance     = "finance"
	PermSettings    = "settings"
	PermStaffManage = "staff_manage"
	PermDiscounts   = "discounts"
	PermDeleteSales = "delete_sales"
	PermEditPrices  = "edit_prices"
	PermExportData  = "export_data"
)
