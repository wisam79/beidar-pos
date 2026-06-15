// ═══════════════════════════════════════════════════════════════════════════════
// 📊 useDashboardStats Hook - Dashboard Data with React Query
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { api, Sale } from '../core/api';
import { usePageVisibility } from './usePageVisibility';

export interface DashboardStats {
    totalRevenue: number;
    totalOrders: number;
    dailyRevenue: number;
    dailyOrders: number;
    chartData: { label: string; value: number; formattedValue: string }[];
    topSelling: { label: string; value: number }[];
    recentSales: Sale[];
    lowStockCount: number;
    totalProducts: number;
    topCustomers: { name: string; total: number }[];
    expenseBreakdown: { label: string; value: number; formattedValue?: string; color?: string }[];
}

interface UseDashboardStatsReturn {
    stats: DashboardStats;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
}

export function useDashboardStats(timeRange: string = 'week'): UseDashboardStatsReturn {
    const isVisible = usePageVisibility();

    const { data: stats, isLoading, isError, refetch } = useQuery({
        queryKey: ['dashboard_stats', timeRange],
        queryFn: async () => {
            const data = await api.stats.getDashboard(timeRange);
            return data;
        },
        refetchInterval: isVisible ? 120000 : false,
        staleTime: 60000,
        enabled: isVisible,
    });

    // Fallback empty stats if loading or error
    const defaultStats: DashboardStats = {
        totalRevenue: 0,
        totalOrders: 0,
        dailyRevenue: 0,
        dailyOrders: 0,
        chartData: [],
        topSelling: [],
        recentSales: [],
        lowStockCount: 0,
        totalProducts: 0,
        topCustomers: [],
        expenseBreakdown: [],
    };

    return {
        stats: stats || defaultStats,
        isLoading,
        isError,
        refetch,
    };
}
