package auth

// Permission constants. These mirror the values defined in
// internal/service/staff_service.go (Perm*). They are re-declared here so the
// handlers can reference them via the auth package without importing the
// service layer (which would create an import cycle: service does not depend on
// handlers, and handlers must not depend on service's internal constants).
//
// Keep these in sync with service.RolePermissions.
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
