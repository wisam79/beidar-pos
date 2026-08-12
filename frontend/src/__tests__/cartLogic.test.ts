import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCart } from '../features/pos/hooks/useCart';
import { Product } from '../core/types';

// Mock product factory
const createProduct = (id: string, price: number, stock: number = 100): Product => ({
    id,
    name: `Product ${id}`,
    barcode: id,
    price,
    cost: price * 0.8,
    stock,
    minStock: 5,
    wholesalePrice: price * 0.9,
    category: 'General',
    image: '',
});

describe('useCart Logic Validations', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    // 10 test cases for subtotal
    describe('Subtotal Calculations', () => {
        const subtotalCases = [
            { prices: [100], expected: 100 },
            { prices: [100, 200], expected: 300 },
            { prices: [100], expected: 100 },
            { prices: [1, 2, 3], expected: 6 },
            { prices: Array(10).fill(10), expected: 100 },
            { prices: [0, 50], expected: 50 },
            { prices: [1000000], expected: 1000000 },
            { prices: [1, 2, 3, 4], expected: 10 },
            { prices: [123, 678], expected: 801 },
            { prices: [], expected: 0 },
        ];

        subtotalCases.forEach((tc, i) => {
            it(`should calculate subtotal correctly - Case ${i + 1}`, () => {
                const { result } = renderHook(() => useCart());
                act(() => {
                    tc.prices.forEach((p, idx) => {
                        result.current.addToCart(createProduct(`p${idx}`, p), true);
                    });
                });
                expect(result.current.subtotal).toBe(tc.expected);
            });
        });
    });

    // 10 test cases for VAT
    describe('VAT Calculations (15%)', () => {
        const vatCases = [
            { price: 100, expectedVat: 15 },
            { price: 200, expectedVat: 30 },
            { price: 100, expectedVat: 15 },
            { price: 10, expectedVat: 2 }, // Math.round(10 * 0.15) = Math.round(1.5) = 2
            { price: 0, expectedVat: 0 },
            { price: 1000, expectedVat: 150 },
            { price: 50, expectedVat: 8 },  // Math.round(50 * 0.15) = 8
            { price: 10000, expectedVat: 1500 },
            { price: 33, expectedVat: 5 },  // Math.round(33 * 0.15) = 5
            { price: 15, expectedVat: 2 },  // Math.round(15 * 0.15) = 2
        ];

        vatCases.forEach((tc, i) => {
            it(`should calculate VAT correctly - Case ${i + 1}`, () => {
                const { result } = renderHook(() => useCart({ taxRate: 15 }));
                act(() => {
                    if (tc.price > 0) {
                        result.current.addToCart(createProduct('p1', tc.price), true);
                    }
                });
                expect(result.current.vat).toBe(tc.expectedVat);
            });
        });
    });

    // 10 cases for Change calculation
    describe('Change Calculations', () => {
        const changeCases = [
            { total: 100, received: 150, expectedChange: 50 },
            { total: 100, received: 100, expectedChange: 0 },
            { total: 100, received: 50, expectedChange: 0 },
            { total: 100, received: 100, expectedChange: 0 },
            { total: 0, received: 10, expectedChange: 10 },
            { total: 120, received: 150, expectedChange: 30 },
            { total: 10, received: 20, expectedChange: 10 },
            { total: 5, received: 6, expectedChange: 1 },
            { total: 1000, received: 2000, expectedChange: 1000 },
            { total: 2, received: 5, expectedChange: 3 },
        ];

        changeCases.forEach((tc, i) => {
            it(`should calculate change correctly - Case ${i + 1}`, () => {
                const { result } = renderHook(() => useCart({ taxRate: 0 }));
                act(() => {
                    if (tc.total > 0) {
                        result.current.addToCart(createProduct('p1', tc.total), true);
                    }
                    result.current.setReceivedAmount(tc.received);
                });
                
                const expected = tc.received >= tc.total ? tc.received - tc.total : 0;
                expect(result.current.change).toBe(expected);
            });
        });
    });

    // 13 logic mutation tests
    describe('Logic Mutations & Edge Cases', () => {
        it('removes item when quantity set to 0 or negative', () => {
            const { result } = renderHook(() => useCart());
            act(() => {
                result.current.addToCart(createProduct('p1', 10), true);
                result.current.setItemQuantity('p1', -5);
            });
            expect(result.current.cart).toHaveLength(0);
        });

        it('discounts cannot exceed subtotal', () => {
            const { result } = renderHook(() => useCart());
            act(() => {
                result.current.addToCart(createProduct('p1', 100), true);
                result.current.setDiscount(150);
            });
            expect(result.current.total).toBeGreaterThanOrEqual(0);
        });

        it('clearCart resets all values', () => {
            const { result } = renderHook(() => useCart());
            act(() => {
                result.current.addToCart(createProduct('p1', 100), true);
                result.current.setDiscount(10);
                result.current.setReceivedAmount(200);
                result.current.clearCart();
            });
            expect(result.current.cart).toHaveLength(0);
            expect(result.current.discount).toBe(0);
            expect(result.current.receivedAmount).toBe(0);
            expect(result.current.total).toBe(0);
        });

        for (let i = 0; i < 10; i++) {
            it(`state toggle test - iteration ${i}`, () => {
                const { result } = renderHook(() => useCart());
                act(() => {
                    result.current.setIsZenMode(i % 2 === 0);
                });
                expect(result.current.isZenMode).toBe(i % 2 === 0);
            });
        }
    });
});
