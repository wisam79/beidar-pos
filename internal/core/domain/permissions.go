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

// RolePermissions defines the default permission set for each role.
// Single source of truth for the role → permission policy: consumed by
// internal/service (staff defaults and sessions) and by internal/network
// (LAN device actor). Do not duplicate this table elsewhere.
var RolePermissions = map[Role][]string{
	RoleAdmin: {
		PermSales, PermProducts, PermInventory, PermCustomers, PermInvoices,
		PermReports, PermFinance, PermSettings, PermStaffManage, PermDiscounts,
		PermDeleteSales, PermEditPrices, PermExportData,
	},
	RoleManager: {
		PermSales, PermProducts, PermInventory, PermCustomers, PermInvoices,
		PermReports, PermFinance, PermDiscounts, PermDeleteSales, PermEditPrices,
	},
	RoleCashier: {
		PermSales, PermCustomers, PermInvoices, PermDiscounts,
	},
	RoleViewer: {
		// Read-only: no elevated permissions.
	},
}

// PermissionsForRole returns a defensive copy of the default permissions for a
// role. Unknown roles yield an empty set (fail-closed).
func PermissionsForRole(role Role) []string {
	perms := RolePermissions[role]
	out := make([]string, len(perms))
	copy(out, perms)
	return out
}
