import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useParkedSales } from '../hooks/useParkedSales';
import { api } from '../core/api';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../core/api', () => ({
    api: {
        sales: {
            getParked: vi.fn(),
            getParkedCount: vi.fn(),
            park: vi.fn(),
            retrieveParked: vi.fn(),
            deleteParked: vi.fn(),
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

describe('useParkedSales Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch parked sales and parked count', async () => {
        vi.mocked(api.sales.getParked).mockResolvedValue([{ id: 1, total: 100 }] as any);
        vi.mocked(api.sales.getParkedCount).mockResolvedValue(1);

        const { result } = renderHook(() => useParkedSales(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.parkedSales).toEqual([{ id: 1, total: 100 }]);
        expect(result.current.parkedCount).toBe(1);
    });

    it('should trigger parkSale mutation', async () => {
        vi.mocked(api.sales.park).mockResolvedValue({ id: 2 } as any);

        const { result } = renderHook(() => useParkedSales(), { wrapper: createWrapper() });

        const parkParams = {
            cart: [{ productId: 'p1', quantity: 2, price: 50, discount: 0, name: 'Prod' }] as any,
            customer: { id: 'c1', name: 'Cust' } as any,
            total: 100,
            note: 'Test note',
        };

        const res = await result.current.parkSale(parkParams);
        expect(api.sales.park).toHaveBeenCalledWith(
            JSON.stringify(parkParams.cart),
            'Cust',
            'c1',
            'Test note',
            100,
            1
        );
        expect(res).toEqual({ id: 2 });
    });

    it('should trigger retrieveSale and deleteSale mutations', async () => {
        vi.mocked(api.sales.retrieveParked).mockResolvedValue({ id: 5 } as any);
        vi.mocked(api.sales.deleteParked).mockResolvedValue(undefined as any);

        const { result } = renderHook(() => useParkedSales(), { wrapper: createWrapper() });

        const retrieved = await result.current.retrieveSale(5);
        expect(api.sales.retrieveParked).toHaveBeenCalledWith(5);
        expect(retrieved).toEqual({ id: 5 });

        await result.current.deleteSale(5);
        expect(api.sales.deleteParked).toHaveBeenCalledWith(5);
    });
});
