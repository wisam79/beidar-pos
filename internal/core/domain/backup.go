package domain

// BackupConfig holds backup configuration
type BackupConfig struct {
	Enabled       bool   `json:"enabled"`
	Frequency     string `json:"frequency"` // "daily", "weekly", "hourly"
	RetainDays    int    `json:"retainDays"`
	Path          string `json:"path"`
	LastBackup    string `json:"lastBackup"`
	CloudAutoSync bool   `json:"cloudAutoSync"`
}

// BackupInfo contains information about a backup file
type BackupInfo struct {
	Filename  string `json:"filename"`
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	CreatedAt string `json:"createdAt"`
}

// BackupResult holds the result of a backup operation
type BackupResult struct {
	Success  bool   `json:"success"`
	Path     string `json:"path"`
	Size     int64  `json:"size"`
	Duration int64  `json:"duration"` // milliseconds
	Error    string `json:"error,omitempty"`
}

// DatabaseExport holds all clean architecture data for export/import
type DatabaseExport struct {
	Products           []Product           `json:"products"`
	Sales              []Sale              `json:"sales"`
	Customers          []Customer          `json:"customers"`
	Suppliers          []Supplier          `json:"suppliers"`
	Expenses           []Expense           `json:"expenses"`
	Categories         []Category          `json:"categories"`
	StockMovements     []StockMovement     `json:"stockMovements"`
	Preferences        *AppPreferences     `json:"preferences"`
	Staff              []Staff             `json:"staff"`
	Payments           []Payment           `json:"payments"`
	ParkedSales        []ParkedSale        `json:"parkedSales"`
	Shifts             []Shift             `json:"shifts"`
	CashMovements      []CashMovement      `json:"cashMovements"`
	PurchaseOrders     []PurchaseOrder     `json:"purchaseOrders"`
	PurchaseOrderItems []PurchaseOrderItem `json:"purchaseOrderItems"`
}
