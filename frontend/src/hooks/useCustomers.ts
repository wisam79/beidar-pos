// ═══════════════════════════════════════════════════════════════════════════════
// 👥 useCustomers Hook - Customer Data Fetching with React Query
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../core/api';
import { Customer } from '../core/types';
import { queryKeys } from '../core/queryClient';

interface UseCustomersReturn {
    customers: Customer[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => void;
}

export function useCustomers(): UseCustomersReturn {
    const {
        data,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: queryKeys.customers.list(),
        queryFn: () => api.customers.list(),
    });

    return {
        customers: data || [],
        isLoading,
        isError,
        error: error as Error | null,
        refetch,
    };
}

interface UseCustomersPagedReturn {
    customers: Customer[];
    total: number;
    totalPages: number;
    page: number;
    pageSize: number;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => void;
}

export function useCustomersPaged(page: number = 1, pageSize: number = 50, search: string = ''): UseCustomersPagedReturn {
    const {
        data,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: queryKeys.customers.listPaged(page, pageSize, search),
        queryFn: () => api.customers.listPaged(page, pageSize, search),
    });

    return {
        customers: data?.data || [],
        total: data?.total || 0,
        totalPages: data?.totalPages || 1,
        page: data?.page || page,
        pageSize: data?.pageSize || pageSize,
        isLoading,
        isError,
        error: error as Error | null,
        refetch,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mutation hook for invalidating customers cache after changes
// ═══════════════════════════════════════════════════════════════════════════════

export function useInvalidateCustomers() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    };
}
