// ═══════════════════════════════════════════════════════════════════════════════
// 📦 useProducts Hook - Product Data Fetching with React Query
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../core/api';
import { Product } from '../core/types';
import { queryKeys } from '../core/queryClient';

interface UseProductsOptions {
    search?: string;
    category?: string;
    status?: string;
    pageSize?: number;
    enabled?: boolean;
}

interface UseProductsReturn {
    products: Product[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => void;

    // Filtered products for search
    filteredProducts: Product[];

    // Categories extracted from products
    categories: { id: string; name: string }[];
}

export function useProducts(options: UseProductsOptions = {}): UseProductsReturn {
    const {
        search = '',
        category = 'الكل',
        status = 'all',
        pageSize = 1000,
        enabled = true,
    } = options;

    const queryClient = useQueryClient();

    // Main query - fetches all products (for POS, we load all for fast filtering)
    const {
        data,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: queryKeys.products.list({ search: '', category: '', status }),
        queryFn: () => api.products.list(0, pageSize, '', '', '', status),
        enabled,
    });

    const products = data?.data || [];

    // Client-side filtering for instant search
    const filteredProducts = useMemo(() => {
        let result = products;

        // Filter by category
        if (category !== 'الكل') {
            result = result.filter(p => p.category === category);
        }

        // Filter by search query
        if (search) {
            const query = search.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.barcode.includes(query)
            );
        }

        return result;
    }, [products, category, search]);

    // Extract unique categories from products
    const categories = useMemo(() => {
        const uniqueCategories = Array.from(
            new Set(products.map(p => p.category))
        ).filter(Boolean);

        return uniqueCategories.map(cat => ({ id: cat, name: cat }));
    }, [products]);

    return {
        products,
        isLoading,
        isError,
        error: error as Error | null,
        refetch,
        filteredProducts,
        categories,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mutation hook for invalidating products cache after changes
// ═══════════════════════════════════════════════════════════════════════════════

export function useInvalidateProducts() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    };
}
