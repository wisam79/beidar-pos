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
        
        (window as any).__mockPrefs = {
            theme: 'light',
            language: 'ar',
            storeName: 'بيدر تجريبي - Beidar Test',
            storePhone: '07700000000',
            storeAddress: 'العراق - بغداد',
            currency: 'IQD',
            enableSound: true,
            animationsEnabled: true,
            lowStockTrigger: 5,
            allowNegativeStock: false,
            adminPin: '0000',
            taxRate: 0,
            fontSize: 'normal',
            autoLockTime: 0,
            quickSell: false,
            autoPrint: false,
            autoPrintFormat: 'thermal',
            thermalPaperSize: '80mm',
            requireShift: false,
            cloudAutoSync: false,
            receiptPrinter: '',
            labelPrinter: '',
        };

        (window as any).__mockStaffList = [
            { id: 'admin-id', name: 'Admin', username: 'admin', role: 'admin', active: true, createdAt: Date.now() }
        ];

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
                            GetPreferences: () => Promise.resolve((window as any).__mockPrefs),
                            UpdatePreferences: (p: any) => {
                                Object.assign((window as any).__mockPrefs, p);
                                return Promise.resolve();
                            },
                            GetCurrentVersion: () => Promise.resolve('2.0.8'),
                            CheckForUpdates: () => Promise.resolve({ update_available: false }),
                            GetUpdateStatus: () => Promise.resolve({ status: 'idle' }),
                            GetDeviceID: () => Promise.resolve('e2e-mock-device-id'),
                            VerifyAdminPin: (pin: string) => Promise.resolve(pin === (window as any).__mockPrefs.adminPin),
                        }),
                        StaffHandler: makeMockHandler({
                            GetActiveStaff: () => Promise.resolve((window as any).__mockStaffList.filter((s: any) => s.active)),
                            GetAllStaff: () => Promise.resolve((window as any).__mockStaffList),
                            CreateStaff: (staff: any, pin: string) => {
                                const newStaff = { ...staff, id: 'staff-' + Date.now(), active: true, createdAt: Date.now() };
                                (window as any).__mockStaffList.push(newStaff);
                                return Promise.resolve(newStaff);
                            },
                            UpdateStaff: (staff: any) => {
                                const idx = (window as any).__mockStaffList.findIndex((s: any) => s.id === staff.id);
                                if (idx !== -1) (window as any).__mockStaffList[idx] = staff;
                                return Promise.resolve();
                            },
                            DeleteStaff: (id: string, force: boolean) => {
                                (window as any).__mockStaffList = (window as any).__mockStaffList.filter((s: any) => s.id !== id);
                                return Promise.resolve();
                            },
                            ToggleStaffStatus: (id: string) => {
                                const staff = (window as any).__mockStaffList.find((s: any) => s.id === id);
                                if (staff) staff.active = !staff.active;
                                return Promise.resolve();
                            },
                            UpdateStaffPIN: (id: string, pin: string) => Promise.resolve(),
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
                                { id: 'prod-1', name: 'Test Product', barcode: '123456', price: 1000, cost: 800, stock: 10, minStock: 2, category: 'General', image: '📦' }
                            ]),
                            GetStockMovements: () => Promise.resolve([]),
                            SearchProducts: (q: string) => Promise.resolve([
                                { id: 'prod-1', name: 'Test Product', barcode: '123456', price: 1000, cost: 800, stock: 10, minStock: 2, category: 'General', image: '📦' }
                            ]),
                        }),
                        FinanceHandler: makeMockHandler({
                            GetActiveShift: () => Promise.resolve({
                                id: 'shift-1',
                                cashierId: 'admin-id',
                                cashierName: 'Admin',
                                openingBalance: 10000,
                                active: true,
                                startTime: new Date().toISOString()
                            }),
                            GetCategories: () => Promise.resolve([
                                { id: 'cat-1', name: 'General', type: 'expense' }
                            ]),
                            GetExpenses: () => Promise.resolve([
                                { id: 'exp-1', title: 'الكهرباء', amount: 1500, category: 'bills', date: new Date().toISOString() }
                            ]),
                            GetPurchaseOrders: () => Promise.resolve([]),
                            OpenShift: (cashierId: string, note: string, balance: number) => Promise.resolve({
                                id: 'shift-1',
                                cashierId: cashierId,
                                cashierName: 'Admin',
                                openingBalance: balance,
                                active: true,
                                startTime: new Date().toISOString()
                            }),
                            CloseShift: (shiftId: string, actualBalance: number, note: string) => Promise.resolve({
                                id: 'shift-1',
                                cashierId: 'admin-id',
                                cashierName: 'Admin',
                                openingBalance: 10000,
                                closingBalance: actualBalance,
                                active: false,
                                endTime: new Date().toISOString()
                            }),
                            AddCashMovement: (shiftId: string, type: string, amount: number, reason: string) => Promise.resolve({
                                id: 'move-1',
                                shiftId: shiftId,
                                type: type,
                                amount: amount,
                                reason: reason
                            }),
                            SaveExpense: (expense: any) => Promise.resolve(),
                            DeleteExpense: (id: string) => Promise.resolve(),
                        }),
                        CRMHandler: makeMockHandler({
                            GetCustomers: () => Promise.resolve([
                                { id: 'cust-1', name: 'عميل تجريبي', phone: '123456789', debt: 5000, totalPurchases: 10000, balance: -5000 }
                            ]),
                            SearchCustomers: (q: string) => Promise.resolve([
                                { id: 'cust-1', name: 'عميل تجريبي', phone: '123456789', debt: 5000, totalPurchases: 10000, balance: -5000 }
                            ]),
                            GetSuppliers: () => Promise.resolve([
                                { id: 'supp-1', name: 'مورد تجريبي', companyName: 'مورد تجريبي ش.م.م', phone: '987654321', totalPurchases: 12000, balance: 0 }
                            ]),
                            SaveCustomer: (customer: any) => Promise.resolve(),
                            SaveSupplier: (supplier: any) => Promise.resolve(),
                            DeleteCustomer: (id: string, hard: boolean) => Promise.resolve(),
                            DeleteSupplier: (id: string, hard: boolean) => Promise.resolve(),
                        }),
                        PaymentHandler: makeMockHandler({
                            GetCustomerInstallments: (customerId: string) => Promise.resolve([]),
                            GetInstallmentSummary: (customerId: string) => Promise.resolve({ alertCount: 0, alerts: [] }),
                            GetPaymentsByCustomer: (customerId: string) => Promise.resolve([]),
                            GetPaymentsBySale: (saleId: string) => Promise.resolve([]),
                            CreatePayment: (payment: any) => Promise.resolve(payment),
                            PayInstallment: (saleId: string, amount: number, index: number, method: string) => Promise.resolve(),
                            CalculateInstallmentPlan: (total: number, downPayment: number, months: number) => Promise.resolve([]),
                        }),
                        StatsHandler: makeMockHandler({
                            GetDashboardStats: (timeRange: string) => Promise.resolve({
                                totalRevenue: 150000,
                                totalOrders: 120,
                                dailyRevenue: 5000,
                                dailyOrders: 4,
                                totalProducts: 45,
                                lowStockCount: 2,
                                netProfit: 35000,
                                grossProfit: 50000,
                                totalExpenses: 15000,
                                revenueChange: 12.5,
                                ordersChange: 5.2,
                                profitChange: 14.1,
                                chartData: [
                                    { label: 'السبت', value: 12000, formattedValue: '12,000 د.ع' },
                                    { label: 'الأحد', value: 15000, formattedValue: '15,000 د.ع' },
                                    { label: 'الإثنين', value: 10000, formattedValue: '10,000 د.ع' },
                                    { label: 'الثلاثاء', value: 18000, formattedValue: '18,000 د.ع' },
                                    { label: 'الأربعاء', value: 22000, formattedValue: '22,000 د.ع' },
                                    { label: 'الخميس', value: 25000, formattedValue: '25,000 د.ع' },
                                    { label: 'الجمعة', value: 5000, formattedValue: '5,000 د.ع' }
                                ],
                                topSelling: [
                                    { label: 'عصير برتقال طبيعي', value: 85 },
                                    { label: 'شوكولاتة داكنة', value: 64 },
                                    { label: 'مياه معدنية 500مل', value: 50 }
                                ],
                                recentSales: [
                                    {
                                        id: 'INV-123456',
                                        customer: 'عميل تجريبي',
                                        customerId: 'cust-1',
                                        staffName: 'Admin',
                                        date: new Date().toISOString(),
                                        total: 1000,
                                        itemsCount: 1,
                                        status: 'completed',
                                        paymentMethod: 'cash',
                                        items: []
                                    }
                                ],
                                topCustomers: [
                                    { name: 'عميل تجريبي', total: 10000 }
                                ],
                                expenseBreakdown: [
                                    { label: 'إيجار', value: 5000, formattedValue: '5,000 د.ع' },
                                    { label: 'رواتب', value: 7000, formattedValue: '7,000 د.ع' },
                                    { label: 'فواتير', value: 3000, formattedValue: '3,000 د.ع' }
                                ]
                            }),
                            GetMonthlyComparison: () => Promise.resolve({
                                currentMonth: { label: 'الشهر الحالي', revenue: 150000, orders: 120, netProfit: 35000, avgOrder: 1250, expenses: 15000 },
                                previousMonth: { label: 'الشهر السابق', revenue: 130000, orders: 110, netProfit: 26000, avgOrder: 1181.8, expenses: 14000 },
                                revenueChange: 15.38,
                                ordersChange: 9.09,
                                profitChange: 10
                            })
                        }),
                        SaleHandler: makeMockHandler({
                            GetSales: () => Promise.resolve({
                                data: [
                                    {
                                        id: 'INV-123456',
                                        customer: 'عميل تجريبي',
                                        customerId: 'cust-1',
                                        staffName: 'Admin',
                                        date: new Date().toISOString(),
                                        total: 1000,
                                        itemsCount: 1,
                                        status: 'completed',
                                        paymentMethod: 'cash',
                                        items: []
                                    },
                                    {
                                        id: 'INV-789101',
                                        customer: 'عميل تجريبي',
                                        customerId: 'cust-1',
                                        staffName: 'Admin',
                                        date: new Date().toISOString(),
                                        total: 3000,
                                        itemsCount: 1,
                                        status: 'pending',
                                        paymentMethod: 'installment',
                                        items: [],
                                        installmentPlan: {
                                            totalAmount: 3000,
                                            downPayment: 1000,
                                            months: 2,
                                            startDate: new Date().toISOString(),
                                            schedule: [
                                                { number: 1, dueDate: '2026-07-16', amount: 1000, status: 'pending' },
                                                { number: 2, dueDate: '2026-08-16', amount: 1000, status: 'pending' }
                                            ]
                                        }
                                    }
                                ],
                                total: 2,
                                totalPages: 1,
                                page: 0,
                                stats: { count: 2, total: 4000, pending: 2000, returns: 0 }
                            }),
                            GetSale: (id: string) => Promise.resolve({
                                id: id || 'INV-123456',
                                customer: 'عميل تجريبي',
                                customerId: 'cust-1',
                                staffName: 'Admin',
                                date: new Date().toISOString(),
                                total: 1000,
                                itemsCount: 1,
                                status: 'completed',
                                paymentMethod: 'cash',
                                items: [
                                    { id: 'prod-1', name: 'Test Product', qty: 1, price: 1000, cost: 800, total: 1000 }
                                ]
                            }),
                            ProcessSale: () => Promise.resolve({ id: 'sale-1' }),
                            GetParkedSales: () => Promise.resolve([]),
                            GetParkedSalesCount: () => Promise.resolve(0),
                            ReturnSale: (id: string) => Promise.resolve(),
                            DeleteSale: (id: string) => Promise.resolve(),
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
