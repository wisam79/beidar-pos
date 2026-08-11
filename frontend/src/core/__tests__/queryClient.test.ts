/**
 * Data-refresh layer tests.
 *
 * These lock the contract that fixed the "stale installment modal" bug family:
 *  - invalidateAllData() must invalidate ALL cached queries (not only the
 *    currently-mounted ones), so inactive screens refetch on their next mount.
 *  - every sales list/installment key must share the 'sales' prefix so a
 *    single targeted invalidation covers every screen that shows sales.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { queryClient, invalidateAllData, queryKeys } from '../queryClient';

describe('queryClient data-refresh layer', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        queryClient.clear();
    });

    it('invalidateAllData invalidates ALL queries (not only active ones)', () => {
        const spy = vi.spyOn(queryClient, 'invalidateQueries');
        invalidateAllData();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith();
    });

    it('sales list keys share the sales prefix for targeted invalidation', () => {
        const customersList = queryKeys.sales.list(0, 5000, '', '', '');
        const invoicesList = queryKeys.sales.list(1, 20, 'foo', 'all', 'today');
        const installments = queryKeys.sales.installments('c1');
        const parked = queryKeys.sales.parked();
        const parkedCount = queryKeys.sales.parkedCount();

        for (const key of [customersList, invoicesList, installments, parked, parkedCount]) {
            expect(key[0]).toBe('sales');
        }
    });
});
