import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SaleHandler and DiscountHandler
vi.mock('../../../../wailsjs/go/handlers/SaleHandler', () => ({
    GetSales: vi.fn(),
    GetSale: vi.fn(),
    ProcessSale: vi.fn(),
    DeleteSale: vi.fn(),
    ReturnSale: vi.fn(),
    ParkSale: vi.fn(),
    GetParkedSales: vi.fn(),
    GetParkedSalesCount: vi.fn(),
    RetrieveParkedSale: vi.fn(),
    DeleteParkedSale: vi.fn(),
}));

vi.mock('../../../../wailsjs/go/handlers/DiscountHandler', () => ({
    GetAllDiscounts: vi.fn(),
    GetActiveDiscounts: vi.fn(),
    GetDiscount: vi.fn(),
    CreateDiscount: vi.fn(),
    UpdateDiscount: vi.fn(),
    DeleteDiscount: vi.fn(),
    ToggleDiscountStatus: vi.fn(),
    ValidateCoupon: vi.fn(),
    ApplyDiscount: vi.fn(),
}));

import { sales, discounts } from '../sales';
import * as SaleHandler from '../../../../wailsjs/go/handlers/SaleHandler';
import * as DiscountHandler from '../../../../wailsjs/go/handlers/DiscountHandler';

describe('Sales & Discounts API Wrapper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('sales api', () => {
        it('should list sales', async () => {
            vi.mocked(SaleHandler.GetSales).mockResolvedValue([] as any);
            await sales.list(1, 10, 'search', 'completed', '2026-07-10');
            expect(SaleHandler.GetSales).toHaveBeenCalledWith(1, 10, 'search', 'completed', '2026-07-10');
        });

        it('should get a single sale', async () => {
            vi.mocked(SaleHandler.GetSale).mockResolvedValue({ id: 's1' } as any);
            await sales.get('s1');
            expect(SaleHandler.GetSale).toHaveBeenCalledWith('s1');
        });

        it('should process a sale', async () => {
            vi.mocked(SaleHandler.ProcessSale).mockResolvedValue({ id: 's1' } as any);
            const saleData = { id: 's1' } as any;
            await sales.process(saleData);
            expect(SaleHandler.ProcessSale).toHaveBeenCalledWith(saleData);
        });

        it('should delete a sale', async () => {
            vi.mocked(SaleHandler.DeleteSale).mockResolvedValue(undefined as any);
            await sales.delete('s1');
            expect(SaleHandler.DeleteSale).toHaveBeenCalledWith('s1');
        });

        it('should return a sale', async () => {
            vi.mocked(SaleHandler.ReturnSale).mockResolvedValue(undefined as any);
            await sales.return('s1');
            expect(SaleHandler.ReturnSale).toHaveBeenCalledWith('s1');
        });

        it('should park a sale', async () => {
            vi.mocked(SaleHandler.ParkSale).mockResolvedValue({ id: 1 } as any);
            await sales.park('[]', 'Cust', 'c1', 'note', 100, 2);
            expect(SaleHandler.ParkSale).toHaveBeenCalledWith('[]', 'Cust', 'c1', 'note', 100, 2);
        });

        it('should get parked sales', async () => {
            vi.mocked(SaleHandler.GetParkedSales).mockResolvedValue([] as any);
            await sales.getParked();
            expect(SaleHandler.GetParkedSales).toHaveBeenCalled();
        });

        it('should get parked sales count', async () => {
            vi.mocked(SaleHandler.GetParkedSalesCount).mockResolvedValue(5);
            const res = await sales.getParkedCount();
            expect(SaleHandler.GetParkedSalesCount).toHaveBeenCalled();
            expect(res).toBe(5);
        });

        it('should retrieve a parked sale', async () => {
            vi.mocked(SaleHandler.RetrieveParkedSale).mockResolvedValue({ id: 1 } as any);
            await sales.retrieveParked(1);
            expect(SaleHandler.RetrieveParkedSale).toHaveBeenCalledWith(1);
        });

        it('should delete a parked sale', async () => {
            vi.mocked(SaleHandler.DeleteParkedSale).mockResolvedValue(undefined as any);
            await sales.deleteParked(1);
            expect(SaleHandler.DeleteParkedSale).toHaveBeenCalledWith(1);
        });
    });

    describe('discounts api', () => {
        it('should list all discounts', async () => {
            vi.mocked(DiscountHandler.GetAllDiscounts).mockResolvedValue([] as any);
            await discounts.list();
            expect(DiscountHandler.GetAllDiscounts).toHaveBeenCalled();
        });

        it('should list active discounts', async () => {
            vi.mocked(DiscountHandler.GetActiveDiscounts).mockResolvedValue([] as any);
            await discounts.listActive();
            expect(DiscountHandler.GetActiveDiscounts).toHaveBeenCalled();
        });

        it('should get a discount', async () => {
            vi.mocked(DiscountHandler.GetDiscount).mockResolvedValue({ id: 'd1' } as any);
            await discounts.get('d1');
            expect(DiscountHandler.GetDiscount).toHaveBeenCalledWith('d1');
        });

        it('should save a discount', async () => {
            vi.mocked(DiscountHandler.CreateDiscount).mockResolvedValue(undefined as any);
            const discountData = { id: 'd1', name: 'D1' } as any;
            await discounts.save(discountData);
            expect(DiscountHandler.CreateDiscount).toHaveBeenCalledWith(discountData);
        });

        it('should update a discount', async () => {
            vi.mocked(DiscountHandler.UpdateDiscount).mockResolvedValue(undefined as any);
            const discountData = { id: 'd1', name: 'D1' } as any;
            await discounts.update(discountData);
            expect(DiscountHandler.UpdateDiscount).toHaveBeenCalledWith(discountData);
        });

        it('should delete a discount', async () => {
            vi.mocked(DiscountHandler.DeleteDiscount).mockResolvedValue(undefined as any);
            await discounts.delete('d1');
            expect(DiscountHandler.DeleteDiscount).toHaveBeenCalledWith('d1');
        });

        it('should toggle discount status', async () => {
            vi.mocked(DiscountHandler.ToggleDiscountStatus).mockResolvedValue(undefined as any);
            await discounts.toggle('d1');
            expect(DiscountHandler.ToggleDiscountStatus).toHaveBeenCalledWith('d1');
        });

        it('should validate coupon', async () => {
            vi.mocked(DiscountHandler.ValidateCoupon).mockResolvedValue({ valid: true } as any);
            await discounts.validateCoupon('COUPON');
            expect(DiscountHandler.ValidateCoupon).toHaveBeenCalledWith('COUPON');
        });

        it('should apply discount', async () => {
            vi.mocked(DiscountHandler.ApplyDiscount).mockResolvedValue(undefined as any);
            await discounts.apply('d1');
            expect(DiscountHandler.ApplyDiscount).toHaveBeenCalledWith('d1');
        });
    });
});
