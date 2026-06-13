package domain

// PrinterInfo contains information about a printer
type PrinterInfo struct {
	Name      string `json:"name"`
	IsDefault bool   `json:"isDefault"`
	Status    string `json:"status"`
	PortName  string `json:"portName"`
}

// ReceiptItem represents an item on a thermal receipt
type ReceiptItem struct {
	Name  string  `json:"name"`
	Qty   int     `json:"qty"`
	Price float64 `json:"price"`
	Total float64 `json:"total"`
}

// CSVImportResult holds the result of a CSV import operation
type CSVImportResult struct {
	Success     bool     `json:"success"`
	TotalRows   int      `json:"totalRows"`
	Imported    int      `json:"imported"`
	Updated     int      `json:"updated"`
	Skipped     int      `json:"skipped"`
	Errors      []string `json:"errors"`
	ImportedIDs []string `json:"importedIds"`
}

// CSVExportResult holds the exported CSV data
type CSVExportResult struct {
	Data     string `json:"data"`
	Filename string `json:"filename"`
	Count    int    `json:"count"`
}

// ImageStorageStats returns statistics about image storage
type ImageStorageStats struct {
	TotalImages    int     `json:"totalImages"`
	TotalSizeBytes int64   `json:"totalSizeBytes"`
	TotalSizeMB    float64 `json:"totalSizeMB"`
	Base64Count    int     `json:"base64Count"` // Images still in DB
}

