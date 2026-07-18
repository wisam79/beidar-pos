export namespace domain {
	
	export class AppPreferences {
	    storeName: string;
	    storeAddress: string;
	    storePhone: string;
	    currency: string;
	    taxRate: number;
	    theme: string;
	    accentColor: string;
	    enableSound: boolean;
	    language: string;
	    lowStockTrigger: number;
	    adminPin: string;
	    geminiApiKey: string;
	    geminiApiKeys: string[];
	    fontSize: string;
	    autoLockTime: number;
	    quickSell: boolean;
	    autoPrint: boolean;
	    autoPrintFormat: string;
	    thermalPaperSize: string;
	    requireShift: boolean;
	    cloudAutoSync: boolean;
	    receiptPrinter: string;
	    labelPrinter: string;
	    aiProvider: string;
	    aiModel: string;
	    aiRotationMode: string;
	    groqApiKey: string;
	
	    static createFrom(source: any = {}) {
	        return new AppPreferences(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.storeName = source["storeName"];
	        this.storeAddress = source["storeAddress"];
	        this.storePhone = source["storePhone"];
	        this.currency = source["currency"];
	        this.taxRate = source["taxRate"];
	        this.theme = source["theme"];
	        this.accentColor = source["accentColor"];
	        this.enableSound = source["enableSound"];
	        this.language = source["language"];
	        this.lowStockTrigger = source["lowStockTrigger"];
	        this.adminPin = source["adminPin"];
	        this.geminiApiKey = source["geminiApiKey"];
	        this.geminiApiKeys = source["geminiApiKeys"];
	        this.fontSize = source["fontSize"];
	        this.autoLockTime = source["autoLockTime"];
	        this.quickSell = source["quickSell"];
	        this.autoPrint = source["autoPrint"];
	        this.autoPrintFormat = source["autoPrintFormat"];
	        this.thermalPaperSize = source["thermalPaperSize"];
	        this.requireShift = source["requireShift"];
	        this.cloudAutoSync = source["cloudAutoSync"];
	        this.receiptPrinter = source["receiptPrinter"];
	        this.labelPrinter = source["labelPrinter"];
	        this.aiProvider = source["aiProvider"];
	        this.aiModel = source["aiModel"];
	        this.aiRotationMode = source["aiRotationMode"];
	        this.groqApiKey = source["groqApiKey"];
	    }
	}
	export class Staff {
	    id: string;
	    name: string;
	    username: string;
	    mustChangePin: boolean;
	    role: string;
	    phone?: string;
	    email?: string;
	    active: boolean;
	    permissions?: string[];
	    lastLogin?: number;
	    createdAt: number;
	    supabaseUserId?: string;
	
	    static createFrom(source: any = {}) {
	        return new Staff(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.username = source["username"];
	        this.mustChangePin = source["mustChangePin"];
	        this.role = source["role"];
	        this.phone = source["phone"];
	        this.email = source["email"];
	        this.active = source["active"];
	        this.permissions = source["permissions"];
	        this.lastLogin = source["lastLogin"];
	        this.createdAt = source["createdAt"];
	        this.supabaseUserId = source["supabaseUserId"];
	    }
	}
	export class AuthResult {
	    success: boolean;
	    staff?: Staff;
	    permissions?: string[];
	    message?: string;
	    requirePinChange?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AuthResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.staff = this.convertValues(source["staff"], Staff);
	        this.permissions = source["permissions"];
	        this.message = source["message"];
	        this.requirePinChange = source["requirePinChange"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BackupConfig {
	    enabled: boolean;
	    frequency: string;
	    retainDays: number;
	    path: string;
	    lastBackup: string;
	    cloudAutoSync: boolean;
	
	    static createFrom(source: any = {}) {
	        return new BackupConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.frequency = source["frequency"];
	        this.retainDays = source["retainDays"];
	        this.path = source["path"];
	        this.lastBackup = source["lastBackup"];
	        this.cloudAutoSync = source["cloudAutoSync"];
	    }
	}
	export class BackupInfo {
	    filename: string;
	    path: string;
	    size: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new BackupInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filename = source["filename"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class BackupResult {
	    success: boolean;
	    path: string;
	    size: number;
	    duration: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new BackupResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.duration = source["duration"];
	        this.error = source["error"];
	    }
	}
	export class BlockedDevice {
	    id: number;
	    deviceId: string;
	    deviceName: string;
	    blockedAt: number;
	    reason: string;
	
	    static createFrom(source: any = {}) {
	        return new BlockedDevice(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.deviceId = source["deviceId"];
	        this.deviceName = source["deviceName"];
	        this.blockedAt = source["blockedAt"];
	        this.reason = source["reason"];
	    }
	}
	export class CSVExportResult {
	    data: string;
	    filename: string;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new CSVExportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = source["data"];
	        this.filename = source["filename"];
	        this.count = source["count"];
	    }
	}
	export class CSVImportResult {
	    success: boolean;
	    totalRows: number;
	    imported: number;
	    updated: number;
	    skipped: number;
	    errors: string[];
	    importedIds: string[];
	
	    static createFrom(source: any = {}) {
	        return new CSVImportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.totalRows = source["totalRows"];
	        this.imported = source["imported"];
	        this.updated = source["updated"];
	        this.skipped = source["skipped"];
	        this.errors = source["errors"];
	        this.importedIds = source["importedIds"];
	    }
	}
	export class CashMovement {
	    id: string;
	    shiftId: string;
	    type: string;
	    amount: number;
	    reason: string;
	    staffId: string;
	    staffName: string;
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new CashMovement(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.shiftId = source["shiftId"];
	        this.type = source["type"];
	        this.amount = source["amount"];
	        this.reason = source["reason"];
	        this.staffId = source["staffId"];
	        this.staffName = source["staffName"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class CategoryField {
	    name: string;
	    type: string;
	    options?: string[];
	
	    static createFrom(source: any = {}) {
	        return new CategoryField(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.options = source["options"];
	    }
	}
	export class Category {
	    id: string;
	    name: string;
	    fields?: CategoryField[];
	
	    static createFrom(source: any = {}) {
	        return new Category(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.fields = this.convertValues(source["fields"], CategoryField);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ChartDataPoint {
	    label: string;
	    value: number;
	    formattedValue: string;
	
	    static createFrom(source: any = {}) {
	        return new ChartDataPoint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.value = source["value"];
	        this.formattedValue = source["formattedValue"];
	    }
	}
	export class CloudBackup {
	    id: string;
	    user_id: string;
	    store_name: string;
	    size_bytes: number;
	    chunks: number;
	    created_at: string;
	
	    static createFrom(source: any = {}) {
	        return new CloudBackup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.user_id = source["user_id"];
	        this.store_name = source["store_name"];
	        this.size_bytes = source["size_bytes"];
	        this.chunks = source["chunks"];
	        this.created_at = source["created_at"];
	    }
	}
	export class ConnectedClient {
	    deviceId: string;
	    deviceName: string;
	    ipAddress: string;
	    connectedAt: number;
	    lastActivity: number;
	    status: string;
	    sessionToken?: string;
	    role: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectedClient(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.deviceId = source["deviceId"];
	        this.deviceName = source["deviceName"];
	        this.ipAddress = source["ipAddress"];
	        this.connectedAt = source["connectedAt"];
	        this.lastActivity = source["lastActivity"];
	        this.status = source["status"];
	        this.sessionToken = source["sessionToken"];
	        this.role = source["role"];
	    }
	}
	export class Customer {
	    id: string;
	    name: string;
	    phone: string;
	    debt: number;
	    installmentDebt: number;
	    totalPurchases: number;
	    lastVisit: string;
	    points: number;
	    notes?: string;
	
	    static createFrom(source: any = {}) {
	        return new Customer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.phone = source["phone"];
	        this.debt = source["debt"];
	        this.installmentDebt = source["installmentDebt"];
	        this.totalPurchases = source["totalPurchases"];
	        this.lastVisit = source["lastVisit"];
	        this.points = source["points"];
	        this.notes = source["notes"];
	    }
	}
	export class TopCustomer {
	    name: string;
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new TopCustomer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.total = source["total"];
	    }
	}
	export class Installment {
	    number: number;
	    dueDate: string;
	    amount: number;
	    status: string;
	    paidAt?: number;
	
	    static createFrom(source: any = {}) {
	        return new Installment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.number = source["number"];
	        this.dueDate = source["dueDate"];
	        this.amount = source["amount"];
	        this.status = source["status"];
	        this.paidAt = source["paidAt"];
	    }
	}
	export class InstallmentPlan {
	    totalAmount: number;
	    downPayment: number;
	    months: number;
	    startDate: string;
	    schedule: Installment[];
	
	    static createFrom(source: any = {}) {
	        return new InstallmentPlan(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalAmount = source["totalAmount"];
	        this.downPayment = source["downPayment"];
	        this.months = source["months"];
	        this.startDate = source["startDate"];
	        this.schedule = this.convertValues(source["schedule"], Installment);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SaleItem {
	    pid: number;
	    id: string;
	    name: string;
	    price: number;
	    qty: number;
	    total: number;
	    cost: number;
	    discount?: number;
	    returnedQty: number;
	
	    static createFrom(source: any = {}) {
	        return new SaleItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.id = source["id"];
	        this.name = source["name"];
	        this.price = source["price"];
	        this.qty = source["qty"];
	        this.total = source["total"];
	        this.cost = source["cost"];
	        this.discount = source["discount"];
	        this.returnedQty = source["returnedQty"];
	    }
	}
	export class Sale {
	    id: string;
	    customerId?: string;
	    customer: string;
	    staffId: string;
	    staffName: string;
	    date: string;
	    timestamp: number;
	    subtotal: number;
	    discount: number;
	    vat: number;
	    total: number;
	    paymentMethod: string;
	    status: string;
	    itemsCount: number;
	    items: SaleItem[];
	    splitDetails?: Record<string, number>;
	    installmentPlan?: InstallmentPlan;
	    note?: string;
	    pointsAwarded: number;
	    zohoSynced: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Sale(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.customerId = source["customerId"];
	        this.customer = source["customer"];
	        this.staffId = source["staffId"];
	        this.staffName = source["staffName"];
	        this.date = source["date"];
	        this.timestamp = source["timestamp"];
	        this.subtotal = source["subtotal"];
	        this.discount = source["discount"];
	        this.vat = source["vat"];
	        this.total = source["total"];
	        this.paymentMethod = source["paymentMethod"];
	        this.status = source["status"];
	        this.itemsCount = source["itemsCount"];
	        this.items = this.convertValues(source["items"], SaleItem);
	        this.splitDetails = source["splitDetails"];
	        this.installmentPlan = this.convertValues(source["installmentPlan"], InstallmentPlan);
	        this.note = source["note"];
	        this.pointsAwarded = source["pointsAwarded"];
	        this.zohoSynced = source["zohoSynced"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TopProduct {
	    label: string;
	    value: number;
	
	    static createFrom(source: any = {}) {
	        return new TopProduct(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.value = source["value"];
	    }
	}
	export class DashboardStats {
	    totalRevenue: number;
	    totalOrders: number;
	    dailyRevenue: number;
	    dailyOrders: number;
	    chartData: ChartDataPoint[];
	    topSelling: TopProduct[];
	    recentSales: Sale[];
	    lowStockCount: number;
	    totalProducts: number;
	    netProfit: number;
	    grossProfit: number;
	    totalExpenses: number;
	    expenseBreakdown: ChartDataPoint[];
	    topCustomers: TopCustomer[];
	
	    static createFrom(source: any = {}) {
	        return new DashboardStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalRevenue = source["totalRevenue"];
	        this.totalOrders = source["totalOrders"];
	        this.dailyRevenue = source["dailyRevenue"];
	        this.dailyOrders = source["dailyOrders"];
	        this.chartData = this.convertValues(source["chartData"], ChartDataPoint);
	        this.topSelling = this.convertValues(source["topSelling"], TopProduct);
	        this.recentSales = this.convertValues(source["recentSales"], Sale);
	        this.lowStockCount = source["lowStockCount"];
	        this.totalProducts = source["totalProducts"];
	        this.netProfit = source["netProfit"];
	        this.grossProfit = source["grossProfit"];
	        this.totalExpenses = source["totalExpenses"];
	        this.expenseBreakdown = this.convertValues(source["expenseBreakdown"], ChartDataPoint);
	        this.topCustomers = this.convertValues(source["topCustomers"], TopCustomer);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PurchaseOrderItem {
	    id: number;
	    productId: string;
	    productName: string;
	    quantity: number;
	    receivedQty: number;
	    unitCost: number;
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new PurchaseOrderItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.productId = source["productId"];
	        this.productName = source["productName"];
	        this.quantity = source["quantity"];
	        this.receivedQty = source["receivedQty"];
	        this.unitCost = source["unitCost"];
	        this.total = source["total"];
	    }
	}
	export class PurchaseOrder {
	    id: string;
	    supplierId: string;
	    supplierName: string;
	    status: string;
	    totalAmount: number;
	    paidAmount: number;
	    note?: string;
	    createdAt: number;
	    receivedAt?: number;
	    items: PurchaseOrderItem[];
	
	    static createFrom(source: any = {}) {
	        return new PurchaseOrder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.supplierId = source["supplierId"];
	        this.supplierName = source["supplierName"];
	        this.status = source["status"];
	        this.totalAmount = source["totalAmount"];
	        this.paidAmount = source["paidAmount"];
	        this.note = source["note"];
	        this.createdAt = source["createdAt"];
	        this.receivedAt = source["receivedAt"];
	        this.items = this.convertValues(source["items"], PurchaseOrderItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Shift {
	    id: string;
	    staffId: string;
	    staffName: string;
	    openTime: number;
	    closeTime?: number;
	    openingBalance: number;
	    closingBalance: number;
	    expectedBalance: number;
	    variance: number;
	    status: string;
	    totalSales: number;
	    cashSales: number;
	    salesCount: number;
	    note?: string;
	
	    static createFrom(source: any = {}) {
	        return new Shift(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.staffId = source["staffId"];
	        this.staffName = source["staffName"];
	        this.openTime = source["openTime"];
	        this.closeTime = source["closeTime"];
	        this.openingBalance = source["openingBalance"];
	        this.closingBalance = source["closingBalance"];
	        this.expectedBalance = source["expectedBalance"];
	        this.variance = source["variance"];
	        this.status = source["status"];
	        this.totalSales = source["totalSales"];
	        this.cashSales = source["cashSales"];
	        this.salesCount = source["salesCount"];
	        this.note = source["note"];
	    }
	}
	export class ParkedSale {
	    id: number;
	    items_json: string;
	    customer_name: string;
	    customer_id: string;
	    note: string;
	    total: number;
	    items_count: number;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new ParkedSale(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.items_json = source["items_json"];
	        this.customer_name = source["customer_name"];
	        this.customer_id = source["customer_id"];
	        this.note = source["note"];
	        this.total = source["total"];
	        this.items_count = source["items_count"];
	        this.created_at = source["created_at"];
	    }
	}
	export class Payment {
	    id: number;
	    saleId: string;
	    customerId: string;
	    amount: number;
	    method: string;
	    note?: string;
	    timestamp: number;
	    staffId?: string;
	    instIndex?: number;
	
	    static createFrom(source: any = {}) {
	        return new Payment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.saleId = source["saleId"];
	        this.customerId = source["customerId"];
	        this.amount = source["amount"];
	        this.method = source["method"];
	        this.note = source["note"];
	        this.timestamp = source["timestamp"];
	        this.staffId = source["staffId"];
	        this.instIndex = source["instIndex"];
	    }
	}
	export class StockMovement {
	    id: number;
	    productId: string;
	    productName: string;
	    type: string;
	    qty: number;
	    reason?: string;
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new StockMovement(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.productId = source["productId"];
	        this.productName = source["productName"];
	        this.type = source["type"];
	        this.qty = source["qty"];
	        this.reason = source["reason"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class Expense {
	    id: string;
	    title: string;
	    amount: number;
	    date: string;
	    category: string;
	    notes?: string;
	
	    static createFrom(source: any = {}) {
	        return new Expense(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.amount = source["amount"];
	        this.date = source["date"];
	        this.category = source["category"];
	        this.notes = source["notes"];
	    }
	}
	export class Supplier {
	    id: string;
	    name: string;
	    companyName: string;
	    phone: string;
	    email?: string;
	    notes?: string;
	    balance: number;
	
	    static createFrom(source: any = {}) {
	        return new Supplier(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.companyName = source["companyName"];
	        this.phone = source["phone"];
	        this.email = source["email"];
	        this.notes = source["notes"];
	        this.balance = source["balance"];
	    }
	}
	export class Product {
	    id: string;
	    name: string;
	    barcode: string;
	    price: number;
	    cost: number;
	    stock: number;
	    minStock: number;
	    category: string;
	    image: string;
	    supplier?: string;
	    wholesalePrice: number;
	    description?: string;
	    customDetails?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new Product(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.barcode = source["barcode"];
	        this.price = source["price"];
	        this.cost = source["cost"];
	        this.stock = source["stock"];
	        this.minStock = source["minStock"];
	        this.category = source["category"];
	        this.image = source["image"];
	        this.supplier = source["supplier"];
	        this.wholesalePrice = source["wholesalePrice"];
	        this.description = source["description"];
	        this.customDetails = source["customDetails"];
	    }
	}
	export class DatabaseExport {
	    products: Product[];
	    sales: Sale[];
	    customers: Customer[];
	    suppliers: Supplier[];
	    expenses: Expense[];
	    categories: Category[];
	    stockMovements: StockMovement[];
	    preferences?: AppPreferences;
	    staff: Staff[];
	    payments: Payment[];
	    parkedSales: ParkedSale[];
	    shifts: Shift[];
	    cashMovements: CashMovement[];
	    purchaseOrders: PurchaseOrder[];
	    purchaseOrderItems: PurchaseOrderItem[];
	
	    static createFrom(source: any = {}) {
	        return new DatabaseExport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.products = this.convertValues(source["products"], Product);
	        this.sales = this.convertValues(source["sales"], Sale);
	        this.customers = this.convertValues(source["customers"], Customer);
	        this.suppliers = this.convertValues(source["suppliers"], Supplier);
	        this.expenses = this.convertValues(source["expenses"], Expense);
	        this.categories = this.convertValues(source["categories"], Category);
	        this.stockMovements = this.convertValues(source["stockMovements"], StockMovement);
	        this.preferences = this.convertValues(source["preferences"], AppPreferences);
	        this.staff = this.convertValues(source["staff"], Staff);
	        this.payments = this.convertValues(source["payments"], Payment);
	        this.parkedSales = this.convertValues(source["parkedSales"], ParkedSale);
	        this.shifts = this.convertValues(source["shifts"], Shift);
	        this.cashMovements = this.convertValues(source["cashMovements"], CashMovement);
	        this.purchaseOrders = this.convertValues(source["purchaseOrders"], PurchaseOrder);
	        this.purchaseOrderItems = this.convertValues(source["purchaseOrderItems"], PurchaseOrderItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Discount {
	    id: string;
	    name: string;
	    type: string;
	    value: number;
	    minPurchase?: number;
	    maxDiscount?: number;
	    startDate?: string;
	    endDate?: string;
	    code?: string;
	    productIds?: string[];
	    categoryIds?: string[];
	    usageLimit?: number;
	    usageCount: number;
	    active: boolean;
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Discount(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.value = source["value"];
	        this.minPurchase = source["minPurchase"];
	        this.maxDiscount = source["maxDiscount"];
	        this.startDate = source["startDate"];
	        this.endDate = source["endDate"];
	        this.code = source["code"];
	        this.productIds = source["productIds"];
	        this.categoryIds = source["categoryIds"];
	        this.usageLimit = source["usageLimit"];
	        this.usageCount = source["usageCount"];
	        this.active = source["active"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class DiscoveredServer {
	    serverName: string;
	    serverIP: string;
	    port: number;
	    deviceId: string;
	    lastSeen: number;
	
	    static createFrom(source: any = {}) {
	        return new DiscoveredServer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.serverName = source["serverName"];
	        this.serverIP = source["serverIP"];
	        this.port = source["port"];
	        this.deviceId = source["deviceId"];
	        this.lastSeen = source["lastSeen"];
	    }
	}
	
	export class ImageStorageStats {
	    totalImages: number;
	    totalSizeBytes: number;
	    totalSizeMB: number;
	    base64Count: number;
	
	    static createFrom(source: any = {}) {
	        return new ImageStorageStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalImages = source["totalImages"];
	        this.totalSizeBytes = source["totalSizeBytes"];
	        this.totalSizeMB = source["totalSizeMB"];
	        this.base64Count = source["base64Count"];
	    }
	}
	
	
	export class InvoiceStats {
	    count: number;
	    total: number;
	    pending: number;
	    returns: number;
	
	    static createFrom(source: any = {}) {
	        return new InvoiceStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.count = source["count"];
	        this.total = source["total"];
	        this.pending = source["pending"];
	        this.returns = source["returns"];
	    }
	}
	export class LanClientStatus {
	    connected: boolean;
	    serverAddress: string;
	    mode: string;
	
	    static createFrom(source: any = {}) {
	        return new LanClientStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	        this.serverAddress = source["serverAddress"];
	        this.mode = source["mode"];
	    }
	}
	export class LanServerStatus {
	    running: boolean;
	    localIP: string;
	    port: number;
	    clientCount: number;
	    clients: string[];
	
	    static createFrom(source: any = {}) {
	        return new LanServerStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.localIP = source["localIP"];
	        this.port = source["port"];
	        this.clientCount = source["clientCount"];
	        this.clients = source["clients"];
	    }
	}
	export class LicenseResult {
	    licensed: boolean;
	    success: boolean;
	    message: string;
	    customerName?: string;
	    customerPhone?: string;
	    storeName?: string;
	    features: Record<string, boolean>;
	    expiresAt?: string;
	    cachedAt?: number;
	    lastServerTime?: number;
	
	    static createFrom(source: any = {}) {
	        return new LicenseResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.licensed = source["licensed"];
	        this.success = source["success"];
	        this.message = source["message"];
	        this.customerName = source["customerName"];
	        this.customerPhone = source["customerPhone"];
	        this.storeName = source["storeName"];
	        this.features = source["features"];
	        this.expiresAt = source["expiresAt"];
	        this.cachedAt = source["cachedAt"];
	        this.lastServerTime = source["lastServerTime"];
	    }
	}
	export class MonthData {
	    label: string;
	    revenue: number;
	    orders: number;
	    netProfit: number;
	    avgOrder: number;
	    expenses: number;
	
	    static createFrom(source: any = {}) {
	        return new MonthData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.revenue = source["revenue"];
	        this.orders = source["orders"];
	        this.netProfit = source["netProfit"];
	        this.avgOrder = source["avgOrder"];
	        this.expenses = source["expenses"];
	    }
	}
	export class MonthlyComparison {
	    currentMonth: MonthData;
	    previousMonth: MonthData;
	    revenueChange: number;
	    ordersChange: number;
	    profitChange: number;
	
	    static createFrom(source: any = {}) {
	        return new MonthlyComparison(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentMonth = this.convertValues(source["currentMonth"], MonthData);
	        this.previousMonth = this.convertValues(source["previousMonth"], MonthData);
	        this.revenueChange = source["revenueChange"];
	        this.ordersChange = source["ordersChange"];
	        this.profitChange = source["profitChange"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PaginatedSales {
	    data: Sale[];
	    total: number;
	    totalPages: number;
	    page: number;
	    stats: InvoiceStats;
	
	    static createFrom(source: any = {}) {
	        return new PaginatedSales(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = this.convertValues(source["data"], Sale);
	        this.total = source["total"];
	        this.totalPages = source["totalPages"];
	        this.page = source["page"];
	        this.stats = this.convertValues(source["stats"], InvoiceStats);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class PrinterInfo {
	    name: string;
	    isDefault: boolean;
	    status: string;
	    portName: string;
	
	    static createFrom(source: any = {}) {
	        return new PrinterInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.isDefault = source["isDefault"];
	        this.status = source["status"];
	        this.portName = source["portName"];
	    }
	}
	
	
	
	export class PurchaseOrderStats {
	    totalOrders: number;
	    pendingOrders: number;
	    totalValue: number;
	    totalPaid: number;
	    totalUnpaid: number;
	
	    static createFrom(source: any = {}) {
	        return new PurchaseOrderStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalOrders = source["totalOrders"];
	        this.pendingOrders = source["pendingOrders"];
	        this.totalValue = source["totalValue"];
	        this.totalPaid = source["totalPaid"];
	        this.totalUnpaid = source["totalUnpaid"];
	    }
	}
	export class ReceiptItem {
	    name: string;
	    qty: number;
	    price: number;
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new ReceiptItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.qty = source["qty"];
	        this.price = source["price"];
	        this.total = source["total"];
	    }
	}
	
	
	export class SessionValidityResult {
	    valid: boolean;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionValidityResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.valid = source["valid"];
	        this.message = source["message"];
	    }
	}
	
	
	
	export class UserFeatures {
	    enable_ai: boolean;
	    enable_lan: boolean;
	    enable_whatsapp: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UserFeatures(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enable_ai = source["enable_ai"];
	        this.enable_lan = source["enable_lan"];
	        this.enable_whatsapp = source["enable_whatsapp"];
	    }
	}
	export class UserSession {
	    user_id: string;
	    email: string;
	    store_name: string;
	    access_token: string;
	    refresh_token: string;
	    session_token: string;
	    expires_at: number;
	    backup_limit_mb: number;
	    max_backups: number;
	    features: UserFeatures;
	
	    static createFrom(source: any = {}) {
	        return new UserSession(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.user_id = source["user_id"];
	        this.email = source["email"];
	        this.store_name = source["store_name"];
	        this.access_token = source["access_token"];
	        this.refresh_token = source["refresh_token"];
	        this.session_token = source["session_token"];
	        this.expires_at = source["expires_at"];
	        this.backup_limit_mb = source["backup_limit_mb"];
	        this.max_backups = source["max_backups"];
	        this.features = this.convertValues(source["features"], UserFeatures);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SupabaseAuthResult {
	    success: boolean;
	    message: string;
	    user?: UserSession;
	
	    static createFrom(source: any = {}) {
	        return new SupabaseAuthResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.user = this.convertValues(source["user"], UserSession);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class UpdateInfo {
	    version: string;
	    download_url: string;
	    release_notes: string;
	    mandatory: boolean;
	    size: number;
	    size_formatted: string;
	    checksum: string;
	    release_date: string;
	    update_available: boolean;
	    is_prerelease: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.download_url = source["download_url"];
	        this.release_notes = source["release_notes"];
	        this.mandatory = source["mandatory"];
	        this.size = source["size"];
	        this.size_formatted = source["size_formatted"];
	        this.checksum = source["checksum"];
	        this.release_date = source["release_date"];
	        this.update_available = source["update_available"];
	        this.is_prerelease = source["is_prerelease"];
	    }
	}
	export class UpdateStatus {
	    checking: boolean;
	    downloading: boolean;
	    installing: boolean;
	    progress: number;
	    speed: string;
	    eta: string;
	    error: string;
	    stage: string;
	    updateAvailable: boolean;
	    info?: UpdateInfo;
	
	    static createFrom(source: any = {}) {
	        return new UpdateStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.checking = source["checking"];
	        this.downloading = source["downloading"];
	        this.installing = source["installing"];
	        this.progress = source["progress"];
	        this.speed = source["speed"];
	        this.eta = source["eta"];
	        this.error = source["error"];
	        this.stage = source["stage"];
	        this.updateAvailable = source["updateAvailable"];
	        this.info = this.convertValues(source["info"], UpdateInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

export namespace handlers {
	
	export class InstallmentSummaryResult {
	    total: number;
	    paid: number;
	    remaining: number;
	
	    static createFrom(source: any = {}) {
	        return new InstallmentSummaryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.paid = source["paid"];
	        this.remaining = source["remaining"];
	    }
	}

}

