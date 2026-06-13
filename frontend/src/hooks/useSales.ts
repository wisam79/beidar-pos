// ═══════════════════════════════════════════════════════════════════════════════
// 📊 useSales Hook - Sales Cache Invalidation
// ═══════════════════════════════════════════════════════════════════════════════

import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../core/queryClient';

// Mutation hook for invalidating sales cache after changes
export function useInvalidateSales() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
    };
}
