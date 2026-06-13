/**
 * API Layer Tests - Testing the API wrapper functions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Wails runtime
vi.mock('../../wailsjs/runtime', () => ({
    EventsOn: vi.fn(),
    EventsOff: vi.fn(),
    EventsEmit: vi.fn()
}));

// Mock Go Handlers inline to avoid hoisting ReferenceErrors
vi.mock('../../wailsjs/go/handlers/ProductHandler', () => ({
    GetAllProducts: vi.fn(),
    CreateProduct: vi.fn(),
    UpdateProduct: vi.fn(),
    DeleteProduct: vi.fn()
}));

vi.mock('../../wailsjs/go/handlers/SaleHandler', () => ({
    GetSales: vi.fn(),
    GetDailySales: vi.fn()
}));

vi.mock('../../wailsjs/go/handlers/SettingsHandler', () => ({
    GetPreferences: vi.fn(),
    UpdatePreferences: vi.fn()
}));

// Import real API bridge and handlers to control mocks
import { api, Product, AppPreferences } from '../core/api';
import * as ProductHandler from '../../wailsjs/go/handlers/ProductHandler';
import * as SettingsHandler from '../../wailsjs/go/handlers/SettingsHandler';

describe('API Layer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Products API', () => {
        it('should fetch all products with pagination and calculation', async () => {
            const mockProducts = [
                { id: '1', name: 'Product 1', price: 100, cost: 50, stock: 10, barcode: '123' },
                { id: '2', name: 'Product 2', price: 200, cost: 100, stock: 5, barcode: '456' }
            ];

            vi.mocked(ProductHandler.GetAllProducts).mockResolvedValue(mockProducts as unknown as Product[]);

            const result = await api.products.list(1, 10, '', '', '', '');
            
            expect(ProductHandler.GetAllProducts).toHaveBeenCalled();
            expect(result.data).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.stats.totalStock).toBe(15);
            expect(result.stats.totalValue).toBe(2000); // (100*10) + (200*5)
            expect(result.stats.totalCost).toBe(1000);  // (50*10) + (100*5)
            expect(result.stats.profit).toBe(1000);
        });

        it('should search products and filter correctly', async () => {
            const mockProducts = [
                { id: '1', name: 'Apple Juice', price: 100, cost: 50, stock: 10, barcode: '123', category: 'Drinks' },
                { id: '2', name: 'Orange Juice', price: 200, cost: 100, stock: 5, barcode: '456', category: 'Drinks' }
            ];

            vi.mocked(ProductHandler.GetAllProducts).mockResolvedValue(mockProducts as unknown as Product[]);

            // Filter by search query "Apple"
            const resultSearch = await api.products.list(1, 10, 'Apple', '', '', '');
            expect(resultSearch.data).toHaveLength(1);
            expect(resultSearch.data[0].name).toBe('Apple Juice');
        });

        it('should create a new product', async () => {
            const newProduct = {
                id: '',
                name: 'New Product',
                barcode: '123456789',
                price: 150,
                cost: 100,
                stock: 20,
                minStock: 5,
                category: 'General',
                image: ''
            };

            vi.mocked(ProductHandler.CreateProduct).mockResolvedValue(newProduct as unknown as void);

            await api.products.save(newProduct as unknown as Product);
            expect(ProductHandler.CreateProduct).toHaveBeenCalledWith(newProduct as unknown as Product);
        });

        it('should update an existing product', async () => {
            const existingProduct = {
                id: 'prod_123',
                name: 'Existing Product',
                barcode: '123456789',
                price: 150,
                cost: 100,
                stock: 20,
                minStock: 5,
                category: 'General',
                image: ''
            };

            vi.mocked(ProductHandler.UpdateProduct).mockResolvedValue(existingProduct as unknown as void);

            await api.products.save(existingProduct as unknown as Product);
            expect(ProductHandler.UpdateProduct).toHaveBeenCalledWith(existingProduct as unknown as Product);
        });

        it('should delete a product by ID', async () => {
            vi.mocked(ProductHandler.DeleteProduct).mockResolvedValue(undefined as unknown as void);

            await api.products.delete('product-123');
            expect(ProductHandler.DeleteProduct).toHaveBeenCalledWith('product-123');
        });
    });

    describe('Preferences API', () => {
        it('should fetch app preferences', async () => {
            const mockPrefs = {
                storeName: 'My Store',
                currency: 'IQD',
                theme: 'dark',
                language: 'ar'
            };

            vi.mocked(SettingsHandler.GetPreferences).mockResolvedValue(mockPrefs as unknown as AppPreferences);

            const result = await api.prefs.get();
            expect(SettingsHandler.GetPreferences).toHaveBeenCalled();
            expect(result.storeName).toBe('My Store');
        });

        it('should save app preferences', async () => {
            const newPrefs = {
                storeName: 'Updated Store',
                currency: 'USD',
                theme: 'light',
                language: 'en'
            };

            vi.mocked(SettingsHandler.UpdatePreferences).mockResolvedValue(undefined as unknown as void);

            await api.prefs.set(newPrefs as unknown as AppPreferences);
            expect(SettingsHandler.UpdatePreferences).toHaveBeenCalledWith(newPrefs as unknown as AppPreferences);
        });
    });
});
