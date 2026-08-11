import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../core/api';

export const usePurchaseOrders = (statusFilter?: string) => {
    return useQuery({
        queryKey: ['purchaseOrders', statusFilter],
        queryFn: async () => {
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
        },
        placeholderData: keepPreviousData,
    });
};
