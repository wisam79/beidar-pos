import { useQuery } from '@tanstack/react-query';
import { api } from '../core/api';

export const useExpenses = (month?: string) => {
    return useQuery({
        queryKey: ['expenses', month],
        queryFn: async () => {
            const data = await api.expenses.list();
            return data || [];
        }
    });
};

export const usePurchaseOrders = (statusFilter?: string) => {
    return useQuery({
        queryKey: ['purchaseOrders', statusFilter],
        queryFn: async () => {
            // Note: The API for purchase orders may vary, assuming a list function
            const data = await api.purchaseOrders.list(statusFilter);
            return data || [];
        }
    });
};

export const useFinanceData = () => {
    return useQuery({
        queryKey: ['finance_data'],
        queryFn: async () => {
            const [e, s, saData, poData] = await Promise.all([
                api.expenses.list().catch(() => []),
                api.suppliers.list().catch(() => []),
                api.sales.list(0, 5000, '', '', '').catch(() => ({ data: [] })),
                api.purchaseOrders.list('').catch(() => [])
            ]);
            return {
                expenses: e,
                suppliers: s,
                sales: saData?.data || [],
                purchaseOrders: poData || []
            };
        }
    });
};
