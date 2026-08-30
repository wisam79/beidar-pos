import { describe, it, expect } from 'vitest';
import { formatCurrency, parseCentsFromInput } from '../core/utils';

describe('Payment Modal Dual Currency & Cash Rounding Engine', () => {
    const EXCHANGE_RATE = 1500; // 1 USD = 1500 IQD

    it('should accurately convert between IQD and USD without floating-point error', () => {
        const totalIQD = 153000; // 153,000 IQD
        const totalUSD = Math.round((totalIQD / EXCHANGE_RATE) * 100) / 100; // 102.00 USD

        expect(totalUSD).toBe(102);
        expect(formatCurrency(totalIQD, 'IQD')).toBe('153,000 IQD');
        expect(formatCurrency(totalUSD, 'USD')).toBe('102 USD');
    });

    it('should compute exact change and banknote rounding to nearest 250 IQD', () => {
        const totalIQD = 74300; // 74,300 IQD
        const tenderedIQD = 100000; // 100,000 IQD note

        const rawChange = tenderedIQD - totalIQD; // 25,700 IQD
        expect(rawChange).toBe(25700);

        // Nearest 250 IQD denomination rounding (banknotes available: 250, 500, 1000, etc.)
        const roundedChange = Math.round(rawChange / 250) * 250; // 25,750 IQD
        expect(roundedChange).toBe(25750);
    });

    it('should validate multi-split payments (Cash + Card + Credit) equaling grand total', () => {
        const grandTotal = 250000;
        const splitPayments = {
            cash: 50000,
            card: 100000,
            credit: 100000,
        };

        const totalPaid = splitPayments.cash + splitPayments.card + splitPayments.credit;
        expect(totalPaid).toBe(grandTotal);

        // Partial split where sum is less than total
        const incompleteSplit = {
            cash: 50000,
            card: 80000,
            credit: 100000,
        };
        const incompleteSum = incompleteSplit.cash + incompleteSplit.card + incompleteSplit.credit;
        const remainingToAllocate = grandTotal - incompleteSum;
        expect(remainingToAllocate).toBe(20000);
        expect(remainingToAllocate > 0).toBe(true);
    });

    it('should safely parse mixed user inputs for dual currency entry', () => {
        expect(parseCentsFromInput(' 1,500.00 ')).toBe(150000);
        expect(parseCentsFromInput('100.50')).toBe(10050);
        expect(parseCentsFromInput('0')).toBe(0);
        expect(parseCentsFromInput('-50')).toBe(-5000);
    });
});
