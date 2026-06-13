// ═══════════════════════════════════════════════════════════════════════════════
// 📚 Hooks Index - Re-export all hooks for easy importing
// ═══════════════════════════════════════════════════════════════════════════════

export { useCart } from './useCart';
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
