// ═══════════════════════════════════════════════════════════════════════════════
// ⏸️ useParkedSales Hook - Parked Sales Management with React Query
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ParkedSaleDB } from '../core/api';
import { queryKeys } from '../core/queryClient';
import { CartItem, Customer } from '../core/types';

interface UseParkedSalesReturn {
    // Data
    parkedSales: ParkedSaleDB[];
    parkedCount: number;

    // Loading states
    isLoading: boolean;
    isCountLoading: boolean;

    // Actions
    parkSale: (params: ParkSaleParams) => Promise<ParkedSaleDB>;
    retrieveSale: (id: number) => Promise<ParkedSaleDB>;
    deleteSale: (id: number) => Promise<void>;

    // Refetch
    refetch: () => void;
}

interface ParkSaleParams {
    cart: CartItem[];
    customer: Customer | null;
    total: number;
    note?: string;
}

export function useParkedSales(): UseParkedSalesReturn {
    const queryClient = useQueryClient();

    // Fetch parked sales list
    const {
        data: parkedSales = [],
        isLoading,
        refetch,
    } = useQuery({
        queryKey: queryKeys.sales.parked(),
        queryFn: () => api.sales.getParked(),
    });

    // Fetch parked count (for badge)
    const { data: parkedCount = 0, isLoading: isCountLoading } = useQuery({
        queryKey: queryKeys.sales.parkedCount(),
        queryFn: () => api.sales.getParkedCount(),
    });

    // Park a sale
    const parkMutation = useMutation({
        mutationFn: async (params: ParkSaleParams) => {
            const itemsJSON = JSON.stringify(params.cart);
            return api.sales.park(
                itemsJSON,
                params.customer?.name || '',
                params.customer?.id || '',
                params.note || '',
                params.total,
                params.cart.length
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sales.parked() });
            queryClient.invalidateQueries({ queryKey: queryKeys.sales.parkedCount() });
        },
    });

    // Retrieve a parked sale
    const retrieveMutation = useMutation({
        mutationFn: (id: number) => api.sales.retrieveParked(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sales.parked() });
            queryClient.invalidateQueries({ queryKey: queryKeys.sales.parkedCount() });
        },
    });

    // Delete a parked sale
    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.sales.deleteParked(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sales.parked() });
            queryClient.invalidateQueries({ queryKey: queryKeys.sales.parkedCount() });
        },
    });

    return {
        parkedSales,
        parkedCount,
        isLoading,
        isCountLoading,
        parkSale: parkMutation.mutateAsync,
        retrieveSale: retrieveMutation.mutateAsync,
        deleteSale: deleteMutation.mutateAsync,
        refetch,
    };
}
