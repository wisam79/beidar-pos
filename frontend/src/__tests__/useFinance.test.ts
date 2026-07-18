import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useExpenses, usePurchaseOrders, useFinanceData } from '../hooks/useFinance';
import { api } from '../core/api';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../core/api', () => ({
    api: {
        expenses: {
            list: vi.fn(),
        },
        suppliers: {
            list: vi.fn(),
        },
        sales: {
            list: vi.fn(),
        },
        purchaseOrders: {
            list: vi.fn(),
        },
    },
}));

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });
    return ({ children }: { children: React.ReactNode }) => (
        React.createElement(QueryClientProvider, { client: queryClient }, children)
    );
};

describe('useFinance Hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('useExpenses fetches expenses', async () => {
        vi.mocked(api.expenses.list).mockResolvedValue([{ id: 'e1', title: 'Rent', amount: 500 }] as any);

        const { result } = renderHook(() => useExpenses(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.data).toEqual([{ id: 'e1', title: 'Rent', amount: 500 }]);
    });

    it('usePurchaseOrders fetches orders', async () => {
        vi.mocked(api.purchaseOrders.list).mockResolvedValue([{ id: 'po1', supplierId: 's1' }] as any);

        const { result } = renderHook(() => usePurchaseOrders('pending'), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.data).toEqual([{ id: 'po1', supplierId: 's1' }]);
        expect(api.purchaseOrders.list).toHaveBeenCalledWith('pending');
    });

    it('useFinanceData combines multiple API calls', async () => {
        vi.mocked(api.expenses.list).mockResolvedValue([{ id: 'e1' }] as any);
        vi.mocked(api.suppliers.list).mockResolvedValue([{ id: 's1' }] as any);
        vi.mocked(api.sales.list).mockResolvedValue({ data: [{ id: 'sale1' }] } as any);
        vi.mocked(api.purchaseOrders.list).mockResolvedValue([{ id: 'po1' }] as any);

        const { result } = renderHook(() => useFinanceData(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data).toEqual({
            expenses: [{ id: 'e1' }],
            suppliers: [{ id: 's1' }],
            sales: [{ id: 'sale1' }],
            purchaseOrders: [{ id: 'po1' }],
        });
    });
});
