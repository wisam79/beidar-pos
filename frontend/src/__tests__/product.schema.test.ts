import { describe, it, expect } from 'vitest';
import { validateProduct, validateProductInput } from '../core/schemas/product.schema';

describe('Product Schema Validation', () => {
    it('should validate a valid product', () => {
        const validProduct = {
            id: 'prod-001',
            name: 'منتج تجريبي',
            price: 1500,
            cost: 1000,
            stock: 50,
            minStock: 5,
            category: 'إلكترونيات',
            image: '',
            barcode: '123456789',
        };

        const result = validateProduct(validProduct);
        expect(result.success).toBe(true);
    });

    it('should reject product with empty name', () => {
        const invalidProduct = {
            id: 'prod-002',
            name: 'أ', // Too short
            price: 1500,
            cost: 1000,
            stock: 50,
            minStock: 5,
            category: 'إلكترونيات',
        };

        const result = validateProduct(invalidProduct);
        expect(result.success).toBe(false);
    });

    it('should reject product with negative price', () => {
        const invalidProduct = {
            id: 'prod-003',
            name: 'منتج تجريبي',
            price: -100, // Negative
            cost: 1000,
            stock: 50,
            minStock: 5,
            category: 'إلكترونيات',
        };

        const result = validateProduct(invalidProduct);
        expect(result.success).toBe(false);
    });

    it('should allow optional id for new products', () => {
        const newProduct = {
            name: 'منتج جديد',
            price: 2000,
            cost: 1500,
            stock: 100,
            minStock: 10,
            category: 'ملابس',
        };

        const result = validateProductInput(newProduct);
        expect(result.success).toBe(true);
    });
});
