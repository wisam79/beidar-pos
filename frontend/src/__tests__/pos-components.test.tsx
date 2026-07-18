import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CartItemRow, CartItem } from '../features/pos/components/CartItemRow';
import { ProductCard } from '../components/ProductCard';
import { Product } from '../core/types';

describe('CartItemRow Component', () => {
    const mockItem: CartItem = {
        id: 'p1',
        name: 'شاي لبتون',
        price: 5000,
        cost: 3500,
        stock: 20,
        minStock: 5,
        wholesalePrice: 4800,
        category: 'Drinks',
        barcode: '6281006112345',
        image: '',
        qty: 3,
        itemDiscount: 500,
    };

    const mockUpdateQty = vi.fn();
    const mockRemove = vi.fn();
    const mockEdit = vi.fn();
    const mockQtyClick = vi.fn();

    it('should render cart item details correctly', () => {
        render(
            <CartItemRow
                item={mockItem}
                onUpdateQty={mockUpdateQty}
                onRemove={mockRemove}
                onEdit={mockEdit}
                onQtyClick={mockQtyClick}
                currency="IQD"
            />
        );

        expect(screen.getByText('شاي لبتون')).toBeInTheDocument();
        expect(screen.getByText('5,000 IQD')).toBeInTheDocument();
        expect(screen.getByText('خصم -500')).toBeInTheDocument();
        expect(screen.getByText('6281006112345')).toBeInTheDocument();
        // qty: 3
        expect(screen.getByText('3')).toBeInTheDocument();
        // total: 5000 * 3 - 500 = 14500
        expect(screen.getByText('14,500')).toBeInTheDocument();
    });

    it('should trigger onEdit when clicking the row', () => {
        render(
            <CartItemRow
                item={mockItem}
                onUpdateQty={mockUpdateQty}
                onRemove={mockRemove}
                onEdit={mockEdit}
                onQtyClick={mockQtyClick}
            />
        );

        fireEvent.click(screen.getByText('شاي لبتون'));
        expect(mockEdit).toHaveBeenCalledWith(mockItem);
    });

    it('should trigger onQtyClick when clicking the quantity badge', () => {
        render(
            <CartItemRow
                item={mockItem}
                onUpdateQty={mockUpdateQty}
                onRemove={mockRemove}
                onEdit={mockEdit}
                onQtyClick={mockQtyClick}
            />
        );

        fireEvent.click(screen.getByText('3'));
        expect(mockQtyClick).toHaveBeenCalledWith(mockItem);
    });

    it('should trigger onUpdateQty with correct delta on Plus click', () => {
        render(
            <CartItemRow
                item={mockItem}
                onUpdateQty={mockUpdateQty}
                onRemove={mockRemove}
                onEdit={mockEdit}
            />
        );

        const plusButton = screen.getByTitle('زيادة 1');
        fireEvent.click(plusButton);
        expect(mockUpdateQty).toHaveBeenCalledWith('p1', 1);
    });

    it('should trigger onUpdateQty with correct delta on Minus click', () => {
        render(
            <CartItemRow
                item={mockItem}
                onUpdateQty={mockUpdateQty}
                onRemove={mockRemove}
                onEdit={mockEdit}
            />
        );

        const minusButton = screen.getByTitle('إنقاص 1');
        fireEvent.click(minusButton);
        expect(mockUpdateQty).toHaveBeenCalledWith('p1', -1);
    });

    it('should trigger onRemove when clicking delete button', () => {
        render(
            <CartItemRow
                item={mockItem}
                onUpdateQty={mockUpdateQty}
                onRemove={mockRemove}
                onEdit={mockEdit}
            />
        );

        const deleteButton = screen.getByTitle('حذف');
        fireEvent.click(deleteButton);
        expect(mockRemove).toHaveBeenCalledWith('p1');
    });
});

describe('ProductCard Component', () => {
    const mockProduct: Product = {
        id: 'p1',
        name: 'نسكافيه 3 في 1',
        price: 3000,
        cost: 2000,
        stock: 15,
        minStock: 5,
        wholesalePrice: 2800,
        category: 'Drinks',
        barcode: '11223344',
        image: '',
    };

    const mockClick = vi.fn();
    const mockPrint = vi.fn();

    it('should render product details correctly', () => {
        render(
            <ProductCard
                product={mockProduct}
                onClick={mockClick}
                currency="IQD"
            />
        );

        expect(screen.getByText('نسكافيه 3 في 1')).toBeInTheDocument();
        expect(screen.getByText('3,000')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should trigger onClick when clicked', () => {
        render(
            <ProductCard
                product={mockProduct}
                onClick={mockClick}
            />
        );

        fireEvent.click(screen.getByText('نسكافيه 3 في 1'));
        expect(mockClick).toHaveBeenCalledWith(mockProduct);
    });

    it('should render out of stock status if stock is 0', () => {
        const outOfStockProduct = { ...mockProduct, stock: 0 };
        render(
            <ProductCard
                product={outOfStockProduct}
                onClick={mockClick}
            />
        );

        expect(screen.getByText('نفذت')).toBeInTheDocument();
        const button = screen.getByRole('button', { name: /نفذت/i });
        expect(button.className).toContain('grayscale');
    });

    it('should render warning sign if stock is low', () => {
        const lowStockProduct = { ...mockProduct, stock: 3 }; // minStock is 5
        const { container } = render(
            <ProductCard
                product={lowStockProduct}
                onClick={mockClick}
            />
        );

        expect(screen.getByText('3')).toBeInTheDocument();
        const statusSpan = container.querySelector('.bg-warning\\/15');
        expect(statusSpan).toBeInTheDocument();
    });

    it('should render wholesale price and label when isWholesale is true', () => {
        render(
            <ProductCard
                product={mockProduct}
                onClick={mockClick}
                isWholesale={true}
                currency="IQD"
            />
        );

        expect(screen.getByText('2,800')).toBeInTheDocument();
        expect(screen.getByText('سعر الجملة')).toBeInTheDocument();
    });

    it('should render check overlay when isJustAdded is true', () => {
        const { container } = render(
            <ProductCard
                product={mockProduct}
                onClick={mockClick}
                isJustAdded={true}
            />
        );

        const checkOverlay = container.querySelector('.bg-primary\\/10');
        expect(checkOverlay).toBeInTheDocument();
    });

    it('should show print button and trigger onPrint', () => {
        render(
            <ProductCard
                product={mockProduct}
                onClick={mockClick}
                onPrint={mockPrint}
            />
        );

        const printButton = screen.getByTitle('طباعة');
        expect(printButton).toBeInTheDocument();
        fireEvent.click(printButton);
        expect(mockPrint).toHaveBeenCalled();
    });
});
