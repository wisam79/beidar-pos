/**
 * Utility Functions Tests
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../core/utils';

describe('formatCurrency', () => {
    it('should format number with IQD currency', () => {
        const result = formatCurrency(1500, 'IQD');
        expect(result).toContain('1,500');
        expect(result).toContain('IQD');
    });

    it('should format number with USD currency', () => {
        const result = formatCurrency(1500, 'USD');
        expect(result).toContain('1,500');
        expect(result).toContain('USD');
    });

    it('should handle zero values', () => {
        const result = formatCurrency(0, 'IQD');
        expect(result).toContain('0');
    });

    it('should handle negative values', () => {
        const result = formatCurrency(-500, 'IQD');
        expect(result).toContain('500');
    });

    it('should handle large numbers', () => {
        const result = formatCurrency(1000000, 'IQD');
        expect(result).toContain('1,000,000');
    });

    it('should handle decimal values', () => {
        const result = formatCurrency(1234.567, 'USD');
        expect(result).toBeDefined();
    });
});

describe('Cart Calculations', () => {
    interface CartItem {
        id: string;
        name: string;
        price: number;
        quantity: number;
    }

    const calculateSubtotal = (items: CartItem[]): number => {
        return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const calculateDiscount = (subtotal: number, discountPercent: number): number => {
        return subtotal * (discountPercent / 100);
    };

    const calculateTotal = (subtotal: number, discount: number, vatRate: number = 0): number => {
        const afterDiscount = subtotal - discount;
        const vat = afterDiscount * (vatRate / 100);
        return afterDiscount + vat;
    };

    it('should calculate subtotal correctly', () => {
        const items: CartItem[] = [
            { id: '1', name: 'Item 1', price: 100, quantity: 2 },
            { id: '2', name: 'Item 2', price: 50, quantity: 3 }
        ];

        expect(calculateSubtotal(items)).toBe(350); // (100*2) + (50*3)
    });

    it('should calculate discount correctly', () => {
        expect(calculateDiscount(1000, 10)).toBe(100);
        expect(calculateDiscount(500, 20)).toBe(100);
        expect(calculateDiscount(1000, 0)).toBe(0);
    });

    it('should calculate total with VAT', () => {
        const subtotal = 1000;
        const discount = 100;
        const vatRate = 15;

        // After discount: 900, VAT: 135, Total: 1035
        expect(calculateTotal(subtotal, discount, vatRate)).toBe(1035);
    });

    it('should handle empty cart', () => {
        expect(calculateSubtotal([])).toBe(0);
    });
});

describe('Date Formatting', () => {
    const formatDate = (date: Date | string): string => {
        const d = new Date(date);
        return d.toLocaleDateString('en-GB');
    };

    const _formatDateTime = (date: Date | string): string => {
        const d = new Date(date);
        return d.toLocaleString('en-GB');
    };

    it('should format date correctly', () => {
        const date = new Date('2024-12-15');
        const result = formatDate(date);
        expect(result).toContain('15');
        expect(result).toContain('12');
        expect(result).toContain('2024');
    });

    it('should handle string dates', () => {
        const result = formatDate('2024-12-15');
        expect(result).toBeDefined();
    });
});

describe('Search and Filter Helpers', () => {
    interface Product {
        id: string;
        name: string;
        barcode: string;
        category: string;
        stock: number;
    }

    const products: Product[] = [
        { id: '1', name: 'Apple Juice', barcode: '123', category: 'Drinks', stock: 10 },
        { id: '2', name: 'Orange Juice', barcode: '456', category: 'Drinks', stock: 0 },
        { id: '3', name: 'Bread', barcode: '789', category: 'Food', stock: 5 }
    ];

    const searchProducts = (items: Product[], query: string): Product[] => {
        const q = query.toLowerCase();
        return items.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.barcode.includes(q)
        );
    };

    const filterByCategory = (items: Product[], category: string): Product[] => {
        if (category === 'الكل' || category === 'All') return items;
        return items.filter(p => p.category === category);
    };

    const filterByStock = (items: Product[], status: 'all' | 'low' | 'out'): Product[] => {
        if (status === 'all') return items;
        if (status === 'out') return items.filter(p => p.stock === 0);
        if (status === 'low') return items.filter(p => p.stock > 0 && p.stock <= 5);
        return items;
    };

    it('should search by name', () => {
        expect(searchProducts(products, 'apple')).toHaveLength(1);
        expect(searchProducts(products, 'juice')).toHaveLength(2);
    });

    it('should search by barcode', () => {
        expect(searchProducts(products, '123')).toHaveLength(1);
    });

    it('should filter by category', () => {
        expect(filterByCategory(products, 'Drinks')).toHaveLength(2);
        expect(filterByCategory(products, 'Food')).toHaveLength(1);
        expect(filterByCategory(products, 'الكل')).toHaveLength(3);
    });

    it('should filter by stock status', () => {
        expect(filterByStock(products, 'out')).toHaveLength(1);
        expect(filterByStock(products, 'low')).toHaveLength(1);
        expect(filterByStock(products, 'all')).toHaveLength(3);
    });
});
