import { describe, it, expect, vi } from 'vitest';
import { formatCurrency } from '../core/utils';

// Test the Currency Formatting
describe('Currency Formatting', () => {
    it('should format currency with IQD correctly', () => {
        expect(formatCurrency(1500, 'IQD')).toBe('1,500 IQD');
        expect(formatCurrency(0, 'IQD')).toBe('0 IQD');
        expect(formatCurrency(1000000, 'IQD')).toBe('1,000,000 IQD');
    });

    it('should format currency with USD correctly', () => {
        expect(formatCurrency(1500, 'USD')).toBe('1,500 USD');
    });
});

// Test ABC Classification Logic
describe('ABC Classification', () => {
    const getABCClass = (productValue: number, totalValue: number): 'A' | 'B' | 'C' => {
        const percentage = (productValue / totalValue) * 100;
        if (percentage >= 10) return 'A';
        if (percentage >= 5) return 'B';
        return 'C';
    };

    it('should return A for high-value products', () => {
        expect(getABCClass(1000, 5000)).toBe('A'); // 20%
        expect(getABCClass(500, 5000)).toBe('A'); // 10%
    });

    it('should return B for medium-value products', () => {
        expect(getABCClass(400, 5000)).toBe('B'); // 8%
        expect(getABCClass(250, 5000)).toBe('B'); // 5%
    });

    it('should return C for low-value products', () => {
        expect(getABCClass(100, 5000)).toBe('C'); // 2%
        expect(getABCClass(50, 5000)).toBe('C'); // 1%
    });
});

// Test Discount Calculation
describe('Discount Calculation', () => {
    const calculateDiscount = (
        originalPrice: number,
        discountType: 'percentage' | 'amount',
        discountValue: number,
        maxDiscount?: number
    ): number => {
        let discount = discountType === 'percentage'
            ? originalPrice * (discountValue / 100)
            : discountValue;

        if (maxDiscount && discount > maxDiscount) {
            discount = maxDiscount;
        }

        return Math.max(0, Math.min(discount, originalPrice));
    };

    it('should calculate percentage discount correctly', () => {
        expect(calculateDiscount(1000, 'percentage', 10)).toBe(100);
        expect(calculateDiscount(1000, 'percentage', 25)).toBe(250);
    });

    it('should calculate fixed amount discount correctly', () => {
        expect(calculateDiscount(1000, 'amount', 150)).toBe(150);
        expect(calculateDiscount(1000, 'amount', 50)).toBe(50);
    });

    it('should respect max discount limit', () => {
        expect(calculateDiscount(1000, 'percentage', 50, 300)).toBe(300);
        expect(calculateDiscount(100, 'amount', 150, 50)).toBe(50);
    });

    it('should not exceed original price', () => {
        expect(calculateDiscount(100, 'amount', 200)).toBe(100);
    });
});

// Test Profit Margin Calculation
describe('Profit Margin Calculation', () => {
    const calculateMargin = (price: number, cost: number): number => {
        if (cost === 0) return 0;
        return ((price - cost) / cost) * 100;
    };

    it('should calculate margin correctly', () => {
        expect(calculateMargin(150, 100)).toBe(50);
        expect(calculateMargin(200, 100)).toBe(100);
    });

    it('should handle zero cost', () => {
        expect(calculateMargin(100, 0)).toBe(0);
    });

    it('should handle negative margin', () => {
        expect(calculateMargin(80, 100)).toBe(-20);
    });
});

// Test Stock Alert Logic
describe('Stock Alert Logic', () => {
    const getStockStatus = (stock: number, minStock: number): 'normal' | 'low' | 'out' => {
        if (stock === 0) return 'out';
        if (stock <= minStock) return 'low';
        return 'normal';
    };

    it('should return out for zero stock', () => {
        expect(getStockStatus(0, 5)).toBe('out');
    });

    it('should return low for stock at or below min', () => {
        expect(getStockStatus(5, 5)).toBe('low');
        expect(getStockStatus(3, 5)).toBe('low');
    });

    it('should return normal for stock above min', () => {
        expect(getStockStatus(10, 5)).toBe('normal');
        expect(getStockStatus(100, 5)).toBe('normal');
    });
});
