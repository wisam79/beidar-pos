
export type View = 'dashboard' | 'sales' | 'products' | 'inventory' | 'reports' | 'settings' | 'invoices' | 'customers' | 'finance' | 'shifts';

export interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number; // Now supports fractional quantities (e.g., 1.5kg)
  minStock: number;
  wholesalePrice: number; // Required, defaults to 0
  category: string;
  image: string;
  barcode: string;
  supplier?: string;
  description?: string;
  customDetails?: Record<string, unknown>;
}

export interface Task {
  id: number;
  title: string;
  time: string;
  customer: string;
  type: 'call' | 'payment' | 'meeting';
  completed: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalPurchases: number;
  debt: number;            // ديون عادية (آجل)
  installmentDebt: number; // ديون الأقساط
  lastVisit: string;
  points: number;
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  balance: number;
  notes?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: 'rent' | 'salary' | 'bills' | 'maintenance' | 'other';
  date: string;
  notes?: string;
}

export interface CartItem extends Product {
  qty: number;
  // id is already in Product as string
  itemDiscount?: number;
  saleId?: string;
}

export interface SaleItem {
  pid: number; // Required by backend
  id: string; // Product ID string
  name: string;
  qty: number;
  price: number;
  cost: number;
  discount?: number;
  total: number; // Required by backend
  returnedQty: number; // Required by backend
}

export interface Installment {
  number: number;
  dueDate: string;
  amount: number;
  status: string;
  paidAt?: number;
}

export interface InstallmentPlan {
  totalAmount: number;
  downPayment: number;
  months: number;
  startDate: string;
  schedule: Installment[];
  convertValues?: unknown;
}

export interface Sale {
  id: string;
  customer: string;
  customerId?: string;
  staffId?: string;
  staffName?: string;
  date: string;
  timestamp: number;
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  paymentMethod: string;
  splitDetails?: Record<string, number>;
  installmentPlan?: InstallmentPlan;
  status: string;
  note?: string;
  itemsCount: number;
  items: SaleItem[];
  pointsRedeemed?: number;
  pointsEarned?: number;
  pointsAwarded?: number; // Added to match backend
  convertValues?: unknown; // Wails helper
}

export interface ParkedSale {
  id?: number;
  customerName: string;
  items: CartItem[];
  timestamp: number;
  note?: string;
}

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface StockMovement {
  id?: number;
  productId: string; // Changed from number to string to match Product.id
  productName: string;
  type: 'sale' | 'restock' | 'return' | 'adjustment' | 'loss';
  qty: number;
  reason?: string;
  timestamp: number;
}

export interface AppPreferences {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  storeLogo?: string;
  vatRate: number;
  taxRate: number; // Required
  currency: string;
  receiptFooter: string;
  defaultPrinter: string;
  accentColor: string;
  compactMode: boolean;
  fontSize: 'normal' | 'large' | 'xl';
  theme: 'dark' | 'light';

  enableSound: boolean; // Required
  animationsEnabled: boolean;
  language: string;

  lowStockTrigger: number; // Required
  allowNegativeStock: boolean;
  quickSell: boolean;
  defaultPayment: string;
  autoPrint: boolean;
  autoPrintFormat: 'thermal' | 'a4' | string;
  thermalPaperSize: '58mm' | '80mm' | '110mm' | string;
  printCopies?: number;
  adminPin: string;
  autoLockTime: number;
  dailySalesTarget: number;
  geminiApiKey: string;
  geminiApiKeys: string[];
  // Multi-Printer Support
  receiptPrinter: string;  // Printer for receipts/invoices
  labelPrinter: string;    // Printer for barcode labels
  lastBackupDate?: string;
  requireShift: boolean;   // If true, sales require an active shift
  autoBackup: boolean;      // Automatically backup database daily
  cloudAutoSync: boolean;
}

export interface CategoryField {
  name: string;
  type: string;
  options?: string[]; // For select type
}

export interface CategoryDef {
  id: string;
  name: string;
  fields?: CategoryField[];
}

// Notification function type for consistent usage across pages
export type NotifyFunction = (message: string, type?: 'success' | 'error' | 'info') => void;

// ═══════════════════════════════════════════════════════════════════════════════
// 🕐 SHIFT MANAGEMENT - Track work shifts with cash tracking
// ═══════════════════════════════════════════════════════════════════════════════

export interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  openTime: number;
  closeTime?: number;
  openingBalance: number;
  closingBalance: number;
  expectedBalance: number;
  variance: number;
  status: 'open' | 'closed' | string; // Widened to accept backend string
  totalSales: number;
  cashSales: number;
  salesCount: number;
  note?: string;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  type: 'cash_in' | 'cash_out' | string; // Widened to accept backend string
  amount: number;
  reason: string;
  staffId: string;
  staffName: string;
  timestamp: number;
}