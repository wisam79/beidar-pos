import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SplitPaymentModal } from '../features/pos/components/SplitPaymentModal';
import { ProductCard } from '../components/ProductCard';
import { Product } from '../core/api';

const mockProduct: Product = {
    id: 'prod-split-test',
    name: 'شاحن ايفون 20 واط',
    price: 25000,
    cost: 18000,
    stock: 15,
    minStock: 5,
    wholesalePrice: 22000,
    category: 'Accessories',
    barcode: '628100998877',
    image: '',
};

describe('UI Split Payment & Product Card Component Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── SplitPaymentModal Tests ─────────────────────────────────────────────
    it('21. should render SplitPaymentModal title and invoice grand total', () => {
        render(
            <SplitPaymentModal
                total={100000}
                currency="IQD"
                onClose={vi.fn()}
                onConfirm={vi.fn()}
            />
        );

        expect(screen.getByText('دفع مجزأ (Split Payment)')).toBeInTheDocument();
        expect(screen.getByText('إجمالي المبلغ')).toBeInTheDocument();
        expect(screen.getAllByText('100,000').length).toBeGreaterThan(0);
    });

    it('22. should compute complementary card amount when cash slider is adjusted', () => {
        render(
            <SplitPaymentModal
                total={100000}
                currency="IQD"
                onClose={vi.fn()}
                onConfirm={vi.fn()}
            />
        );

        const sliders = screen.getAllByRole('slider');
        const cashSlider = sliders[0];

        // Change cash slider to 40,000
        fireEvent.change(cashSlider, { target: { value: '40000' } });

        // Cash should be 40,000, Card should be 60,000
        expect(screen.getByText('40,000 IQD')).toBeInTheDocument();
        expect(screen.getByText('60,000 IQD')).toBeInTheDocument();
    });

    it('23. should call onConfirm with exact cash and card breakdown', () => {
        const mockConfirm = vi.fn();
        render(
            <SplitPaymentModal
                total={80000}
                currency="IQD"
                onClose={vi.fn()}
                onConfirm={mockConfirm}
            />
        );

        const sliders = screen.getAllByRole('slider');
        fireEvent.change(sliders[0], { target: { value: '50000' } });

        const confirmBtn = screen.getByRole('button', { name: /تأكيد الدفع/ });
        fireEvent.click(confirmBtn);

        expect(mockConfirm).toHaveBeenCalledWith(50000, 30000);
    });

    // ── ProductCard Tests ───────────────────────────────────────────────────
    it('24. should render product name, stock badge, and formatted price', () => {
        const mockClick = vi.fn();
        render(
            <ProductCard
                product={mockProduct}
                onClick={mockClick}
                currency="IQD"
            />
        );

        expect(screen.getByText('شاحن ايفون 20 واط')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
        expect(screen.getByText('25,000')).toBeInTheDocument();
    });

    it('25. should display "نفذت" out-of-stock badge when stock is 0', () => {
        const outProduct: Product = { ...mockProduct, stock: 0 };
        render(
            <ProductCard
                product={outProduct}
                onClick={vi.fn()}
            />
        );

        expect(screen.getByText(/نفذت/)).toBeInTheDocument();
    });

    it('26. should display low stock styling when stock is <= minStock', () => {
        const lowProduct: Product = { ...mockProduct, stock: 3, minStock: 5 };
        const { container } = render(
            <ProductCard
                product={lowProduct}
                onClick={vi.fn()}
            />
        );

        // Warning badge text/indicator
        expect(screen.getByText('3')).toBeInTheDocument();
        const badge = container.querySelector('.bg-warning\\/15');
        expect(badge).toBeInTheDocument();
    });

    it('27. should display wholesale badge and wholesale price when isWholesale=true', () => {
        render(
            <ProductCard
                product={mockProduct}
                onClick={vi.fn()}
                isWholesale={true}
                currency="IQD"
            />
        );

        expect(screen.getByText('سعر الجملة')).toBeInTheDocument();
        expect(screen.getByText('22,000')).toBeInTheDocument();
    });

    it('28. should trigger onClick with product object when clicked', () => {
        const mockClick = vi.fn();
        render(
            <ProductCard
                product={mockProduct}
                onClick={mockClick}
            />
        );

        const cardBtn = screen.getByRole('button', { name: /شاحن ايفون 20 واط/ });
        fireEvent.click(cardBtn);

        expect(mockClick).toHaveBeenCalledWith(mockProduct);
    });

    it('29. should show isJustAdded check overlay animation', () => {
        const { container } = render(
            <ProductCard
                product={mockProduct}
                onClick={vi.fn()}
                isJustAdded={true}
            />
        );

        const overlay = container.querySelector('.bg-success\\/20');
        expect(overlay).toBeInTheDocument();
    });

    it('30. should trigger onPrint callback when print icon is clicked', () => {
        const mockPrint = vi.fn();
        render(
            <ProductCard
                product={mockProduct}
                onClick={vi.fn()}
                onPrint={mockPrint}
            />
        );

        const printBtn = screen.getByTitle('طباعة');
        fireEvent.click(printBtn);

        expect(mockPrint).toHaveBeenCalledTimes(1);
    });
});
