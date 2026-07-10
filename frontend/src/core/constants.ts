// ═══════════════════════════════════════════════════════════════════════════════
// 📌 GLOBAL CONSTANTS - Centralized app-wide constants
// ═══════════════════════════════════════════════════════════════════════════════

import { AppPreferences } from './types';

/**
 * Default application preferences used when no saved prefs exist.
 */
export const DEFAULT_PREFS: AppPreferences = {
    storeName: 'Beidar Store',
    storePhone: '',
    storeAddress: 'Baghdad',
    vatRate: 0,
    taxRate: 0,
    currency: 'IQD',
    receiptFooter: 'شكراً لزيارتكم',
    defaultPrinter: 'System',
    accentColor: '#306D29',
    compactMode: false,
    fontSize: 'normal',
    theme: 'dark',

    enableSound: true,
    animationsEnabled: true,
    language: 'ar',

    lowStockTrigger: 5,
    allowNegativeStock: false,
    quickSell: false,
    defaultPayment: 'cash',
    autoPrint: false,
    autoPrintFormat: 'thermal',
    thermalPaperSize: '80mm',
    adminPin: '',
    autoLockTime: 0,
    dailySalesTarget: 1000000,
    geminiApiKey: '',
    geminiApiKeys: [],
    receiptPrinter: '',
    labelPrinter: '',
    requireShift: false, // Default: shift not required (simpler experience)
    autoBackup: false,    // Default: auto backup disabled
    cloudAutoSync: false,
    aiProvider: 'gemini',
    aiModel: 'gemma-4-31b-it',
    aiRotationMode: 'failover',
    groqApiKey: '',
};
