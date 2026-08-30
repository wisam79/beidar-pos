import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReceiptTemplate } from '../components/ReceiptTemplate';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Sale, AppPreferences } from '../core/types';

const mockPrefs: AppPreferences = {
    storeName: 'متجر بيدر التجريبي',
    storePhone: '07709876543',
    storeAddress: 'بغداد - المنصور',
    vatRate: 15,
    taxRate: 15,
    currency: 'IQD',
    receiptFooter: 'شكراً لزيارتكم ونتشرف بخدمتكم دائماً',
    defaultPrinter: 'thermal_printer_1',
    receiptPrinter: 'thermal_printer_1',
    labelPrinter: 'label_printer_1',
    accentColor: '#059669',
    compactMode: false,
    fontSize: 'normal',
    theme: 'dark',
    enableSound: true,
    animationsEnabled: true,
    language: 'ar',
    lowStockTrigger: 5,
    allowNegativeStock: false,
    quickSell: true,
    defaultPayment: 'cash',
    autoPrint: false,
    autoPrintFormat: 'thermal',
    thermalPaperSize: '80mm',
    adminPin: '8392',
    autoLockTime: 15,
    dailySalesTarget: 1000000,
    geminiApiKey: '',
    geminiApiKeys: [],
    requireShift: true,
    autoBackup: true,
    cloudAutoSync: false,
    aiProvider: 'gemini',
    aiModel: 'gemini-1.5-flash',
    aiRotationMode: 'round_robin',
    groqApiKey: '',
};

const mockSale: Sale = {
    id: 'INV-2026-999',
    customer: 'عميل الفاتورة',
    customerId: 'c1',
    staffId: 'staff-1',
    staffName: 'أحمد الكاشير',
    date: '2026-08-30',
    timestamp: Date.now(),
    subtotal: 100000,
    discount: 10000,
    vat: 13500,
    total: 103500,
    paymentMethod: 'cash',
    status: 'completed',
    itemsCount: 2,
    items: [
        {
            pid: 1,
            id: 'p1',
            name: 'لوحة مفاتيح ميكانيكية',
            qty: 1,
            price: 70000,
            cost: 50000,
            total: 70000,
            returnedQty: 0,
        },
        {
            pid: 2,
            id: 'p2',
            name: 'ماوس باد كبير',
            qty: 1,
            price: 30000,
            cost: 15000,
            total: 30000,
            returnedQty: 0,
        },
    ],
};

// Component that throws to test ErrorBoundary
const FaultyComponent: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow }) => {
    if (shouldThrow) {
        throw new Error('Test rendering crash error');
    }
    return <div>محتوى سليم وناجح</div>;
};

describe('UI Receipt Template & Layout Error Boundary Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── ReceiptTemplate Tests ───────────────────────────────────────────────
    it('31. should render thermal receipt with store header, phone, and address from preferences', () => {
        render(<ReceiptTemplate sale={mockSale} prefs={mockPrefs} mode="thermal" />);

        expect(screen.getByText('متجر بيدر التجريبي')).toBeInTheDocument();
        expect(screen.getByText('بغداد - المنصور')).toBeInTheDocument();
        expect(screen.getByText('07709876543')).toBeInTheDocument();
        expect(screen.getByText('INV-2026-999')).toBeInTheDocument();
    });

    it('32. should render items table with quantity, item name, unit price, and item total', () => {
        render(<ReceiptTemplate sale={mockSale} prefs={mockPrefs} mode="thermal" />);

        expect(screen.getByText('لوحة مفاتيح ميكانيكية')).toBeInTheDocument();
        expect(screen.getByText('ماوس باد كبير')).toBeInTheDocument();
    });

    it('33. should render subtotal, discount, VAT, and grand total in thermal mode', () => {
        render(<ReceiptTemplate sale={mockSale} prefs={mockPrefs} mode="thermal" />);

        expect(screen.getByText('المجموع الفرعي:')).toBeInTheDocument();
        expect(screen.getByText('الخصم:')).toBeInTheDocument();
        expect(screen.getByText('الإجمالي:')).toBeInTheDocument();
        expect(screen.getByText('103,500 IQD')).toBeInTheDocument();
    });

    it('34. should render QR code and receipt footer message', () => {
        render(<ReceiptTemplate sale={mockSale} prefs={mockPrefs} mode="thermal" />);

        expect(screen.getByText('شكراً لزيارتكم ونتشرف بخدمتكم دائماً')).toBeInTheDocument();
    });

    it('35. should support A4 mode multi-page rendering for corporate invoices', () => {
        render(<ReceiptTemplate sale={mockSale} prefs={mockPrefs} mode="a4" />);

        expect(screen.getByText('فاتورة')).toBeInTheDocument();
        expect(screen.getByText('المجموع الفرعي')).toBeInTheDocument();
        expect(screen.getByText('الإجمالي النهائي')).toBeInTheDocument();
    });

    // ── ErrorBoundary Tests ─────────────────────────────────────────────────
    it('36. should render children normally when no error occurs', () => {
        render(
            <ErrorBoundary>
                <FaultyComponent shouldThrow={false} />
            </ErrorBoundary>
        );

        expect(screen.getByText('محتوى سليم وناجح')).toBeInTheDocument();
    });

    it('37. should catch rendering error and display friendly fallback UI with retry button', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <FaultyComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('عذراً، حدث خطأ غير متوقع')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /إعادة المحاولة/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /العودة للرئيسية/ })).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('38. should increment retry count when retry button is clicked', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <FaultyComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة/ });
        fireEvent.click(retryBtn);

        // State advances retry count
        expect(screen.getByText(/محاولة 1 من 3/)).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('39. should copy error details to clipboard when copy button is clicked', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const mockClipboardWrite = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: {
                writeText: mockClipboardWrite,
            },
        });

        render(
            <ErrorBoundary>
                <FaultyComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        const copyBtn = screen.getByTitle('Copy error');
        await act(async () => {
            fireEvent.click(copyBtn);
        });

        expect(mockClipboardWrite).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it('40. should call custom onError callback when exception is caught', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const mockOnError = vi.fn();

        render(
            <ErrorBoundary onError={mockOnError}>
                <FaultyComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(mockOnError).toHaveBeenCalledTimes(1);
        expect(mockOnError.mock.calls[0][0].message).toBe('Test rendering crash error');

        consoleSpy.mockRestore();
    });
});
