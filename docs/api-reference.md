# 📡 مرجع API للواجهة الخلفية (API Reference)

يوثق هذا المستند جميع دوال Go المصدرة عبر Wails Bindings والمتاحة للواجهة الأمامية. يتم توليد TypeScript bindings تلقائياً في `frontend/wailsjs/go/`.

> **ملاحظة**: `New*` و `Startup(ctx)` هي دوال تهيئة داخلية ولا تُستدعى من الواجهة الأمامية.

---

## 1. كيفية الاستخدام (Usage)

```typescript
// استيراد مباشر من Wails auto-generated bindings
import { ProcessSale } from '../wailsjs/go/handlers/SaleHandler'

// أو عبر طبقة API المجمعة
import { api } from '../core/api'
const result = await api.sales.process(data)
```

---

## 2. المنتجات (ProductHandler)

**الملف**: `internal/handlers/product_handler.go`
**متغير API**: `api.products`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `GetAllProducts` | — | `[]Product` | — |
| `GetProductByID` | `id string` | `*Product` | — |
| `CreateProduct` | `product Product` | `error` | PermProducts |
| `UpdateProduct` | `product Product` | `error` | PermProducts |
| `DeleteProduct` | `id string` | `error` | PermProducts |
| `SearchProducts` | `query string` | `[]Product` | — |
| `GetStockMovements` | — | `[]StockMovement` | PermInventory |
| `LogStockMovement` | `productID, productName, movementType string, qty float64, reason string` | `error` | PermInventory |

---

## 3. المبيعات (SaleHandler)

**الملف**: `internal/handlers/sale_handler.go`
**متغير API**: `api.sales`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `GetSales` | `page, pageSize int, search, statusFilter, dateFilter string` | `*PaginatedSales` | PermSales |
| `GetSale` | `id string` | `*Sale` | PermSales |
| `GetSaleItems` | `saleID string` | `[]SaleItem` | PermSales |
| `ProcessSale` | `sale Sale` | `error` | PermSales |
| `ReturnSale` | `id string` | `error` | PermSales |
| `ReturnSalePartial` | `saleID, productID string, qtyToReturn float64` | `error` | PermSales |
| `DeleteSale` | `id string` | `error` | PermDeleteSales |
| `ParkSale` | `itemsJSON, customerName, customerID, note string, total, itemsCount float64` | `*ParkedSale` | PermSales |
| `GetParkedSales` | — | `[]ParkedSale` | PermSales |
| `GetParkedSalesCount` | — | `int` | PermSales |
| `RetrieveParkedSale` | `id uint` | `*ParkedSale` | PermSales |
| `DeleteParkedSale` | `id uint` | `error` | PermSales |
| `GetInstallmentSales` | — | `[]Sale` | PermSales |

---

## 4. المدفوعات والأقساط (PaymentHandler)

**الملف**: `internal/handlers/payment_handler.go`
**متغير API**: `api.payments`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `CreatePayment` | `payment Payment` | `*Payment` | PermSales |
| `GetPaymentsBySale` | `saleID string` | `[]Payment` | PermSales |
| `GetPaymentsByCustomer` | `customerID string` | `[]Payment` | PermCustomers |
| `DeletePayment` | `id uint` | `error` | PermSales |
| `PayInstallment` | `saleID string, installmentIndex int, amount float64, method string` | `error` | PermSales |
| `GetCustomerInstallments` | `customerID string` | `[]Sale` | PermCustomers |
| `GetInstallmentSummary` | `saleID string` | `*InstallmentSummaryResult` | PermSales |
| `CalculateInstallmentPlan` | `total, downPayment float64, months int` | `*InstallmentPlan` | PermSales |

---

## 5. الخزينة والمالية (FinanceHandler)

**الملف**: `internal/handlers/finance_handler.go`
**متغير API**: `api.expenses` / `api.shift` / `api.purchaseOrders`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `GetExpenses` | — | `[]Expense` | PermFinance |
| `SaveExpense` | `e Expense` | `error` | PermFinance |
| `DeleteExpense` | `id string` | `error` | PermFinance |
| `GetCategories` | — | `[]Category` | PermFinance |
| `SaveCategory` | `c Category` | `error` | PermFinance |
| `DeleteCategory` | `id string, force bool` | `error` | PermFinance |
| `GetPreferences` | — | `*AppPreferences` | — |
| `UpdatePreferences` | `newPrefs AppPreferences` | `error` | PermSettings |
| `VerifyAdminPin` | `pin string` | `(bool, error)` | — |
| `OpenShift` | `staffID, staffName string, openingBalance float64` | `*Shift` | PermSales |
| `CloseShift` | `shiftID string, closingBalance float64, note string` | `*Shift` | PermSales |
| `GetActiveShift` | — | `*Shift` | PermSales |
| `AddCashMovement` | `shiftID, moveType, reason, staffID, staffName string, amount float64` | `*CashMovement` | PermFinance |
| `GetShiftMovements` | `shiftID string` | `[]CashMovement` | PermFinance |
| `GetShiftHistory` | `limit int` | `[]Shift` | PermSales |
| `CreatePurchaseOrder` | `order PurchaseOrder` | `*PurchaseOrder` | PermInventory |
| `GetPurchaseOrders` | `status, supplierID string` | `[]PurchaseOrder` | PermInventory |
| `GetPurchaseOrder` | `id string` | `*PurchaseOrder` | PermInventory |
| `UpdatePurchaseOrder` | `order PurchaseOrder` | `error` | PermInventory |
| `DeletePurchaseOrder` | `id string` | `error` | PermInventory |
| `CancelPurchaseOrder` | `id string` | `error` | PermInventory |
| `ReceivePurchaseOrder` | `orderID string, items []PurchaseOrderItem` | `error` | PermInventory |
| `PayPurchaseOrder` | `orderID string, amount float64, method string` | `error` | PermFinance |
| `GetPurchaseOrderStats` | — | `*PurchaseOrderStats` | PermReports |

---

## 6. العملاء والموردون (CRMHandler)

**الملف**: `internal/handlers/crm_handler.go`
**متغير API**: `api.customers` / `api.suppliers`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `GetCustomers` | — | `[]Customer` | PermCustomers |
| `SearchCustomers` | `query string` | `[]Customer` | PermCustomers |
| `SaveCustomer` | `c Customer` | `error` | PermCustomers |
| `DeleteCustomer` | `id string, force bool` | `error` | PermCustomers |
| `GetSuppliers` | — | `[]Supplier` | PermInventory |
| `SaveSupplier` | `s Supplier` | `error` | PermInventory |
| `DeleteSupplier` | `id string, force bool` | `error` | PermInventory |

---

## 7. الموظفون والمصادقة (StaffHandler)

**الملف**: `internal/handlers/staff_handler.go`
**متغير API**: `api.staff`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `CreateStaff` | `s Staff, password string` | `*Staff` | PermStaffManage |
| `UpdateStaff` | `s Staff` | `error` | PermStaffManage |
| `UpdateStaffPassword` | `id, newPassword string` | `error` | PermStaffManage |
| `DeleteStaff` | `id string, force bool` | `error` | PermStaffManage |
| `GetStaff` | `id string` | `*Staff` | PermStaffManage |
| `GetAllStaff` | — | `[]Staff` | PermStaffManage |
| `GetActiveStaff` | — | `[]Staff` | PermStaffManage |
| `ToggleStaffStatus` | `id string` | `error` | PermStaffManage |
| `AuthenticateByUsername` | `username, password string` | `*AuthResult` | — |
| `AuthenticateByPIN` | `pin string` | `*AuthResult` | — |
| `Logout` | — | — | — |
| `HasPermission` | `staffID, permission string` | `(bool, error)` | — |
| `UpdateStaffPIN` | `id, pin string` | `error` | — |
| `GetStaffCount` | — | `(int64, error)` | PermStaffManage |
| `IsUsingDefaultPassword` | `staffID string` | `(bool, error)` | — |

---

## 8. الإحصائيات والتقارير (StatsHandler)

**الملف**: `internal/handlers/stats_handler.go`
**متغير API**: `api.stats`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `GetDashboardStats` | `timeRange string` | `*DashboardStats` | PermReports |
| `GetMonthlyComparison` | — | `*MonthlyComparison` | PermReports |

---

## 9. الطباعة (PrintHandler)

**الملف**: `internal/handlers/print_handler.go`
**متغير API**: `api.print`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `GenerateInvoicePDF` | `saleID, format string` | `(string, error)` | PermSales |
| `GenerateQRCode` | `data string, size int` | `(string, error)` | — |
| `GetAvailablePrinters` | — | `[]PrinterInfo` | — |
| `GetDefaultPrinter` | — | `(string, error)` | — |
| `PrintReceiptDirect` | `printerName, storeName string, items []ReceiptItem, total float64, currency string` | `error` | PermSales |
| `TestPrinter` | `printerName string` | `error` | — |
| `PrintBitmapReceipt` | `printerName, base64Image string` | `error` | — |

---

## 10. النسخ الاحتياطي (BackupHandler)

**الملف**: `internal/handlers/backup_handler.go`
**متغير API**: `api.backup`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `CreateBackup` | — | `*BackupResult` | PermExportData |
| `ListBackups` | — | `[]BackupInfo` | PermExportData |
| `RestoreBackup` | `backupPath string` | `error` | PermSettings |
| `DeleteBackup` | `backupPath string` | `error` | PermExportData |
| `CleanOldBackups` | `retainDays int` | `(int, error)` | PermSettings |
| `ResetDatabase` | — | `error` | PermSettings |
| `ExportDatabase` | — | `*DatabaseExport` | PermExportData |
| `ImportDatabase` | `data DatabaseExport` | `error` | PermSettings |
| `ExportProductsCSV` | — | `*CSVExportResult` | PermExportData |
| `ImportProductsCSV` | `csvData string, updateExisting bool` | `*CSVImportResult` | PermProducts |
| `GetCSVTemplate` | — | `string` | — |
| `MigrateImagesToFilesystem` | — | `(int, error)` | — |
| `GetImageStorageStats` | — | `*ImageStorageStats` | — |

---

## 11. الإعدادات (SettingsHandler)

**الملف**: `internal/handlers/settings_handler.go`
**متغير API**: `api.prefs` / `api.system`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `GetPreferences` | — | `*AppPreferences` | — |
| `UpdatePreferences` | `prefs AppPreferences` | `error` | PermSettings |
| `VerifyAdminPin` | `pin string` | `bool` | — |
| `GetDeviceID` | — | `(string, error)` | — |
| `GetCurrentVersion` | — | `string` | — |
| `CheckForUpdates` | — | `*UpdateInfo` | — |
| `GetUpdateStatus` | — | `UpdateStatus` | — |
| `DownloadUpdate` | `url string` | `(string, error)` | — |
| `InstallUpdate` | `installerPath string` | `error` | — |
| `SkipVersion` | `version string` | `error` | — |
| `EnableAutoStart` | — | `error` | PermSettings |
| `DisableAutoStart` | — | `error` | PermSettings |
| `IsAutoStartEnabled` | — | `bool` | — |
| `GetCrashReports` | — | `[]string` | PermSettings |
| `GetCrashReportContent` | `filename string` | `(string, error)` | PermSettings |
| `ClearCrashReports` | — | `error` | PermSettings |
| `ShowNativeNotification` | `title, message, notifType string` | `error` | — |
| `FetchGlobalAIKeys` | — | `[]string` | — |
| `SaveGlobalAIKeys` | `keys []string, userToken string` | `error` | PermSettings |

---

## 12. شبكة LAN (LanHandler)

**الملف**: `internal/handlers/lan_handler.go`
**متغير API**: `api.lan`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `StartLanServer` | — | `error` | PermSettings |
| `StopLanServer` | — | `error` | PermSettings |
| `GetLanServerStatus` | — | `LanServerStatus` | — |
| `ConnectToLanServer` | `serverIP string, port int` | `error` | PermSettings |
| `DisconnectFromLanServer` | — | — | PermSettings |
| `GetLanClientStatus` | — | `LanClientStatus` | — |
| `GetLocalIP` | — | `(string, error)` | — |
| `DiscoverServers` | — | `[]DiscoveredServer` | — |
| `TestLanConnection` | — | `string` | — |
| `GenerateServerSecret` | — | `string` | PermSettings |
| `GetServerSecret` | — | `string` | PermSettings |
| `GetConnectedClients` | — | `[]ConnectedClient` | PermSettings |
| `DisconnectLanClient` | `deviceID string` | `error` | PermSettings |
| `SuspendLanClient` | `deviceID string` | `error` | PermSettings |
| `ResumeLanClient` | `deviceID string` | `error` | PermSettings |
| `BlockLanDevice` | `deviceID, deviceName, reason string` | `error` | PermSettings |
| `UnblockLanDevice` | `id uint` | `error` | PermSettings |
| `GetBlockedDevices` | — | `[]BlockedDevice` | PermSettings |

---

## 13. التكامل السحابي (CloudHandler)

**الملف**: `internal/handlers/cloud_handler.go`
**متغير API**: `api.cloud`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `InitGoogleAuth` | — | `(string, error)` | — |
| `CompleteGoogleAuth` | — | `error` | — |
| `IsGoogleConnected` | — | `bool` | — |
| `DisconnectGoogle` | — | `error` | — |
| `UploadBackupToDrive` | `filename, content string` | `(string, error)` | PermSettings |
| `Register` | `email, password, storeName string` | `*SupabaseAuthResult` | — |
| `Login` | `email, password string` | `*SupabaseAuthResult` | — |
| `Logout` | — | — | — |
| `RecoverPassword` | `email string` | `*SupabaseAuthResult` | — |
| `DeleteCurrentUser` | — | `error` | — |
| `IsLoggedIn` | — | `bool` | — |
| `GetCurrentUser` | — | `*UserSession` | — |
| `CheckSessionValidity` | — | `*SessionValidityResult` | — |
| `CloudBackupNow` | — | `error` | PermSettings |
| `ListCloudBackupsForUser` | — | `[]CloudBackup` | PermSettings |
| `DeleteCloudBackup` | `backupID string` | `error` | PermSettings |
| `RestoreCloudBackup` | `backupID string` | `error` | PermSettings |
| `SetupZohoIntegration` | `clientID, clientSecret, authCode string` | `error` | PermSettings |
| `GetZohoStatus` | — | `map[string]interface{}` | — |
| `DisableZohoIntegration` | — | `error` | PermSettings |
| `VerifyLicense` | `key string` | `*LicenseResult` | — |
| `ActivateLicense` | `key string` | `*LicenseResult` | — |
| `GetCachedLicense` | — | `*LicenseResult` | — |
| `GetStoredLicenseKey` | — | `string` | — |
| `GetUserLicenseStatus` | — | `*LicenseResult` | — |
| `KeepAliveSupabase` | — | — | — |

---

## 14. الخصومات والعروض (DiscountHandler)

**الملف**: `internal/handlers/discount_handler.go`
**متغير API**: `api.discounts`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `GetAllDiscounts` | — | `[]Discount` | PermProducts |
| `GetActiveDiscounts` | — | `[]Discount` | PermProducts |
| `GetDiscount` | `id string` | `(Discount, error)` | PermProducts |
| `CreateDiscount` | `d Discount` | `(Discount, error)` | PermProducts |
| `UpdateDiscount` | `d Discount` | `error` | PermProducts |
| `DeleteDiscount` | `id string` | `error` | PermProducts |
| `ToggleDiscountStatus` | `id string` | `error` | PermProducts |
| `ValidateCoupon` | `code string` | `(Discount, error)` | — |
| `ApplyDiscount` | `id string` | `error` | PermSales |

---

## 15. الذكاء الاصطناعي (AIHandler)

**الملف**: `internal/handlers/ai_handler.go`
**متغير API**: `api.ai`

| الدالة | المدخلات | المخرجات | الصلاحية |
|--------|---------|---------|----------|
| `AI_GenerateStream` | `prompt string` | `error` (بث عبر Events) | — |
| `AI_CancelStream` | — | — | — |

---

## 16. دوال عامة من App struct (app.go)

**الملف**: `app.go`
**متغير API**: `api.system` / مستوردة مباشرة

| الدالة | المدخلات | المخرجات |
|--------|---------|----------|
| `GetCSVTemplate` | — | `string` |
| `ExportProductsCSV` | — | `*CSVExportResult` |
| `ImportProductsCSV` | `csvData string, updateExisting bool` | `*CSVImportResult` |
| `ExportProductsCSVNative` | — | `*CSVExportResult` |
| `DownloadProductsTemplateNative` | — | `(bool, error)` |
| `ImportProductsCSVNative` | `updateExisting bool` | `*CSVImportResult` |
| `ExportDatabaseBackupNative` | — | `(bool, error)` |
| `ImportDatabaseBackupNative` | — | `(bool, error)` |
| `CalculateInstallmentPlan` | `total, downPayment float64, months int` | `*InstallmentPlan` |
| `GetBackupConfig` | — | `*BackupConfig` |
| `SetCloudAutoSync` | `enabled bool` | `error` |
| `GetInstallmentAlertSummary` | — | `map[string]interface{}` |
| `AI_GenerateStream` | `prompt string` | `error` |
| `AI_CancelStream` | — | — |
| `ForceQuit` | — | — |
| `MinimizeWindow` | — | — |
