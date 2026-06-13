import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCart } from '../hooks/useCart';
import { Product } from '../core/types';

// Mock playBeep
vi.mock('../core/utils', () => ({
    playBeep: vi.fn(),
    formatCurrency: (val: number) => `${val}`,
}));

// Mock LocalStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString(); },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useCart Hook', () => {
    const mockProduct: Product = {
        id: 'p1',
        name: 'Test Product',
        price: 100,
        cost: 50,
        stock: 10,
        minStock: 5,
        wholesalePrice: 80,
        category: 'Test',
        barcode: '123',
        image: ''
    };

    const mockProduct2: Product = {
        id: 'p2',
        name: 'Test Product 2',
        price: 200,
        cost: 100,
        stock: 5,
        minStock: 2,
        wholesalePrice: 160,
        category: 'Test',
        barcode: '456',
        image: ''
    };

    beforeEach(() => {
        window.localStorage.clear();
        vi.clearAllMocks();
    });

    it('should initialize with empty cart', () => {
        const { result } = renderHook(() => useCart());
        expect(result.current.cart).toEqual([]);
        expect(result.current.total).toBe(0);
        expect(result.current.itemsCount).toBe(0);
    });

    it('should add product to cart', () => {
        const { result } = renderHook(() => useCart());

        act(() => {
            result.current.addToCart(mockProduct);
        });

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].id).toBe('p1');
        expect(result.current.cart[0].qty).toBe(1);
        expect(result.current.total).toBe(100);
    });

    it('should increment quantity if product exists', () => {
        const { result } = renderHook(() => useCart());

        act(() => {
            result.current.addToCart(mockProduct);
        });

        act(() => {
            result.current.addToCart(mockProduct);
        });

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].qty).toBe(2);
        expect(result.current.total).toBe(200);
    });

    it('should update quantity manually', () => {
        const { result } = renderHook(() => useCart());

        act(() => {
            result.current.addToCart(mockProduct);
        });

        act(() => {
            result.current.updateQty('p1', 4); // +4 -> 5
        });

        expect(result.current.cart[0].qty).toBe(5);
        expect(result.current.total).toBe(500);

        act(() => {
            result.current.updateQty('p1', -2); // -2 -> 3
        });

        expect(result.current.cart[0].qty).toBe(3);
    });

    it('should not allow zero or negative quantity via updateQty', () => {
        const { result } = renderHook(() => useCart());

        act(() => {
            result.current.addToCart(mockProduct);
        });

        act(() => {
            result.current.updateQty('p1', -10); // Should stay at minimum (0.01)
        });

        expect(result.current.cart[0].qty).toBe(0.01); // Minimum qty for fractional support
    });

    it('should remove item from cart', () => {
        const { result } = renderHook(() => useCart());

        act(() => {
            result.current.addToCart(mockProduct);
            result.current.addToCart(mockProduct2);
        });

        expect(result.current.cart).toHaveLength(2);

        act(() => {
            result.current.removeFromCart('p1');
        });

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].id).toBe('p2');
    });

    it('should clear cart', () => {
        const { result } = renderHook(() => useCart());

        act(() => {
            result.current.addToCart(mockProduct);
            result.current.setDiscount(50);
        });

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.discount).toBe(50);

        act(() => {
            result.current.clearCart();
        });

        expect(result.current.cart).toEqual([]);
        expect(result.current.discount).toBe(0);
        expect(result.current.total).toBe(0);
    });

    it('should calculate totals correctly with discount', () => {
        const { result } = renderHook(() => useCart());

        act(() => {
            result.current.addToCart(mockProduct); // 100
            result.current.addToCart(mockProduct2); // 200
        });

        expect(result.current.subtotal).toBe(300);

        act(() => {
            result.current.setDiscount(50);
        });

        expect(result.current.total).toBe(250);
    });

    it('should persist cart to localStorage', () => {
        const { result } = renderHook(() => useCart());

        act(() => {
            result.current.addToCart(mockProduct);
        });

        // Check storage
        const stored = window.localStorage.getItem('beidar_pos_cart');
        expect(stored).toBeTruthy();
        expect(JSON.parse(stored!)[0].id).toBe('p1');
    });

    // Note: Testing "Load from storage" is tricky with renderHook because it usually clears or mocks are reset.
    // Ideally we would set localStorage BEFORE calling renderHook.
    it('should restore cart from localStorage on mount', () => {
        // Setup storage
        window.localStorage.setItem('beidar_pos_cart', JSON.stringify([{ ...mockProduct, qty: 3, itemDiscount: 0 }]));

        const { result } = renderHook(() => useCart());

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].qty).toBe(3);
        expect(result.current.total).toBe(300);
    });
});
