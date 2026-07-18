import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ProductHandler and FinanceHandler
vi.mock('../../../../wailsjs/go/handlers/ProductHandler', () => ({
    GetAllProducts: vi.fn(),
    CreateProduct: vi.fn(),
    UpdateProduct: vi.fn(),
    DeleteProduct: vi.fn(),
    SearchProducts: vi.fn(),
    GetStockMovements: vi.fn(),
    LogStockMovement: vi.fn(),
}));

vi.mock('../../../../wailsjs/go/handlers/FinanceHandler', () => ({
    GetCategories: vi.fn(),
    SaveCategory: vi.fn(),
    DeleteCategory: vi.fn(),
}));

import { products, stock, categories } from '../products';
import * as ProductHandler from '../../../../wailsjs/go/handlers/ProductHandler';
import * as FinanceHandler from '../../../../wailsjs/go/handlers/FinanceHandler';

describe('Products, Stock & Categories API Wrapper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('products api list and pagination/filtering', () => {
        const dummyProducts = [
            { id: '1', name: 'Apple', barcode: '111', stock: 10, price: 1000, cost: 700, minStock: 2 },
            { id: '2', name: 'Banana', barcode: '222', stock: 1, price: 500, cost: 300, minStock: 3 }, // low stock
            { id: '3', name: 'Cherry', barcode: '333', stock: 0, price: 2000, cost: 1500, minStock: 1 }, // out of stock
        ];

        it('should list and compute stats for all products', async () => {
            vi.mocked(ProductHandler.GetAllProducts).mockResolvedValue(dummyProducts as any);
            const res = await products.list(1, 0, '', '', '', '');
            expect(res.data.length).toBe(3);
            expect(res.stats.totalStock).toBe(11);
            expect(res.stats.totalValue).toBe(1000 * 10 + 500 * 1 + 2000 * 0);
            expect(res.stats.totalCost).toBe(700 * 10 + 300 * 1 + 1500 * 0);
        });

        it('should filter by search query', async () => {
            vi.mocked(ProductHandler.GetAllProducts).mockResolvedValue(dummyProducts as any);
            const res = await products.list(1, 10, 'app', '', '', '');
            expect(res.data.length).toBe(1);
            expect(res.data[0].name).toBe('Apple');
        });

        it('should filter by low stock status', async () => {
            vi.mocked(ProductHandler.GetAllProducts).mockResolvedValue(dummyProducts as any);
            const res = await products.list(1, 10, '', '', '', 'low');
            expect(res.data.length).toBe(1);
            expect(res.data[0].name).toBe('Banana');
        });

        it('should filter by out of stock status', async () => {
            vi.mocked(ProductHandler.GetAllProducts).mockResolvedValue(dummyProducts as any);
            const res = await products.list(1, 10, '', '', '', 'out');
            expect(res.data.length).toBe(1);
            expect(res.data[0].name).toBe('Cherry');
        });
    });

    describe('products api mutations', () => {
        it('should call CreateProduct if product has no ID', async () => {
            vi.mocked(ProductHandler.CreateProduct).mockResolvedValue(undefined as any);
            await products.save({ name: 'New' } as any);
            expect(ProductHandler.CreateProduct).toHaveBeenCalledWith({ name: 'New' });
        });

        it('should call UpdateProduct if product has an ID', async () => {
            vi.mocked(ProductHandler.UpdateProduct).mockResolvedValue(undefined as any);
            await products.save({ id: '1', name: 'Updated' } as any);
            expect(ProductHandler.UpdateProduct).toHaveBeenCalledWith({ id: '1', name: 'Updated' });
        });

        it('should delete a product', async () => {
            vi.mocked(ProductHandler.DeleteProduct).mockResolvedValue(undefined as any);
            await products.delete('1');
            expect(ProductHandler.DeleteProduct).toHaveBeenCalledWith('1');
        });

        it('should search products via handler', async () => {
            vi.mocked(ProductHandler.SearchProducts).mockResolvedValue([] as any);
            await products.search('test');
            expect(ProductHandler.SearchProducts).toHaveBeenCalledWith('test');
        });
    });

    describe('stock movements api', () => {
        it('should get movements', async () => {
            vi.mocked(ProductHandler.GetStockMovements).mockResolvedValue([] as any);
            await stock.movements();
            expect(ProductHandler.GetStockMovements).toHaveBeenCalled();
        });

        it('should log movement', async () => {
            vi.mocked(ProductHandler.LogStockMovement).mockResolvedValue(undefined as any);
            await stock.log('p1', 'Prod', 'in', 5, 'reason');
            expect(ProductHandler.LogStockMovement).toHaveBeenCalledWith('p1', 'Prod', 'in', 5, 'reason');
        });
    });

    describe('categories api', () => {
        it('should list categories', async () => {
            vi.mocked(FinanceHandler.GetCategories).mockResolvedValue([] as any);
            await categories.list();
            expect(FinanceHandler.GetCategories).toHaveBeenCalled();
        });

        it('should save category', async () => {
            vi.mocked(FinanceHandler.SaveCategory).mockResolvedValue(undefined as any);
            await categories.save({ name: 'Cat' } as any);
            expect(FinanceHandler.SaveCategory).toHaveBeenCalledWith({ name: 'Cat' });
        });

        it('should delete category', async () => {
            vi.mocked(FinanceHandler.DeleteCategory).mockResolvedValue(undefined as any);
            await categories.delete('cat1', true);
            expect(FinanceHandler.DeleteCategory).toHaveBeenCalledWith('cat1', true);
        });
    });
});
