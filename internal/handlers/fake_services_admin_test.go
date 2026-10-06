package handlers

import (
	"beidar-desktop/internal/core/domain"
)

// ---------- Finance ----------

type fakeFinanceService struct {
	domain.FinanceService

	expenses  []domain.Expense
	cats      []domain.Category
	prefs     *domain.AppPreferences
	shift     *domain.Shift
	movement  *domain.CashMovement
	order     *domain.PurchaseOrder
	orders    []domain.PurchaseOrder
	poStats   *domain.PurchaseOrderStats
	pinOK     bool
	lastPrefs domain.AppPreferences
	err       error
}

func (f *fakeFinanceService) GetExpenses(month string) ([]domain.Expense, error) {
	return f.expenses, f.err
}

func (f *fakeFinanceService) SaveExpense(e domain.Expense) error { return f.err }

func (f *fakeFinanceService) DeleteExpense(id string) error { return f.err }

func (f *fakeFinanceService) GetCategories() ([]domain.Category, error) { return f.cats, f.err }

func (f *fakeFinanceService) SaveCategory(c domain.Category) error { return f.err }

func (f *fakeFinanceService) DeleteCategory(id string, force bool) error { return f.err }

func (f *fakeFinanceService) GetPreferences() (*domain.AppPreferences, error) {
	return f.prefs, f.err
}

func (f *fakeFinanceService) UpdatePreferences(newPrefs domain.AppPreferences) error {
	f.lastPrefs = newPrefs
	return f.err
}

func (f *fakeFinanceService) VerifyAdminPin(pin string) (bool, error) { return f.pinOK, f.err }

func (f *fakeFinanceService) OpenShift(staffID, staffName string, openingBalance domain.Amount) (*domain.Shift, error) {
	return f.shift, f.err
}

func (f *fakeFinanceService) CloseShift(shiftID string, closingBalance domain.Amount, note string) (*domain.Shift, error) {
	return f.shift, f.err
}

func (f *fakeFinanceService) GetActiveShift() (*domain.Shift, error) { return f.shift, f.err }

func (f *fakeFinanceService) AddCashMovement(shiftID, moveType, reason, staffID, staffName string, amount domain.Amount) (*domain.CashMovement, error) {
	return f.movement, f.err
}

func (f *fakeFinanceService) GetShiftMovements(shiftID string) ([]domain.CashMovement, error) {
	if f.movement == nil {
		return nil, f.err
	}
	return []domain.CashMovement{*f.movement}, f.err
}

func (f *fakeFinanceService) GetShiftHistory(limit int) ([]domain.Shift, error) {
	if f.shift == nil {
		return nil, f.err
	}
	return []domain.Shift{*f.shift}, f.err
}

func (f *fakeFinanceService) CreatePurchaseOrder(order domain.PurchaseOrder) (*domain.PurchaseOrder, error) {
	return f.order, f.err
}

func (f *fakeFinanceService) GetPurchaseOrders(status string, supplierID string) ([]domain.PurchaseOrder, error) {
	return f.orders, f.err
}

func (f *fakeFinanceService) GetPurchaseOrder(id string) (*domain.PurchaseOrder, error) {
	return f.order, f.err
}

func (f *fakeFinanceService) UpdatePurchaseOrder(order domain.PurchaseOrder) error { return f.err }

func (f *fakeFinanceService) DeletePurchaseOrder(id string) error { return f.err }

func (f *fakeFinanceService) CancelPurchaseOrder(id string) error { return f.err }

func (f *fakeFinanceService) ReceivePurchaseOrder(orderID string, items []domain.PurchaseOrderItem) error {
	return f.err
}

func (f *fakeFinanceService) PayPurchaseOrder(orderID string, amount domain.Amount, method string) error {
	return f.err
}

func (f *fakeFinanceService) GetPurchaseOrderStats() (*domain.PurchaseOrderStats, error) {
	return f.poStats, f.err
}

// ---------- Backup ----------

type fakeBackupService struct {
	domain.BackupService

	result    *domain.BackupResult
	backups   []domain.BackupInfo
	count     int
	export    *domain.DatabaseExport
	csv       *domain.CSVExportResult
	imported  *domain.CSVImportResult
	template  string
	migrated  int
	stats     *domain.ImageStorageStats
	lastClean int
	err       error
}

func (f *fakeBackupService) CreateBackup() (*domain.BackupResult, error) { return f.result, f.err }

func (f *fakeBackupService) ListBackups() ([]domain.BackupInfo, error) { return f.backups, f.err }

func (f *fakeBackupService) RestoreBackup(backupPath string) error { return f.err }

func (f *fakeBackupService) DeleteBackup(backupPath string) error { return f.err }

func (f *fakeBackupService) CleanOldBackups(retainDays int) (int, error) {
	f.lastClean = retainDays
	return f.count, f.err
}

func (f *fakeBackupService) ResetDatabase() error { return f.err }

func (f *fakeBackupService) ExportDatabase() (*domain.DatabaseExport, error) { return f.export, f.err }

func (f *fakeBackupService) ImportDatabase(data domain.DatabaseExport) error { return f.err }

func (f *fakeBackupService) ExportProductsCSV() (*domain.CSVExportResult, error) { return f.csv, f.err }

func (f *fakeBackupService) ImportProductsCSV(csvData string, updateExisting bool) (*domain.CSVImportResult, error) {
	return f.imported, f.err
}

func (f *fakeBackupService) GetCSVTemplate() string { return f.template }

func (f *fakeBackupService) MigrateImagesToFilesystem() (int, error) { return f.migrated, f.err }

func (f *fakeBackupService) GetImageStorageStats() (*domain.ImageStorageStats, error) {
	return f.stats, f.err
}

// ---------- Settings ----------

type fakeSettingsService struct {
	domain.SettingsService

	prefs        *domain.AppPreferences
	update       *domain.UpdateInfo
	status       domain.UpdateStatus
	downloadPath string
	crashReports []string
	crashContent string
	aiKeys       []string
	groqKeys     []string
	deviceID     string
	autoStart    bool
	lastPrefs    domain.AppPreferences
	pinOK        bool
	err          error
}

func (f *fakeSettingsService) GetPreferences() (*domain.AppPreferences, error) {
	return f.prefs, f.err
}

func (f *fakeSettingsService) UpdatePreferences(prefs domain.AppPreferences) error {
	f.lastPrefs = prefs
	return f.err
}

func (f *fakeSettingsService) VerifyAdminPin(pin string) bool { return f.pinOK }

func (f *fakeSettingsService) GetDeviceID() (string, error) { return f.deviceID, f.err }

func (f *fakeSettingsService) IsAutoStartEnabled() bool { return f.autoStart }

func (f *fakeSettingsService) EnableAutoStart() error { return f.err }

func (f *fakeSettingsService) DisableAutoStart() error { return f.err }

func (f *fakeSettingsService) GetCrashReports() ([]string, error) { return f.crashReports, f.err }

func (f *fakeSettingsService) GetCrashReportContent(filename string) (string, error) {
	return f.crashContent, f.err
}

func (f *fakeSettingsService) ClearCrashReports() error { return f.err }

func (f *fakeSettingsService) CheckForUpdates() (*domain.UpdateInfo, error) { return f.update, f.err }

func (f *fakeSettingsService) GetUpdateStatus() domain.UpdateStatus { return f.status }

func (f *fakeSettingsService) DownloadUpdate(url, expectedChecksum string) (string, error) {
	return f.downloadPath, f.err
}

func (f *fakeSettingsService) InstallUpdate(installerPath string) error { return f.err }

func (f *fakeSettingsService) SkipVersion(version string) error { return f.err }

func (f *fakeSettingsService) FetchGlobalAIKeys() ([]string, error) { return f.aiKeys, f.err }

func (f *fakeSettingsService) FetchGlobalGroqKeys() ([]string, error) { return f.groqKeys, f.err }

func (f *fakeSettingsService) SaveGlobalAIKeys(keys []string, userToken string) error { return f.err }

func (f *fakeSettingsService) SaveGlobalGroqKeys(keys []string, userToken string) error { return f.err }
