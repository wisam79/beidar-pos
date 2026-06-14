import { Page } from '@playwright/test';

/**
 * Injects mock Wails bindings into the browser page context.
 * This ensures that components calling Wails backend functions (which are unavailable
 * in a standard web browser or during headless Playwright runs) do not crash
 * and instead receive mock/dummy resolved promises.
 */
export async function mockWails(page: Page) {
    await page.addInitScript(() => {
        // Create a deep recursive proxy that intercepts any function calls on window.go
        // and returns a resolved promise (or customized dummy mock data for startup)
        
        const makeMockHandler = (customOverrides: Record<string, any> = {}) => {
            return new Proxy(customOverrides, {
                get(target, prop: string) {
                    if (prop in target) {
                        return target[prop];
                    }
                    // Default fallback for any undefined Go backend method:
                    // return a function that resolves with a dummy value (or void)
                    return (...args: any[]) => {
                        console.warn(`[Wails Mock] Auto-mocked Go call: ${prop}`, args);
                        return Promise.resolve(null);
                    };
                }
            });
        };

        const makeMockNamespace = (customOverrides: Record<string, any> = {}) => {
            return new Proxy(customOverrides, {
                get(target, prop: string) {
                    if (prop in target) {
                        return target[prop];
                    }
                    // Dynamic mock handler for any newly accessed Go class
                    return makeMockHandler();
                }
            });
        };

        // Inject the window.runtime proxy structure
        (window as any).runtime = new Proxy({}, {
            get(target, prop: string) {
                if (prop in target) {
                    return (target as any)[prop];
                }
                return (...args: any[]) => {
                    console.warn(`[Wails Runtime Mock] Auto-mocked call: ${prop}`, args);
                    return Promise.resolve(null);
                };
            }
        });

        // Inject the window.go proxy structure
        (window as any).go = new Proxy({}, {
            get(target, prop: string) {
                if (prop === 'main') {
                    return makeMockNamespace({
                        App: makeMockHandler({
                            GetBackupConfig: () => Promise.resolve({}),
                            GetInstallmentAlertSummary: () => Promise.resolve({ alertCount: 0, alerts: [] }),
                            CalculateInstallmentPlan: (total: number, downPayment: number, months: number) => Promise.resolve([]),
                            ImportProductsCSV: () => Promise.resolve({ success: true, count: 0 }),
                            ExportProductsCSV: () => Promise.resolve(''),
                            GetCSVTemplate: () => Promise.resolve(''),
                        })
                    });
                }
                if (prop === 'handlers') {
                    return makeMockNamespace({
                        LanHandler: makeMockHandler({
                            GetLanClientStatus: () => Promise.resolve({ connected: true }),
                            GetLanServerStatus: () => Promise.resolve({ running: false }),
                            GetLanClientConfig: () => Promise.resolve({}),
                        }),
                        CloudHandler: makeMockHandler({
                            GetUserLicenseStatus: () => Promise.resolve({ licensed: true, message: 'Valid License (E2E Mock)' }),
                            IsLoggedIn: () => Promise.resolve(true),
                            GetCachedLicense: () => Promise.resolve({ licensed: true }),
                            GetStoredLicenseKey: () => Promise.resolve('test-license-key'),
                        }),
                        SettingsHandler: makeMockHandler({
                            GetPreferences: () => Promise.resolve({
                                theme: 'light',
                                language: 'ar',
                                storeName: 'بيدر تجريبي - Beidar Test',
                                currency: 'IQD',
                            }),
                            GetCurrentVersion: () => Promise.resolve('2.0.8'),
                            CheckForUpdates: () => Promise.resolve({ update_available: false }),
                            GetUpdateStatus: () => Promise.resolve({ status: 'idle' }),
                            GetDeviceID: () => Promise.resolve('e2e-mock-device-id'),
                            VerifyAdminPin: (pin: string) => Promise.resolve(pin === '0000'),
                        }),
                        StaffHandler: makeMockHandler({
                            GetActiveStaff: () => Promise.resolve([
                                { id: 'admin-id', name: 'Admin', role: 'admin', active: true }
                            ]),
                            GetAllStaff: () => Promise.resolve([
                                { id: 'admin-id', name: 'Admin', role: 'admin', active: true }
                            ]),
                            AuthenticateByUsername: (username: string, password: string) => {
                                if (password === '0000') {
                                    return Promise.resolve({
                                        success: true,
                                        staff: { id: 'admin-id', name: 'Admin', role: 'admin', active: true },
                                        permissions: ['sales', 'products', 'inventory', 'customers', 'invoices', 'reports', 'finance', 'settings']
                                    });
                                }
                                return Promise.resolve({ success: false, message: 'Invalid Password' });
                            },
                            AuthenticateByPIN: (pin: string) => {
                                if (pin === '0000') {
                                    return Promise.resolve({
                                        success: true,
                                        staff: { id: 'admin-id', name: 'Admin', role: 'admin', active: true },
                                        permissions: ['sales', 'products', 'inventory', 'customers', 'invoices', 'reports', 'finance', 'settings']
                                    });
                                }
                                return Promise.resolve({ success: false, message: 'Invalid PIN' });
                            },
                            GetStaffCount: () => Promise.resolve(1),
                        }),
                        ProductHandler: makeMockHandler({
                            GetAllProducts: () => Promise.resolve([
                                { id: 'prod-1', name: 'Test Product', barcode: '123456', price: 1000, cost: 800, stock: 10, minStock: 2, category: 'General' }
                            ]),
                            GetStockMovements: () => Promise.resolve([]),
                            SearchProducts: (q: string) => Promise.resolve([
                                { id: 'prod-1', name: 'Test Product', barcode: '123456', price: 1000, cost: 800, stock: 10, minStock: 2, category: 'General' }
                            ]),
                        }),
                        FinanceHandler: makeMockHandler({
                            GetCategories: () => Promise.resolve([
                                { id: 'cat-1', name: 'General', type: 'expense' }
                            ]),
                        }),
                        SaleHandler: makeMockHandler({
                            GetSales: () => Promise.resolve({ data: [], total: 0, totalPages: 0, page: 1 }),
                            GetSale: () => Promise.resolve(null),
                            ProcessSale: () => Promise.resolve({ id: 'sale-1' }),
                            GetParkedSales: () => Promise.resolve([]),
                            GetParkedSalesCount: () => Promise.resolve(0),
                        }),
                        DiscountHandler: makeMockHandler({
                            GetAllDiscounts: () => Promise.resolve([]),
                            GetActiveDiscounts: () => Promise.resolve([]),
                        })
                    });
                }
                return undefined;
            }
        });
    });
}
