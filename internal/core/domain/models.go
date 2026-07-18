package domain

type Product struct {
	ID             string                 `gorm:"primaryKey" json:"id"`
	Name           string                 `json:"name"`
	Barcode        string                 `gorm:"uniqueIndex" json:"barcode"`
	Price          Amount                 `json:"price"`
	Cost           Amount                 `json:"cost"`
	Stock          float64                `json:"stock"`
	MinStock       float64                `json:"minStock"`
	Category       string                 `gorm:"index" json:"category"`
	Image          string                 `json:"image"`
	Supplier       string                 `json:"supplier,omitempty"`
	WholesalePrice Amount                 `json:"wholesalePrice"`
	Description    string                 `json:"description,omitempty"`
	CustomDetails  map[string]interface{} `gorm:"serializer:json" json:"customDetails,omitempty"`
}

type Installment struct {
	Number  int    `json:"number"`
	DueDate string `json:"dueDate"`
	Amount  Amount `json:"amount"`
	Status  string `json:"status"` // pending, paid, overdue
	PaidAt  int64  `json:"paidAt,omitempty"`
}

type InstallmentPlan struct {
	TotalAmount Amount        `json:"totalAmount"`
	DownPayment Amount        `json:"downPayment"`
	Months      int           `json:"months"`
	StartDate   string        `json:"startDate"`
	Schedule    []Installment `json:"schedule"`
}

type Sale struct {
	ID              string             `gorm:"primaryKey" json:"id"`
	CustomerID      string             `gorm:"index" json:"customerId,omitempty"`
	CustomerName    string             `gorm:"index" json:"customer"`
	StaffID         string             `gorm:"index" json:"staffId"`
	StaffName       string             `json:"staffName"`
	Date            string             `gorm:"index" json:"date"`
	Timestamp       int64              `gorm:"index" json:"timestamp"`
	Subtotal        Amount             `json:"subtotal"`
	Discount        Amount             `json:"discount"`
	VAT             Amount             `json:"vat"`
	Total           Amount             `json:"total"`
	PaymentMethod   string             `gorm:"index" json:"paymentMethod"`
	Status          string             `gorm:"index" json:"status"`
	ItemsCount      float64            `json:"itemsCount"`
	Items           []SaleItem         `gorm:"foreignKey:SaleID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"items"`
	SplitDetails    map[string]Amount  `gorm:"serializer:json" json:"splitDetails,omitempty"`
	InstallmentPlan *InstallmentPlan   `gorm:"serializer:json" json:"installmentPlan,omitempty"`
	Note            string             `json:"note,omitempty"`
	PointsAwarded   int                `json:"pointsAwarded"`
	ZohoSynced      bool               `json:"zohoSynced"`
}

type SaleItem struct {
	ID          uint    `gorm:"primaryKey;autoIncrement" json:"pid"`
	SaleID      string  `gorm:"index" json:"-"`
	ProductID   string  `gorm:"index" json:"id"`
	Name        string  `json:"name"`
	Price       Amount  `json:"price"`
	Quantity    float64 `json:"qty"`
	Total       Amount  `json:"total"`
	Cost        Amount  `json:"cost"`
	Discount    Amount  `json:"discount,omitempty"`
	ReturnedQty float64 `json:"returnedQty"`
}

type Customer struct {
	ID              string `gorm:"primaryKey" json:"id"`
	Name            string `gorm:"index" json:"name"`
	Phone           string `gorm:"uniqueIndex" json:"phone"`
	Debt            Amount `json:"debt"`
	InstallmentDebt Amount `json:"installmentDebt"`
	TotalPurchases  Amount `json:"totalPurchases"`
	LastVisit       string `json:"lastVisit"`
	Points          int    `json:"points"`
	Notes           string `json:"notes,omitempty"`
}

type Supplier struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	CompanyName string `json:"companyName"`
	Phone       string `json:"phone"`
	Email       string `json:"email,omitempty"`
	Notes       string `json:"notes,omitempty"`
	Balance     Amount `json:"balance"`
}

type Expense struct {
	ID       string `gorm:"primaryKey" json:"id"`
	Title    string `json:"title"`
	Amount   Amount `json:"amount"`
	Date     string `gorm:"index" json:"date"`
	Category string `gorm:"index" json:"category"`
	Notes    string `json:"notes,omitempty"`
}

type Payment struct {
	ID         uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	SaleID     string `gorm:"index" json:"saleId"`
	CustomerID string `gorm:"index" json:"customerId"`
	Amount     Amount `json:"amount"`
	Method     string `json:"method"`
	Note       string `json:"note,omitempty"`
	Timestamp  int64  `gorm:"index" json:"timestamp"`
	StaffID    string `json:"staffId,omitempty"`
	InstIndex  int    `json:"instIndex,omitempty"`
}

type CategoryField struct {
	Name    string   `json:"name"`
	Type    string   `json:"type"`
	Options []string `json:"options,omitempty"`
}

type Category struct {
	ID     string          `gorm:"primaryKey" json:"id"`
	Name   string          `gorm:"uniqueIndex" json:"name"`
	Fields []CategoryField `gorm:"serializer:json" json:"fields,omitempty"`
}

type StockMovement struct {
	ID          uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	ProductID   string  `gorm:"index" json:"productId"`
	ProductName string  `json:"productName"`
	Type        string  `json:"type"`
	Qty         float64 `json:"qty"`
	Reason      string  `json:"reason,omitempty"`
	Timestamp   int64   `json:"timestamp"`
}

type AppPreferences struct {
	ID               uint     `gorm:"primaryKey" json:"-"`
	StoreName        string   `json:"storeName"`
	StoreAddress     string   `json:"storeAddress"`
	StorePhone       string   `json:"storePhone"`
	Currency         string   `json:"currency"`
	TaxRate          float64  `json:"taxRate"`
	Theme            string   `json:"theme"`
	AccentColor      string   `json:"accentColor"`
	EnableSound      bool     `json:"enableSound"`
	Language         string   `json:"language"`
	LowStockTrigger  int      `json:"lowStockTrigger"`
	AdminPin         string   `json:"adminPin"`
	GeminiAPIKey     string   `json:"geminiApiKey"`
	GeminiAPIKeys    []string `json:"geminiApiKeys" gorm:"serializer:json"`
	FontSize         string   `json:"fontSize"`
	AutoLockTime     int      `json:"autoLockTime"`
	QuickSell        bool     `json:"quickSell"`
	AutoPrint        bool     `json:"autoPrint"`
	AutoPrintFormat  string   `json:"autoPrintFormat"`
	ThermalPaperSize string   `json:"thermalPaperSize"`
	RequireShift     bool     `json:"requireShift" gorm:"default:false"`
	CloudAutoSync    bool     `json:"cloudAutoSync" gorm:"default:false"`
	ReceiptPrinter   string   `json:"receiptPrinter"`
	LabelPrinter     string   `json:"labelPrinter"`
	AIProvider       string   `json:"aiProvider" gorm:"default:'gemini'"`
	AIModel          string   `json:"aiModel" gorm:"default:'gemma-4-31b-it'"`
	AIRotationMode   string   `json:"aiRotationMode" gorm:"default:'failover'"`
	GroqAPIKey       string   `json:"groqApiKey"`
}

type ParkedSale struct {
	ID           uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	ItemsJSON    string  `json:"items_json"`
	CustomerName string  `json:"customer_name"`
	CustomerID   string  `json:"customer_id"`
	Note         string  `json:"note"`
	Total        Amount  `json:"total"`
	ItemsCount   float64 `json:"items_count"`
	CreatedAt    int64   `json:"created_at"`
}

type PaginatedSales struct {
	Data       []Sale       `json:"data"`
	Total      int64        `json:"total"`
	TotalPages int          `json:"totalPages"`
	Page       int          `json:"page"`
	Stats      InvoiceStats `json:"stats"`
}

type InvoiceStats struct {
	Count   int64  `json:"count"`
	Total   Amount `json:"total"`
	Pending Amount `json:"pending"`
	Returns int64  `json:"returns"`
}

type ProductStats struct {
	TotalStock float64 `json:"totalStock"`
	TotalValue Amount  `json:"totalValue"`
	TotalCost  Amount  `json:"totalCost"`
	Profit     Amount  `json:"profit"`
}

type PaginatedProducts struct {
	Data       []Product    `json:"data"`
	Total      int64        `json:"total"`
	TotalPages int          `json:"totalPages"`
	Page       int          `json:"page"`
	Stats      ProductStats `json:"stats"`
}

type LoginAttempt struct {
	ID          uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Identifier  string `gorm:"uniqueIndex" json:"identifier"`
	Attempts    int    `json:"attempts"`
	LastAttempt int64  `json:"lastAttempt"`
	LockedUntil int64  `json:"lockedUntil"`
}

type Role string

const (
	RoleAdmin   Role = "admin"
	RoleManager Role = "manager"
	RoleCashier Role = "cashier"
	RoleViewer  Role = "viewer"
)

type Staff struct {
	ID             string   `gorm:"primaryKey" json:"id"`
	Name           string   `json:"name"`
	Username       string   `gorm:"uniqueIndex" json:"username"`
	PasswordHash   string   `json:"-"`
	MustChangePin  bool     `json:"mustChangePin"`
	Role           Role     `json:"role"`
	Phone          string   `json:"phone,omitempty"`
	Email          string   `json:"email,omitempty"`
	Active         bool     `json:"active"`
	Permissions    []string `gorm:"serializer:json" json:"permissions,omitempty"`
	LastLogin      int64    `json:"lastLogin,omitempty"`
	CreatedAt      int64    `json:"createdAt"`
	SupabaseUserID string   `json:"supabaseUserId,omitempty"`
	FastPIN        string   `json:"-"`
}

type AuthResult struct {
	Success          bool     `json:"success"`
	Staff            Staff    `json:"staff,omitempty"`
	Permissions      []string `json:"permissions,omitempty"`
	Message          string   `json:"message,omitempty"`
	RequirePINChange bool     `json:"requirePinChange,omitempty"`
}

type Shift struct {
	ID              string `gorm:"primaryKey" json:"id"`
	StaffID         string `gorm:"index" json:"staffId"`
	StaffName       string `json:"staffName"`
	OpenTime        int64  `json:"openTime"`
	CloseTime       int64  `json:"closeTime,omitempty"`
	OpeningBalance  Amount `json:"openingBalance"`
	ClosingBalance  Amount `json:"closingBalance"`
	ExpectedBalance Amount `json:"expectedBalance"`
	Variance        Amount `json:"variance"`
	Status          string `gorm:"index" json:"status"` // open, closed
	TotalSales      Amount `json:"totalSales"`
	CashSales       Amount `json:"cashSales"`
	SalesCount      int    `json:"salesCount"`
	Note            string `json:"note,omitempty"`
}

type CashMovement struct {
	ID        string `gorm:"primaryKey" json:"id"`
	ShiftID   string `gorm:"index" json:"shiftId"`
	Type      string `json:"type"` // cash_in, cash_out
	Amount    Amount `json:"amount"`
	Reason    string `json:"reason"`
	StaffID   string `json:"staffId"`
	StaffName string `json:"staffName"`
	Timestamp int64  `json:"timestamp"`
}

type PurchaseOrderStatus string

const (
	POStatusPending   PurchaseOrderStatus = "pending"   // Order created, waiting for delivery
	POStatusPartial   PurchaseOrderStatus = "partial"   // Partially received
	POStatusReceived  PurchaseOrderStatus = "received"  // Fully received
	POStatusCancelled PurchaseOrderStatus = "cancelled" // Order cancelled
)

type PurchaseOrder struct {
	ID           string              `gorm:"primaryKey" json:"id"`
	SupplierID   string              `gorm:"index" json:"supplierId"`
	SupplierName string              `json:"supplierName"`
	Status       PurchaseOrderStatus `gorm:"index" json:"status"`
	TotalAmount  Amount              `json:"totalAmount"`
	PaidAmount   Amount              `json:"paidAmount"`
	Note         string              `json:"note,omitempty"`
	CreatedAt    int64               `gorm:"index" json:"createdAt"`
	ReceivedAt   int64               `json:"receivedAt,omitempty"`
	Items        []PurchaseOrderItem `gorm:"foreignKey:OrderID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"items"`
}

type PurchaseOrderItem struct {
	ID          uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID     string  `gorm:"index" json:"-"`
	ProductID   string  `json:"productId"`
	ProductName string  `json:"productName"`
	Quantity    float64 `json:"quantity"`    // Ordered quantity
	ReceivedQty float64 `json:"receivedQty"` // Actually received
	UnitCost    Amount  `json:"unitCost"`    // Cost per unit
	Total       Amount  `json:"total"`       // quantity * unitCost
}

type Discount struct {
	ID          string   `gorm:"primaryKey" json:"id"`
	Name        string   `json:"name"`
	Type        string   `json:"type"` // percentage, fixed, buyXgetY, quantity
	Value       float64  `json:"value"`
	MinPurchase Amount   `json:"minPurchase,omitempty"`
	MaxDiscount Amount   `json:"maxDiscount,omitempty"`
	StartDate   string   `json:"startDate,omitempty"`
	EndDate     string   `json:"endDate,omitempty"`
	Code        string   `gorm:"index" json:"code,omitempty"`
	ProductIDs  []string `gorm:"serializer:json" json:"productIds,omitempty"`
	CategoryIDs []string `gorm:"serializer:json" json:"categoryIds,omitempty"`
	UsageLimit  int      `json:"usageLimit,omitempty"`
	UsageCount  int      `json:"usageCount"`
	Active      bool     `json:"active"`
	CreatedAt   int64    `json:"createdAt"`
}

type PurchaseOrderStats struct {
	TotalOrders   int64  `json:"totalOrders"`
	PendingOrders int64  `json:"pendingOrders"`
	TotalValue    Amount `json:"totalValue"`
	TotalPaid     Amount `json:"totalPaid"`
	TotalUnpaid   Amount `json:"totalUnpaid"`
}

type UpdateInfo struct {
	Version         string `json:"version"`
	DownloadURL     string `json:"download_url"`
	ReleaseNotes    string `json:"release_notes"`
	Mandatory       bool   `json:"mandatory"`
	Size            int64  `json:"size"`
	SizeFormatted   string `json:"size_formatted"`
	Checksum        string `json:"checksum"` // SHA256
	ReleaseDate     string `json:"release_date"`
	UpdateAvailable bool   `json:"update_available"`
	IsPrerelease    bool   `json:"is_prerelease"`
}

type UpdateStatus struct {
	Checking        bool        `json:"checking"`
	Downloading     bool        `json:"downloading"`
	Installing      bool        `json:"installing"`
	Progress        float64     `json:"progress"`
	Speed           string      `json:"speed"`
	ETA             string      `json:"eta"`
	Error           string      `json:"error"`
	Stage           string      `json:"stage"`
	UpdateAvailable bool        `json:"updateAvailable"`
	Info            *UpdateInfo `json:"info"`
}


