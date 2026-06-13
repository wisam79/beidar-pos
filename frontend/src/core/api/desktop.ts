import * as PrintHandler from '../../../wailsjs/go/handlers/PrintHandler';
import * as SettingsHandler from '../../../wailsjs/go/handlers/SettingsHandler';
import * as CloudHandler from '../../../wailsjs/go/handlers/CloudHandler';
import * as Models from '../../../wailsjs/go/models';
import { ReceiptItem } from './types';

export const print = {
    generatePDF: (saleId: string, format: 'thermal' | 'a4') => PrintHandler.GenerateInvoicePDF(saleId, format),
    generateQR: (data: string, size: number) => PrintHandler.GenerateQRCode(data, size),
    bitmapReceipt: (printerName: string, base64Image: string): Promise<void> => PrintHandler.PrintBitmapReceipt(printerName, base64Image),
};

export const desktopApi = {
    update: {
        getCurrentVersion: () => SettingsHandler.GetCurrentVersion(),
        checkForUpdates: () => SettingsHandler.CheckForUpdates(),
        downloadUpdate: (url: string) => SettingsHandler.DownloadUpdate(url),
        installUpdate: (path: string) => SettingsHandler.InstallUpdate(path),
        getStatus: () => SettingsHandler.GetUpdateStatus(),
    },
    notifications: {
        show: (title: string, message: string, type: string) =>
            SettingsHandler.ShowNativeNotification(title, message, type),
        lowStock: (productName: string, current: number, min: number) =>
            SettingsHandler.ShowNativeNotification("تنبيه مخزون منخفض", `المنتج ${productName} وصل إلى كمية ${current} (الحد الأدنى ${min})`, "warning"),
    },
    autostart: {
        enable: () => SettingsHandler.EnableAutoStart(),
        disable: () => SettingsHandler.DisableAutoStart(),
        isEnabled: () => SettingsHandler.IsAutoStartEnabled(),
    },
    crashReports: {
        getAll: () => SettingsHandler.GetCrashReports(),
        getContent: (filename: string) => SettingsHandler.GetCrashReportContent(filename),
        clear: () => SettingsHandler.ClearCrashReports(),
    },
    printing: {
        getPrinters: () => PrintHandler.GetAvailablePrinters(),
        getDefault: () => PrintHandler.GetDefaultPrinter(),
        printReceipt: (printer: string, store: string, items: ReceiptItem[], total: number) =>
            PrintHandler.PrintReceiptDirect(printer, store, items as Models.domain.ReceiptItem[], total, ""),
        test: (printer: string) => PrintHandler.TestPrinter(printer),
    },
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
    license: {
        getUserLicenseStatus: () => CloudHandler.GetUserLicenseStatus().then(res => ({ licensed: res.licensed, message: res.message })),
        verify: (key: string) => CloudHandler.VerifyLicense(key),
        activate: (key: string) => CloudHandler.ActivateLicense(key),
        getCached: () => CloudHandler.GetCachedLicense(),
        getStoredKey: () => CloudHandler.GetStoredLicenseKey(),
    },
};
