import { useQuery } from '@tanstack/react-query';
import { api } from '../core/api';

export const useDiscounts = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['discounts'],
        queryFn: async () => {
            const data = await api.discounts.list();
            return data || [];
        },
        enabled
    });
};
