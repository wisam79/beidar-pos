package auth

import "beidar-desktop/internal/core/domain"

// Permission constants. These are imported from internal/core/domain so that
// handlers can reference them via the auth package without importing the
// service layer (which would create an import cycle).
const (
	PermSales       = domain.PermSales
	PermProducts    = domain.PermProducts
	PermInventory   = domain.PermInventory
	PermCustomers   = domain.PermCustomers
	PermInvoices    = domain.PermInvoices
	PermReports     = domain.PermReports
	PermFinance     = domain.PermFinance
	PermSettings    = domain.PermSettings
	PermStaffManage = domain.PermStaffManage
	PermDiscounts   = domain.PermDiscounts
	PermDeleteSales = domain.PermDeleteSales
	PermEditPrices  = domain.PermEditPrices
	PermExportData  = domain.PermExportData
)
