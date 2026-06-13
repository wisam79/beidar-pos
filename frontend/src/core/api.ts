import * as BackupHandler from '../../wailsjs/go/handlers/BackupHandler';
import * as CRMHandler from '../../wailsjs/go/handlers/CRMHandler';
import * as CloudHandler from '../../wailsjs/go/handlers/CloudHandler';
import * as FinanceHandler from '../../wailsjs/go/handlers/FinanceHandler';
import * as LanHandler from '../../wailsjs/go/handlers/LanHandler';
import * as PaymentHandler from '../../wailsjs/go/handlers/PaymentHandler';
import * as PrintHandler from '../../wailsjs/go/handlers/PrintHandler';
import * as ProductHandler from '../../wailsjs/go/handlers/ProductHandler';
import * as SaleHandler from '../../wailsjs/go/handlers/SaleHandler';
import * as SettingsHandler from '../../wailsjs/go/handlers/SettingsHandler';
import * as StaffHandler from '../../wailsjs/go/handlers/StaffHandler';
import * as StatsHandler from '../../wailsjs/go/handlers/StatsHandler';
import * as DiscountHandler from '../../wailsjs/go/handlers/DiscountHandler';
import * as App from '../../wailsjs/go/main/App';

import * as Models from '../../wailsjs/go/models';

// Re-export models for convenience
export type Product = Models.domain.Product;
export type Sale = Models.domain.Sale;
export type Customer = Models.domain.Customer;
export type DashboardStats = Models.domain.DashboardStats;
export type StockMovement = Models.domain.StockMovement;
export type Expense = Models.domain.Expense;
export type Supplier = Models.domain.Supplier;
export type CategoryDef = Models.domain.Category;
export type CategoryField = Models.domain.CategoryField;
export type AppPreferences = Models.domain.AppPreferences;
export type Discount = Models.domain.Discount;

// Staff Types - Use backend types directly
export type Staff = Models.domain.Staff;
export type AuthResult = Models.domain.AuthResult;
export type StaffRole = 'admin' | 'manager' | 'cashier' | 'viewer';

// License Types - Use backend types directly
export type LicenseResult = Models.domain.LicenseResult;
export type AdminLicense = Models.domain.LicenseInfo;
export type AdminLogEntry = Models.domain.AdminLogEntry;

// Parked Sale (from backend)
export interface ParkedSaleDB {
    id: number;
    items_json: string;
    customer_name: string;
    customer_id: string;
    note: string;
    total: number;
    items_count: number;
    created_at: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💳 Payment - Records individual payment transactions
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Represents a payment transaction linked to a sale.
 */
export interface Payment {
    id?: number;
    saleId: string;          // Linked invoice/sale
    customerId: string;       // Customer who made payment
    amount: number;           // Payment amount
    method: string;           // cash, card, transfer, etc.
    note?: string;            // Optional payment note
    timestamp: number;        // Payment date/time
    staffId?: string;         // Staff who processed payment
    instIndex?: number;       // Installment index if applicable
}

export interface InstallmentSummary {
    total: number;           // Total installments
    paid: number;            // Paid installments
    remaining: number;       // Remaining amount
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 PURCHASE ORDERS - Order management from suppliers
// ═══════════════════════════════════════════════════════════════════════════════
export type PurchaseOrderStatus = 'pending' | 'partial' | 'received' | 'cancelled' | string;

export interface PurchaseOrderItem {
    id?: number;
    productId: string;
    productName: string;
    quantity: number;
    receivedQty: number;
    unitCost: number;
    total: number;
}

export interface PurchaseOrder {
    id?: string;
    supplierId: string;
    supplierName?: string;
    status?: PurchaseOrderStatus | string; // Accept backend string
    totalAmount?: number;
    paidAmount?: number;
    note?: string;
    createdAt?: number;
    receivedAt?: number;
    items: PurchaseOrderItem[];
}

export interface ReceiveOrderItem {
    productId: string;
    receivedQty: number;
}

// API Bridge
/**
 * Main API bridge object for communicating with the Wails backend.
 * Provides typed methods for all backend operations.
 */
export const api = {
    system: {
        greet: (name: string) => Promise.resolve("Hello " + name),
        getDeviceId: () => SettingsHandler.GetDeviceID(),
        showMessage: (title: string, message: string) => SettingsHandler.ShowNativeNotification(title, message, "info"),
    },
    products: {
        list: (page: number, pageSize: number, search: string, category: string, supplier: string, status: string) => {
            return ProductHandler.GetAllProducts().then(allProducts => {
                let filtered = allProducts;
                if (search) {
                    const q = search.toLowerCase();
                    filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q));
                }
                if (category && category !== 'الكل' && category !== 'all') {
                    filtered = filtered.filter(p => p.category === category);
                }
                if (supplier) {
                    filtered = filtered.filter(p => p.supplier === supplier);
                }
                if (status === 'low') {
                    filtered = filtered.filter(p => p.stock <= p.minStock && p.stock > 0);
                } else if (status === 'out') {
                    filtered = filtered.filter(p => p.stock <= 0);
                }

                // calculate stats
                let totalStock = 0;
                let totalValue = 0;
                let totalCost = 0;
                filtered.forEach(p => {
                    totalStock += p.stock;
                    totalValue += p.price * p.stock;
                    totalCost += p.cost * p.stock;
                });

                const total = filtered.length;
                const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;
                const start = page > 0 ? (page - 1) * pageSize : 0;
                const paginatedData = pageSize > 0 ? filtered.slice(start, start + pageSize) : filtered;

                return {
                    data: paginatedData,
                    total: total,
                    totalPages: totalPages,
                    page: page,
                    stats: {
                        totalStock,
                        totalValue,
                        totalCost,
                        profit: totalValue - totalCost
                    }
                } as PaginatedProducts;
            });
        },
        save: (p: Product) => {
            if (p.id) {
                return ProductHandler.UpdateProduct(p);
            } else {
                return ProductHandler.CreateProduct(p);
            }
        },
        delete: (id: string, force?: boolean) => ProductHandler.DeleteProduct(id),
        search: (q: string) => ProductHandler.SearchProducts(q),
    },
    sales: {
        list: (page: number, pageSize: number, search: string, status: string, date: string) =>
            SaleHandler.GetSales(page, pageSize, search, status, date),
        get: (id: string) => SaleHandler.GetSale(id),
        process: (s: Models.domain.Sale) => SaleHandler.ProcessSale(s),
        delete: (id: string) => SaleHandler.DeleteSale(id),
        return: (id: string) => SaleHandler.ReturnSale(id),
        // Parked Sales
        park: (itemsJSON: string, customerName: string, customerID: string, note: string, total: number, itemsCount: number) =>
            SaleHandler.ParkSale(itemsJSON, customerName, customerID, note, total, itemsCount),
        getParked: () => SaleHandler.GetParkedSales(),
        getParkedCount: () => SaleHandler.GetParkedSalesCount(),
        retrieveParked: (id: number) => SaleHandler.RetrieveParkedSale(id),
        deleteParked: (id: number) => SaleHandler.DeleteParkedSale(id),
    },
    customers: {
        list: () => CRMHandler.GetCustomers(),
        save: (c: Customer) => CRMHandler.SaveCustomer(c),
        delete: (id: string, force?: boolean) => CRMHandler.DeleteCustomer(id, force || false),
    },
    expenses: {
        list: () => FinanceHandler.GetExpenses(),
        save: (e: Expense) => FinanceHandler.SaveExpense(e),
        delete: (id: string) => FinanceHandler.DeleteExpense(id),
    },
    suppliers: {
        list: () => CRMHandler.GetSuppliers(),
        save: (s: Supplier) => CRMHandler.SaveSupplier(s),
        delete: (id: string, force?: boolean) => CRMHandler.DeleteSupplier(id, force || false),
    },
    stock: {
        movements: () => ProductHandler.GetStockMovements(),
        log: (productId: string, productName: string, type: string, qty: number, reason: string) => ProductHandler.LogStockMovement(productId, productName, type, qty, reason),
    },
    categories: {
        list: () => FinanceHandler.GetCategories(),
        save: (c: CategoryDef) => FinanceHandler.SaveCategory(c),
        delete: (id: string, force?: boolean) => FinanceHandler.DeleteCategory(id, force || false),
    },
    discounts: {
        list: () => DiscountHandler.GetAllDiscounts(),
        listActive: () => DiscountHandler.GetActiveDiscounts(),
        get: (id: string) => DiscountHandler.GetDiscount(id),
        save: (d: Discount) => DiscountHandler.CreateDiscount(d),
        update: (d: Discount) => DiscountHandler.UpdateDiscount(d),
        delete: (id: string) => DiscountHandler.DeleteDiscount(id),
        toggle: (id: string) => DiscountHandler.ToggleDiscountStatus(id),
        validateCoupon: (code: string) => DiscountHandler.ValidateCoupon(code),
        apply: (id: string) => DiscountHandler.ApplyDiscount(id),
    },
    stats: {
        getDashboard: (timeRange: string = 'week') => StatsHandler.GetDashboardStats(timeRange),
        getMonthlyComparison: () => StatsHandler.GetMonthlyComparison(),
    },
    prefs: {
        get: () => SettingsHandler.GetPreferences(),
        set: (p: AppPreferences) => SettingsHandler.UpdatePreferences(p),
    },
    db: {
        reset: () => BackupHandler.ResetDatabase(),
        export: () => BackupHandler.ExportDatabase(),
        import: (data: Models.domain.DatabaseExport) => BackupHandler.ImportDatabase(data),
        createBackup: () => BackupHandler.CreateBackup(),
    },
    print: {
        generatePDF: (saleId: string, format: 'thermal' | 'a4') => PrintHandler.GenerateInvoicePDF(saleId, format),
        generateQR: (data: string, size: number) => PrintHandler.GenerateQRCode(data, size),
        bitmapReceipt: (printerName: string, base64Image: string): Promise<void> => PrintHandler.PrintBitmapReceipt(printerName, base64Image),
    },
    auth: {
        verifyPin: (pin: string) => SettingsHandler.VerifyAdminPin(pin),
    },
    staff: {
        list: () => StaffHandler.GetAllStaff(),
        listActive: () => StaffHandler.GetActiveStaff(),
        get: (id: string) => StaffHandler.GetStaff(id),
        create: (s: Staff, password: string) => StaffHandler.CreateStaff(s, password),
        update: (s: Staff) => StaffHandler.UpdateStaff(s),
        updatePassword: (id: string, newPassword: string) => StaffHandler.UpdateStaffPassword(id, newPassword),
        updatePIN: (id: string, pin: string) => StaffHandler.UpdateStaffPIN(id, pin),
        delete: (id: string, force?: boolean) => StaffHandler.DeleteStaff(id, force || false),
        toggle: (id: string) => StaffHandler.ToggleStaffStatus(id),
        loginUsername: (username: string, password: string) => StaffHandler.AuthenticateByUsername(username, password),
        loginPIN: (pin: string) => StaffHandler.AuthenticateByPIN(pin),
        authenticate: (username: string, password: string) => StaffHandler.AuthenticateByUsername(username, password),
        authenticateByPIN: (pin: string) => StaffHandler.AuthenticateByPIN(pin),
        hasPermission: (staffId: string, permission: string) => StaffHandler.HasPermission(staffId, permission),
        count: () => StaffHandler.GetStaffCount(),
        isUsingDefaultPassword: (staffId: string) => StaffHandler.IsUsingDefaultPassword(staffId),
    },
    license: {
        verify: (key: string) => CloudHandler.VerifyLicense(key),
        activate: (key: string) => CloudHandler.ActivateLicense(key),
        getCached: () => CloudHandler.GetCachedLicense(),
        getStoredKey: () => CloudHandler.GetStoredLicenseKey(),
        getUserLicenseStatus: () => CloudHandler.GetUserLicenseStatus(),
        checkStatus: (key: string) => CloudHandler.CheckLicenseStatus(key),
    },
    admin: {
        setMasterKey: (key: string) => CloudHandler.SetMasterKey(key),
        login: (username: string, password: string) => CloudHandler.AdminLogin(username, password),
        fetchLicenses: () => CloudHandler.FetchAllLicenses(),
        createLicense: (name: string, phone: string, months: number, features: Record<string, boolean>) =>
            CloudHandler.CreateLicense(name, phone, months, features),
        updateStatus: (id: number, status: string) => CloudHandler.UpdateLicenseStatus(id, status),
        extendLicense: (id: number, expiry: string, months: number) => CloudHandler.ExtendLicense(id, expiry, months),
        resetToTrial: (id: number) => CloudHandler.ResetLicenseToTrial(id),
        updatePaymentStatus: (id: number, isPaid: boolean) => CloudHandler.UpdatePaymentStatus(id, isPaid),
        updateFeatures: (id: number, features: Record<string, boolean>) => CloudHandler.UpdateLicenseFeatures(id, features),
        deleteLicense: (id: number) => CloudHandler.DeleteLicenseRemote(id),
        fetchLogs: () => CloudHandler.FetchAdminLogs(),
        logAction: (user: string, action: string, target: string, details: string) =>
            CloudHandler.LogAdminAction(user, action, target, details),
        getUserDetails: (userId: string) => CloudHandler.GetLicenseUserDetails(userId),
    },
    payments: {
        create: (payment: Payment) => PaymentHandler.CreatePayment(payment as Models.domain.Payment),
        getBySale: (saleId: string) => PaymentHandler.GetPaymentsBySale(saleId),
        getByCustomer: (customerId: string) => PaymentHandler.GetPaymentsByCustomer(customerId),
        delete: (id: number) => PaymentHandler.DeletePayment(id),
        payInstallment: (saleId: string, installmentIndex: number, amount: number, method: string) =>
            PaymentHandler.PayInstallment(saleId, installmentIndex, amount, method),
        getCustomerInstallments: (customerId: string) => PaymentHandler.GetCustomerInstallments(customerId),
        getInstallmentSummary: (saleId: string) => PaymentHandler.GetInstallmentSummary(saleId),
    },
    drive: {
        initAuth: () => CloudHandler.InitGoogleAuth(),
        completeAuth: () => CloudHandler.CompleteGoogleAuth(),
        isConnected: () => CloudHandler.IsGoogleConnected(),
        disconnect: () => CloudHandler.DisconnectGoogle(),
        uploadBackup: (filename: string, content: string) => CloudHandler.UploadBackupToDrive(filename, content),
    },
    lan: {
        startServer: () => LanHandler.StartLanServer(),
        stopServer: () => LanHandler.StopLanServer(),
        getServerStatus: () => LanHandler.GetLanServerStatus(),
        connect: (ip: string, port: number = 0) => LanHandler.ConnectToLanServer(ip, port),
        disconnect: () => LanHandler.DisconnectFromLanServer(),
        getClientStatus: () => LanHandler.GetLanClientStatus(),
        getLocalIP: () => LanHandler.GetLocalIP(),
        discoverServers: () => LanHandler.DiscoverServers(),
        testConnection: () => LanHandler.TestLanConnection(),
        getConnectedClients: () => LanHandler.GetConnectedClients(),
        disconnectClient: (deviceId: string) => LanHandler.DisconnectLanClient(deviceId),
        suspendClient: (deviceId: string) => LanHandler.SuspendLanClient(deviceId),
        resumeClient: (deviceId: string) => LanHandler.ResumeLanClient(deviceId),
        blockDevice: (deviceId: string, deviceName: string, reason: string) =>
            LanHandler.BlockLanDevice(deviceId, deviceName, reason),
        getBlockedDevices: () => LanHandler.GetBlockedDevices(),
        unblockDevice: (id: number) => LanHandler.UnblockLanDevice(id),
    },
    cloud: {
        register: (email: string, password: string, storeName: string) =>
            CloudHandler.Register(email, password, storeName),
        login: (email: string, password: string) =>
            CloudHandler.Login(email, password),
        recoverPassword: (email: string) => CloudHandler.RecoverPassword(email),
        logout: () => CloudHandler.Logout(),
        isLoggedIn: () => CloudHandler.IsLoggedIn(),
        getCurrentUser: () => CloudHandler.GetCurrentUser(),
        checkSession: () => CloudHandler.CheckSessionValidity(),
        deleteAccount: () => CloudHandler.DeleteCurrentUser(),
        backupNow: () => CloudHandler.CloudBackupNow(),
        listBackups: () => CloudHandler.ListCloudBackupsForUser(),
        deleteBackup: (id: string) => CloudHandler.DeleteCloudBackup(id),
        restoreBackup: (id: string) => CloudHandler.RestoreCloudBackup(id),
    },
    shift: {
        open: (staffId: string, staffName: string, openingBalance: number) =>
            FinanceHandler.OpenShift(staffId, staffName, openingBalance),
        close: (shiftId: string, closingBalance: number, note: string) =>
            FinanceHandler.CloseShift(shiftId, closingBalance, note),
        getActive: () => FinanceHandler.GetActiveShift(),
        addMovement: (shiftId: string, type: string, reason: string, staffId: string, staffName: string, amount: number) =>
            FinanceHandler.AddCashMovement(shiftId, type, reason, staffId, staffName, amount),
        getMovements: (shiftId: string) => FinanceHandler.GetShiftMovements(shiftId),
        getHistory: (limit: number) => FinanceHandler.GetShiftHistory(limit),
    },
    purchaseOrders: {
        create: (order: PurchaseOrder) => FinanceHandler.CreatePurchaseOrder(order as Models.domain.PurchaseOrder),
        list: (status?: string, supplierId?: string) =>
            FinanceHandler.GetPurchaseOrders(status || '', supplierId || ''),
        get: (id: string) => FinanceHandler.GetPurchaseOrder(id),
        update: (order: PurchaseOrder) => FinanceHandler.UpdatePurchaseOrder(order as Models.domain.PurchaseOrder),
        delete: (id: string) => FinanceHandler.DeletePurchaseOrder(id),
        cancel: (id: string) => FinanceHandler.CancelPurchaseOrder(id),
        receive: (orderId: string, items: ReceiveOrderItem[]) =>
            FinanceHandler.ReceivePurchaseOrder(orderId, items as Models.domain.PurchaseOrderItem[]),
        pay: (orderId: string, amount: number, method: string) =>
            FinanceHandler.PayPurchaseOrder(orderId, amount, method),
        getStats: () => FinanceHandler.GetPurchaseOrderStats(),
    },

    // AI (Secure Backend)
    ai: {
        setKey: (key: string) => SettingsHandler.SaveGlobalAIKeys([key], ""),
        generateBasic: (prompt: string) => Promise.resolve(''),
        generateComplex: (prompt: string) => Promise.resolve(''),
        fetchGlobalKeys: () => SettingsHandler.FetchGlobalAIKeys(),
        saveGlobalKeys: (keys: string[]) => SettingsHandler.SaveGlobalAIKeys(keys, ""),
        listModels: () => Promise.resolve([]),
        fetchUsageStats: () => Promise.resolve([]),
        generateStream: (prompt: string) => Promise.resolve(),
    },
    backup: {
        createBackup: () => BackupHandler.CreateBackup(),
        listBackups: () => BackupHandler.ListBackups(),
        restoreBackup: (backupPath: string) => BackupHandler.RestoreBackup(backupPath),
        deleteBackup: (backupPath: string) => BackupHandler.DeleteBackup(backupPath),
        cleanOldBackups: (retainDays: number) => BackupHandler.CleanOldBackups(retainDays),
    },
    ImportProductsCSVNative: (updateExisting: boolean) => App.ImportProductsCSVNative(updateExisting),
    ExportProductsCSVNative: () => App.ExportProductsCSVNative(),
    DownloadProductsTemplateNative: () => App.DownloadProductsTemplateNative(),
    ExportDatabaseBackupNative: () => App.ExportDatabaseBackupNative(),
    ImportDatabaseBackupNative: () => App.ImportDatabaseBackupNative(),
};

export type ModelSale = Sale;

export interface PaginatedSales {
    data: Sale[];
    total: number;
    totalPages: number;
    page: number;
    stats: InvoiceStats;
}

export interface InvoiceStats {
    count: number;
    total: number;
    pending: number;
    returns: number;
}

export interface PaginatedProducts {
    data: Product[];
    total: number;
    totalPages: number;
    page: number;
    stats: ProductStats;
}

export interface ProductStats {
    totalStock: number;
    totalValue: number;
    totalCost: number;
    profit: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 AUTO-UPDATE Types
// ═══════════════════════════════════════════════════════════════════════════════
export interface UpdateInfo {
    version: string;
    download_url: string;
    release_notes: string;
    mandatory: boolean;
    size: number;
    checksum: string;
    release_date: string;
}

export interface UpdateStatus {
    checking: boolean;
    downloading: boolean;
    progress: number;
    error: string;
    updateAvailable: boolean;
    info: UpdateInfo | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🖨️ PRINTING Types
// ═══════════════════════════════════════════════════════════════════════════════
export interface PrinterInfo {
    name: string;
    isDefault: boolean;
    status: string;
    portName: string;
}

export interface ReceiptItem {
    name: string;
    qty: number;
    price: number;
    total: number;
}

// Add new API methods
export const desktopApi = {
    // Auto-Update
    update: {
        getCurrentVersion: () => SettingsHandler.GetCurrentVersion(),
        checkForUpdates: () => SettingsHandler.CheckForUpdates(),
        downloadUpdate: (url: string) => SettingsHandler.DownloadUpdate(url),
        installUpdate: (path: string) => SettingsHandler.InstallUpdate(path),
        getStatus: () => SettingsHandler.GetUpdateStatus(),
    },

    // Notifications
    notifications: {
        show: (title: string, message: string, type: string) =>
            SettingsHandler.ShowNativeNotification(title, message, type),
        lowStock: (productName: string, current: number, min: number) =>
            SettingsHandler.ShowNativeNotification("تنبيه مخزون منخفض", `المنتج ${productName} وصل إلى كمية ${current} (الحد الأدنى ${min})`, "warning"),
    },

    // Auto-Start
    autostart: {
        enable: () => SettingsHandler.EnableAutoStart(),
        disable: () => SettingsHandler.DisableAutoStart(),
        isEnabled: () => SettingsHandler.IsAutoStartEnabled(),
    },

    // Crash Reports
    crashReports: {
        getAll: () => SettingsHandler.GetCrashReports(),
        getContent: (filename: string) => SettingsHandler.GetCrashReportContent(filename),
        clear: () => SettingsHandler.ClearCrashReports(),
    },

    // Direct Printing
    printing: {
        getPrinters: () => PrintHandler.GetAvailablePrinters(),
        getDefault: () => PrintHandler.GetDefaultPrinter(),
        printReceipt: (printer: string, store: string, items: ReceiptItem[], total: number) =>
            PrintHandler.PrintReceiptDirect(printer, store, items as Models.domain.ReceiptItem[], total, ""),
        test: (printer: string) => PrintHandler.TestPrinter(printer),
    },

    // AI (Secure Backend)
    ai: {
        setKey: (key: string) => SettingsHandler.SaveGlobalAIKeys([key], ""),
        generateBasic: (prompt: string) => Promise.resolve(''),
        generateComplex: (prompt: string) => Promise.resolve(''),
        fetchGlobalKeys: () => SettingsHandler.FetchGlobalAIKeys(),
        saveGlobalKeys: (keys: string[]) => SettingsHandler.SaveGlobalAIKeys(keys, ""),
        listModels: () => Promise.resolve([]),
        fetchUsageStats: () => Promise.resolve([]),
        generateStream: (prompt: string) => Promise.resolve(),
    },

    // License (User-bound) - accessed from main.tsx update section
    license: {
        getUserLicenseStatus: () => CloudHandler.GetUserLicenseStatus().then(res => ({ licensed: res.licensed, message: res.message })),
        verify: (key: string) => CloudHandler.VerifyLicense(key),
        activate: (key: string) => CloudHandler.ActivateLicense(key),
        getCached: () => CloudHandler.GetCachedLicense(),
        getStoredKey: () => CloudHandler.GetStoredLicenseKey(),
    },
};
