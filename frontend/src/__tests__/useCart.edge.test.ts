import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCart } from '../features/pos/hooks/useCart';
import { Product, Customer } from '../core/types';

// Mock playBeep and formatCurrency from core/utils
vi.mock('../core/utils', async () => {
    const actual = await vi.importActual<typeof import('../core/utils')>('../core/utils');
    return {
        ...actual,
        playBeep: vi.fn(),
        formatCurrency: (val: number) => `${val}`,
    };
});

describe('useCart Hook - Deep Edge Conditions & State Mutations', () => {
    const mockProduct1: Product = {
        id: 'p_edge_1',
        name: 'منتج تجريبي 1',
        price: 150,
        cost: 100,
        stock: 50,
        minStock: 5,
        wholesalePrice: 120,
        category: 'Electronics',
        barcode: '6281001',
        image: '',
    };

    const mockProduct2: Product = {
        id: 'p_edge_2',
        name: 'منتج تجريبي 2',
        price: 80,
        cost: 40,
        stock: 30,
        minStock: 2,
        wholesalePrice: 60,
        category: 'Accessories',
        barcode: '6281002',
        image: '',
    };

    const mockCustomer: Customer = {
        id: 'cust_edge_1',
        name: 'علي أحمد',
        phone: '07701234567',
        totalPurchases: 5000,
        debt: 1200,
        installmentDebt: 0,
        lastVisit: '2026-08-12',
        points: 150,
    };

    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    /**
     * Test 1: Adding duplicate product increments existing item quantity rather than duplicating cart row
     */
    it('test_addItem_duplicateProduct_mergesQuantity', () => {
        const { result } = renderHook(() => useCart());

        act(() => {
            result.current.addToCart(mockProduct1);
        });

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].id).toBe('p_edge_1');
        expect(result.current.cart[0].qty).toBe(1);
        expect(result.current.subtotal).toBe(150);

        // Add the same product a second time
        act(() => {
            result.current.addToCart(mockProduct1);
        });

        // Must still have exactly 1 cart row, but quantity is incremented to 2
        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].id).toBe('p_edge_1');
        expect(result.current.cart[0].qty).toBe(2);
        expect(result.current.subtotal).toBe(300);
        expect(result.current.total).toBe(300);
        expect(result.current.itemsCount).toBe(2);

        // Add a different product
        act(() => {
            result.current.addToCart(mockProduct2);
        });

        expect(result.current.cart).toHaveLength(2);
        expect(result.current.cart.find(i => i.id === 'p_edge_2')?.qty).toBe(1);
        expect(result.current.subtotal).toBe(380); // (150*2) + (80*1)
    });

    /**
     * Test 2: Removing the only item leaves cart cleanly empty with total = 0
     */
    it('test_removeItem_lastItem_emptyCart', () => {
        const { result } = renderHook(() => useCart());

        act(() => {
            result.current.addToCart(mockProduct1);
        });

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.total).toBe(150);

        act(() => {
            result.current.removeFromCart('p_edge_1');
        });

        expect(result.current.cart).toHaveLength(0);
        expect(result.current.cart).toEqual([]);
        expect(result.current.subtotal).toBe(0);
        expect(result.current.total).toBe(0);
        expect(result.current.itemsCount).toBe(0);
        expect(result.current.vat).toBe(0);
        expect(result.current.change).toBe(0);
    });

    /**
     * Test 3: Setting item quantity to 0 removes it from the cart
     */
    it('test_updateQuantity_toZero_removesItem', () => {
        const { result } = renderHook(() => useCart());

        act(() => {
            result.current.addToCart(mockProduct1);
            result.current.addToCart(mockProduct2);
        });

        expect(result.current.cart).toHaveLength(2);
        expect(result.current.subtotal).toBe(230); // 150 + 80

        // Setting quantity of mockProduct1 to 0 should remove it completely
        act(() => {
            result.current.setItemQuantity('p_edge_1', 0);
        });

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart.find(i => i.id === 'p_edge_1')).toBeUndefined();
        expect(result.current.cart[0].id).toBe('p_edge_2');
        expect(result.current.subtotal).toBe(80);
        expect(result.current.total).toBe(80);

        // Setting remaining item quantity to negative or 0 also removes it
        act(() => {
            result.current.setItemQuantity('p_edge_2', -1);
        });

        expect(result.current.cart).toHaveLength(0);
        expect(result.current.total).toBe(0);
    });

    /**
     * Test 4: Clearing cart resets items, customer, discount, paymentMethod, and totals to initial clean state
     */
    it('test_clearCart_resetsAllState', () => {
        const { result } = renderHook(() => useCart());

        // Mutate multiple facets of cart state
        act(() => {
            result.current.addToCart(mockProduct1);
            result.current.addToCart(mockProduct2);
            result.current.setSelectedCustomer(mockCustomer);
            result.current.setDiscount(50);
            result.current.setPaymentMethod('credit');
            result.current.setReceivedAmount(500);
        });

        expect(result.current.cart).toHaveLength(2);
        expect(result.current.selectedCustomer?.id).toBe('cust_edge_1');
        expect(result.current.discount).toBe(50);
        expect(result.current.paymentMethod).toBe('credit');
        expect(result.current.receivedAmount).toBe(500);
        expect(result.current.total).toBe(180); // (150 + 80) - 50

        // Clear cart
        act(() => {
            result.current.clearCart();
        });

        // Verify full reset to initial state
        expect(result.current.cart).toEqual([]);
        expect(result.current.selectedCustomer).toBeNull();
        expect(result.current.discount).toBe(0);
        expect(result.current.paymentMethod).toBe('cash');
        expect(result.current.receivedAmount).toBe(0);
        expect(result.current.subtotal).toBe(0);
        expect(result.current.total).toBe(0);
        expect(result.current.vat).toBe(0);
        expect(result.current.itemsCount).toBe(0);
    });

    /**
     * Test 5: Applying fixed discount larger than cart subtotal clamps discount to subtotal (total cannot be negative)
     */
    it('test_applyDiscount_exceedsTotal_clampedToTotal', () => {
        const { result } = renderHook(() => useCart({ taxRate: 10 }));

        act(() => {
            result.current.addToCart(mockProduct1); // price = 150
        });

        expect(result.current.subtotal).toBe(150);

        // Apply discount of 300 on a 150 subtotal (discount > subtotal)
        act(() => {
            result.current.setDiscount(300);
        });

        // Total cannot be negative; effective taxable total is clamped to 0
        expect(result.current.discount).toBe(300);
        expect(result.current.subtotal).toBe(150);
        expect(result.current.vat).toBe(0);
        expect(result.current.total).toBe(0);
        expect(result.current.total >= 0).toBe(true);

        // Even with receivedAmount, change calculation remains sound
        act(() => {
            result.current.setReceivedAmount(50);
        });
        expect(result.current.change).toBe(50); // 50 - 0 = 50

        // Reset discount back to reasonable value
        act(() => {
            result.current.setDiscount(50);
        });
        // Subtotal = 150, discount = 50 -> taxable = 100, tax (10%) = 10 -> total = 110
        expect(result.current.subtotal).toBe(150);
        expect(result.current.vat).toBe(10);
        expect(result.current.total).toBe(110);
    });
});
