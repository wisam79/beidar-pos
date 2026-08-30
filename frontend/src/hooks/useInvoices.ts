import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../core/api';
import { Sale } from '../core/types';
import { queryKeys } from '../core/queryClient';

interface InvoicesData {
    data: Sale[];
    total: number;
    stats: { count: number; total: number; pending: number; returns: number };
}

export const useInvoices = (
    page: number, 
    pageSize: number, 
    search: string, 
    statusFilter: string, 
    dateFilter: string
) => {
    return useQuery<InvoicesData>({
        queryKey: queryKeys.sales.list(page, pageSize, search, statusFilter, dateFilter),
        queryFn: async () => {
            const data = await api.sales.list(page, pageSize, search, statusFilter, dateFilter);
            return {
                data: data?.data || [],
                total: data?.total || 0,
                stats: data?.stats || { count: 0, total: 0, pending: 0, returns: 0 }
            };
        },
        placeholderData: keepPreviousData // Keep previous data while fetching new page
    });
};
