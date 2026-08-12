// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 React Query Client Configuration - Optimized for Desktop
// ═══════════════════════════════════════════════════════════════════════════════

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Real-time responsive: data considered fresh for 10 seconds, refetches on mount if stale
            staleTime: 1000 * 10,
            // Keep unused data in cache for 15 minutes
            gcTime: 1000 * 60 * 15,
            // Retry failed requests twice with exponential backoff
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
            // Refetch when mounting components to guarantee fresh data across screen switches
            refetchOnMount: true,
            // Don't refetch on window focus for desktop app
            refetchOnWindowFocus: false,
            // Don't refetch on reconnect automatically (desktop app handles this)
            refetchOnReconnect: false,
        },
        mutations: {
            // Retry mutations once
            retry: 1,
        },
    },
});

/** Global helper to invalidate ALL queries (active + cached).
 * Active queries refetch immediately; inactive ones are marked stale
 * and refetch automatically the next time their screen mounts. */
export const invalidateAllData = () => {
    queryClient.invalidateQueries();
};

/** Invalidate all product, inventory, stock movement, and dashboard caches */
export const invalidateProducts = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
};

/** Invalidate all customer caches and customer analytics */
export const invalidateCustomers = () => {
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['reports', 'customers'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
};

/** Invalidate all sales, invoices, finance summaries, and dashboard stats */
export const invalidateSales = () => {
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['finance_data'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
};

/** Invalidate all finance, expenses, suppliers, and purchase orders caches */
export const invalidateFinance = () => {
    queryClient.invalidateQueries({ queryKey: ['finance_data'] });
    queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
    queryClient.invalidateQueries({ queryKey: ['reports', 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    queryClient.invalidateQueries({ queryKey: ['shifts'] });
};

/** Invalidate shift history and cash movements */
export const invalidateShifts = () => {
    queryClient.invalidateQueries({ queryKey: ['shifts'] });
    queryClient.invalidateQueries({ queryKey: ['finance_data'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
};

/** Invalidate staff and access lists */
export const invalidateStaff = () => {
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    queryClient.invalidateQueries({ queryKey: ['reports', 'staff'] });
};

/** Invalidate active discount codes */
export const invalidateDiscounts = () => {
    queryClient.invalidateQueries({ queryKey: ['discounts'] });
};

// Query Keys - Centralized for consistency
export const queryKeys = {
    products: {
        all: ['products'] as const,
        list: (filters: { search?: string; category?: string; status?: string }) =>
            [...queryKeys.products.all, 'list', filters] as const,
    },
    inventory: {
        all: ['inventory'] as const,
        products: (page: number, pageSize: number, search: string, category: string, supplier: string, filterType: string) =>
            ['inventory', 'products', page, pageSize, search, category, supplier, filterType] as const,
        movements: () => ['inventory', 'movements'] as const,
        metadata: () => ['inventory', 'metadata'] as const,
    },
    customers: {
        all: ['customers'] as const,
        list: () => [...queryKeys.customers.all, 'list'] as const,
    },
    sales: {
        all: ['sales'] as const,
        list: (page = 0, pageSize = 100, search = '', status = '', date = '') =>
            ['sales', 'list', page, pageSize, search, status, date] as const,
        installments: (customerId: string) => ['sales', 'installments', customerId] as const,
        parked: () => [...queryKeys.sales.all, 'parked'] as const,
        parkedCount: () => [...queryKeys.sales.all, 'parkedCount'] as const,
    },
    categories: {
        all: ['categories'] as const,
    },
    dashboard: {
        stats: (timeRange = 'week') => ['dashboard_stats', timeRange] as const,
    },
    finance: {
        all: ['finance_data'] as const,
        purchaseOrders: (statusFilter?: string) => ['purchaseOrders', statusFilter] as const,
    },
    shifts: {
        all: ['shifts'] as const,
        history: (limit: number = 50) => ['shifts', 'history', limit] as const,
        movements: (shiftId: string | null) => ['shifts', 'movements', shiftId] as const,
    },
    staff: {
        all: ['staff'] as const,
        reports: () => ['reports', 'staff'] as const,
    },
    discounts: {
        all: ['discounts'] as const,
    },
};
