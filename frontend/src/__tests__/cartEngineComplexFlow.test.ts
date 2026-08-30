import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCart } from '../features/pos/hooks/useCart';
import { Product, Customer } from '../core/types';

const mockProduct = (id: string, price: number, name: string): Product => ({
    id,
    name,
    barcode: `BC-${id}`,
    price,
    cost: price * 0.7,
    stock: 50,
    minStock: 5,
    wholesalePrice: price * 0.85,
    category: 'Electronics',
    image: '',
});

const mockCustomer: Customer = {
    id: 'cust-complex-1',
    name: 'عميل مميز',
    phone: '07701122334',
    debt: 0,
    installmentDebt: 0,
    totalPurchases: 100000,
    lastVisit: '2026-08-30',
    points: 250,
};

describe('Cart Engine Complex Integration Flow', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should calculate complex multi-product subtotal, item discounts, cart discounts, tax and change with cent precision', () => {
        const { result } = renderHook(() => useCart({ taxRate: 15 }));

        const p1 = mockProduct('p1', 50000, 'سماعة رأس');
        const p2 = mockProduct('p2', 30000, 'ماوس لاسلكي');
        const p3 = mockProduct('p3', 20000, 'كابل تايب سي');

        // Add products
        act(() => {
            result.current.addToCart(p1, true); // 1 unit @ 50,000
            result.current.addToCart(p2, true); // 1 unit @ 30,000
            result.current.addToCart(p3, true); // 1 unit @ 20,000
        });

        expect(result.current.itemsCount).toBe(3);
        expect(result.current.subtotal).toBe(100000);

        // Update quantity of p2 to 2 units
        act(() => {
            result.current.updateQty(p2.id, 1);
        });

        // Subtotal = 50,000 + 2*30,000 + 20,000 = 130,000
        expect(result.current.subtotal).toBe(130000);
        expect(result.current.itemsCount).toBe(4);

        // Apply cart discount: 10,000
        act(() => {
            result.current.setDiscount(10000);
        });

        // Taxable total = 130,000 - 10,000 = 120,000
        // VAT @ 15% = 120,000 * 0.15 = 18,000
        // Total = 120,000 + 18,000 = 138,000
        expect(result.current.vat).toBe(18000);
        expect(result.current.total).toBe(138000);

        // Set received amount: 150,000 -> Change = 150,000 - 138,000 = 12,000
        act(() => {
            result.current.setReceivedAmount(150000);
        });
        expect(result.current.change).toBe(12000);

        // Select Customer
        act(() => {
            result.current.setSelectedCustomer(mockCustomer);
        });
        expect(result.current.selectedCustomer?.name).toBe('عميل مميز');

        // Discount cap check: discount exceeding subtotal must clamp gracefully
        act(() => {
            result.current.setDiscount(200000); // Exceeds 130,000
        });
        // Taxable total clamped to 0, VAT 0, total 0
        expect(result.current.vat).toBe(0);
        expect(result.current.total).toBe(0);
        expect(result.current.change).toBe(150000);
    });

    it('should remove item when quantity is decremented below 1', () => {
        const { result } = renderHook(() => useCart());
        const p1 = mockProduct('p-remove', 15000, 'عنصر الحذف');

        act(() => {
            result.current.addToCart(p1, true);
        });
        expect(result.current.cart.length).toBe(1);

        act(() => {
            result.current.updateQty(p1.id, -1);
        });
        expect(result.current.cart.length).toBe(0);
        expect(result.current.subtotal).toBe(0);
    });
});
