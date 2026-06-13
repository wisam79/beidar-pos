import { useQuery } from '@tanstack/react-query';
import { api, StockMovement } from '../core/api';

interface UseStockMovementsReturn {
    stockMovements: StockMovement[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => void;
}

export function useStockMovements(): UseStockMovementsReturn {
    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['stockMovements'],
        queryFn: () => api.stock.movements(),
    });

    return {
        stockMovements: data || [],
        isLoading,
        isError,
        error: error as Error | null,
        refetch,
    };
}
