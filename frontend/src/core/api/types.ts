import * as Models from '../../../wailsjs/go/models';

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
export type Staff = Models.domain.Staff;
export type AuthResult = Models.domain.AuthResult;
export type StaffRole = 'admin' | 'manager' | 'cashier' | 'viewer';
export type LicenseResult = Models.domain.LicenseResult;

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

export interface Payment {
    id?: number;
    saleId: string;
    customerId: string;
    amount: number;
    method: string;
    note?: string;
    timestamp: number;
    staffId?: string;
    instIndex?: number;
}

export interface InstallmentSummary {
    total: number;
    paid: number;
    remaining: number;
}

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
    status?: PurchaseOrderStatus | string;
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

export type ModelSale = Sale;
