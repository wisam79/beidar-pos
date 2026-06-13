// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 React Query Client Configuration - Optimized for Desktop
// ═══════════════════════════════════════════════════════════════════════════════

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache data for 5 minutes before considering it stale (desktop app - data rarely changes)
            staleTime: 1000 * 60 * 5,
            // Keep unused data in cache for 15 minutes
            gcTime: 1000 * 60 * 15,
            // Retry failed requests twice with exponential backoff
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
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


// Query Keys - Centralized for consistency
export const queryKeys = {
    products: {
        all: ['products'] as const,
        list: (filters: { search?: string; category?: string; status?: string }) =>
            [...queryKeys.products.all, 'list', filters] as const,
    },
    customers: {
        all: ['customers'] as const,
        list: () => [...queryKeys.customers.all, 'list'] as const,
    },
    sales: {
        all: ['sales'] as const,
        parked: () => [...queryKeys.sales.all, 'parked'] as const,
        parkedCount: () => [...queryKeys.sales.all, 'parkedCount'] as const,
    },
    categories: {
        all: ['categories'] as const,
    },
    dashboard: {
        stats: () => ['dashboard', 'stats'] as const,
    },
};
