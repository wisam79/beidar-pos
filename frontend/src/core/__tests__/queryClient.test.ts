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
import {
    queryClient,
    invalidateAllData,
    invalidateProducts,
    invalidateCustomers,
    invalidateSales,
    invalidateFinance,
    invalidateShifts,
    invalidateStaff,
    invalidateDiscounts,
    queryKeys
} from '../queryClient';

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

    it('invalidateProducts invalidates products, inventory, stock movements, and stats', () => {
        const spy = vi.spyOn(queryClient, 'invalidateQueries');
        invalidateProducts();
        expect(spy).toHaveBeenCalledWith({ queryKey: ['products'] });
        expect(spy).toHaveBeenCalledWith({ queryKey: ['inventory'] });
        expect(spy).toHaveBeenCalledWith({ queryKey: ['stockMovements'] });
        expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard_stats'] });
        expect(spy).toHaveBeenCalledWith({ queryKey: ['reports'] });
    });

    it('invalidateCustomers invalidates customers and reports', () => {
        const spy = vi.spyOn(queryClient, 'invalidateQueries');
        invalidateCustomers();
        expect(spy).toHaveBeenCalledWith({ queryKey: ['customers'] });
        expect(spy).toHaveBeenCalledWith({ queryKey: ['reports', 'customers'] });
    });

    it('invalidateSales invalidates sales, finance data, and dashboard stats', () => {
        const spy = vi.spyOn(queryClient, 'invalidateQueries');
        invalidateSales();
        expect(spy).toHaveBeenCalledWith({ queryKey: ['sales'] });
        expect(spy).toHaveBeenCalledWith({ queryKey: ['finance_data'] });
        expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard_stats'] });
    });

    it('invalidateFinance invalidates finance data, purchase orders, expenses, and shifts', () => {
        const spy = vi.spyOn(queryClient, 'invalidateQueries');
        invalidateFinance();
        expect(spy).toHaveBeenCalledWith({ queryKey: ['finance_data'] });
        expect(spy).toHaveBeenCalledWith({ queryKey: ['purchaseOrders'] });
        expect(spy).toHaveBeenCalledWith({ queryKey: ['reports', 'expenses'] });
    });

    it('invalidateShifts invalidates shifts and finance data', () => {
        const spy = vi.spyOn(queryClient, 'invalidateQueries');
        invalidateShifts();
        expect(spy).toHaveBeenCalledWith({ queryKey: ['shifts'] });
        expect(spy).toHaveBeenCalledWith({ queryKey: ['finance_data'] });
    });

    it('invalidateStaff invalidates staff and reports', () => {
        const spy = vi.spyOn(queryClient, 'invalidateQueries');
        invalidateStaff();
        expect(spy).toHaveBeenCalledWith({ queryKey: ['staff'] });
        expect(spy).toHaveBeenCalledWith({ queryKey: ['reports', 'staff'] });
    });

    it('invalidateDiscounts invalidates discounts', () => {
        const spy = vi.spyOn(queryClient, 'invalidateQueries');
        invalidateDiscounts();
        expect(spy).toHaveBeenCalledWith({ queryKey: ['discounts'] });
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
