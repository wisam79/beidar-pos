import { useQuery } from '@tanstack/react-query';
import { api } from '../core/api';
import { Sale } from '../core/types';

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
        queryKey: ['invoices', page, pageSize, search, statusFilter, dateFilter],
        queryFn: async () => {
            const data = await api.sales.list(page, pageSize, search, statusFilter, dateFilter);
            return data;
        },
        placeholderData: (previousData) => previousData // Keep previous data while fetching new page
    });
};
