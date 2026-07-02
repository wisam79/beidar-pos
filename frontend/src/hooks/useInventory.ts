import { useQuery } from '@tanstack/react-query';
import { api, ProductStats } from '../core/api';
import { Product, StockMovement } from '../core/types';

export const useInventoryProducts = (
    page: number,
    pageSize: number,
    search: string,
    category: string,
    supplier: string,
    filterType: string
) => {
    return useQuery({
        queryKey: ['inventory', 'products', page, pageSize, search, category, supplier, filterType],
        queryFn: async () => {
            const dbCategory = category === 'all' ? '' : category;
            const dbSupplier = supplier === 'all' ? '' : supplier;
            
            const response = await api.products.list(
                page + 1, // API is 1-based
                pageSize,
                search,
                dbCategory,
                dbSupplier,
                filterType
            );
            
            return {
                products: response?.data || [],
                totalItems: response?.total || 0,
                totalPages: response?.totalPages || 0,
                stats: response?.stats || { totalStock: 0, totalValue: 0, totalCost: 0, profit: 0 }
            };
        },
        placeholderData: (previousData) => previousData
    });
};

export const useInventoryMetadata = () => {
    return useQuery({
        queryKey: ['inventory', 'metadata'],
        queryFn: async () => {
            const [cats, sups] = await Promise.all([
                api.categories.list().catch(() => []),
                api.suppliers.list().catch(() => [])
            ]);

            const mappedCats = (Array.isArray(cats) ? cats : []).map((c: { name: string }) => ({ id: c.name, name: c.name }));
            const mappedSups = (Array.isArray(sups) ? sups : []).map((s) => ({ id: s.id || '', companyName: s.companyName || '' }));

            return {
                categories: mappedCats,
                suppliers: mappedSups
            };
        }
    });
};

export const useInventoryMovements = (enabled: boolean) => {
    return useQuery<StockMovement[]>({
        queryKey: ['inventory', 'movements'],
        queryFn: async () => {
            const data = await api.stock.movements();
            return (data || []) as StockMovement[];
        },
        enabled
    });
};
