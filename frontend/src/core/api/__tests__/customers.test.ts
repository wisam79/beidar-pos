import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock CRMHandler
vi.mock('../../../../wailsjs/go/handlers/CRMHandler', () => ({
    GetCustomers: vi.fn(),
    SaveCustomer: vi.fn(),
    DeleteCustomer: vi.fn(),
    GetSuppliers: vi.fn(),
    SaveSupplier: vi.fn(),
    DeleteSupplier: vi.fn(),
}));

import { customers, suppliers } from '../customers';
import * as CRMHandler from '../../../../wailsjs/go/handlers/CRMHandler';

describe('Customers & Suppliers API Wrapper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('customers api', () => {
        it('should list customers', async () => {
            vi.mocked(CRMHandler.GetCustomers).mockResolvedValue([] as any);
            await customers.list();
            expect(CRMHandler.GetCustomers).toHaveBeenCalled();
        });

        it('should save customer', async () => {
            vi.mocked(CRMHandler.SaveCustomer).mockResolvedValue(undefined as any);
            const data = { name: 'Customer A' } as any;
            await customers.save(data);
            expect(CRMHandler.SaveCustomer).toHaveBeenCalledWith(data);
        });

        it('should delete customer', async () => {
            vi.mocked(CRMHandler.DeleteCustomer).mockResolvedValue(undefined as any);
            await customers.delete('c1', true);
            expect(CRMHandler.DeleteCustomer).toHaveBeenCalledWith('c1', true);
        });
    });

    describe('suppliers api', () => {
        it('should list suppliers', async () => {
            vi.mocked(CRMHandler.GetSuppliers).mockResolvedValue([] as any);
            await suppliers.list();
            expect(CRMHandler.GetSuppliers).toHaveBeenCalled();
        });

        it('should save supplier', async () => {
            vi.mocked(CRMHandler.SaveSupplier).mockResolvedValue(undefined as any);
            const data = { name: 'Supplier A' } as any;
            await suppliers.save(data);
            expect(CRMHandler.SaveSupplier).toHaveBeenCalledWith(data);
        });

        it('should delete supplier', async () => {
            vi.mocked(CRMHandler.DeleteSupplier).mockResolvedValue(undefined as any);
            await suppliers.delete('s1', true);
            expect(CRMHandler.DeleteSupplier).toHaveBeenCalledWith('s1', true);
        });
    });
});
