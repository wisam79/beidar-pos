// ═══════════════════════════════════════════════════════════════════════════════
// 📚 Hooks Index - Re-export all hooks for easy importing
// ═══════════════════════════════════════════════════════════════════════════════

export { useProducts, useInvalidateProducts } from './useProducts';
export { useCustomers, useInvalidateCustomers } from './useCustomers';
export { useParkedSales } from './useParkedSales';
export { useDashboardStats } from './useDashboardStats';

export { useInvalidateSales } from './useSales';
export { useWindowSize } from './useWindowSize';
export { useUsbScannerDetection } from './useUsbScannerDetection';
export { useMonthlyComparison } from './useMonthlyComparison';
export type { MonthData, MonthlyComparisonData } from './useMonthlyComparison';
export { useStockMovements } from './useStockMovements';
export { useConfirmModal } from './useConfirmModal';
export { useShiftsHistory, useShiftMovements } from './useShifts';
export { useInvoices } from './useInvoices';
export { useInventoryProducts, useInventoryMetadata, useInventoryMovements } from './useInventory';
export { useExpenses, usePurchaseOrders, useFinanceData } from './useFinance';
export { useDiscounts } from './useDiscounts';
export type { ConfirmModalState, OpenConfirmOptions } from './useConfirmModal';
