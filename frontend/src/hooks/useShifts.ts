import { useQuery } from '@tanstack/react-query';
import { api } from '../core/api';
import { Shift, CashMovement } from '../core/types';

export const useShiftsHistory = (limit: number = 50) => {
    return useQuery<Shift[]>({
        queryKey: ['shifts', 'history', limit],
        queryFn: async () => {
            const data = await api.shift.getHistory(limit);
            return data || [];
        }
    });
};

export const useShiftMovements = (shiftId: string | null) => {
    return useQuery<CashMovement[]>({
        queryKey: ['shifts', 'movements', shiftId],
        queryFn: async () => {
            if (!shiftId) return [];
            const data = await api.shift.getMovements(shiftId);
            return data || [];
        },
        enabled: !!shiftId
    });
};
