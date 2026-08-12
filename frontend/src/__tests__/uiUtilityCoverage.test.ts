import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCents } from '../core/utils';

describe('UI & Utility Formatters Coverage (20 Tests)', () => {
    // 1. formatCurrency Suite (10 tests)
    describe('formatCurrency (10 Tests)', () => {
        const testCases = [
            { amount: 1000, currency: 'IQD', expected: '1,000 IQD' },
            { amount: 1500.5, currency: 'IQD', expected: '1,500.5 IQD' },
            { amount: 0, currency: 'IQD', expected: '0 IQD' },
            { amount: -500, currency: 'IQD', expected: '-500 IQD' },
            { amount: 1000000, currency: 'IQD', expected: '1,000,000 IQD' },
            { amount: 25.5, currency: 'USD', expected: '25.5 USD' },
            { amount: 100, currency: 'USD', expected: '100 USD' },
            { amount: 0.05, currency: 'USD', expected: '0.05 USD' },
            { amount: 9999.99, currency: 'USD', expected: '9,999.99 USD' },
            { amount: -12.34, currency: 'USD', expected: '-12.34 USD' },
        ];

        testCases.forEach((tc, i) => {
            it(`formatCurrency Case ${i + 1}: ${tc.amount} ${tc.currency}`, () => {
                const formatted = formatCurrency(tc.amount, tc.currency);
                expect(formatted).toBe(tc.expected);
            });
        });
    });

    // 2. formatCents Suite (10 tests)
    describe('formatCents (10 Tests)', () => {
        const parseCases = [
            { cents: 1000, currency: 'IQD', expected: '10.00 IQD' },
            { cents: 150050, currency: 'IQD', expected: '1,500.50 IQD' },
            { cents: 5000, currency: 'USD', expected: '50.00 USD' },
            { cents: 100000000, currency: 'IQD', expected: '1,000,000.00 IQD' },
            { cents: 2575, currency: 'USD', expected: '25.75 USD' },
            { cents: -10000, currency: 'IQD', expected: '-100.00 IQD' },
            { cents: 0, currency: 'IQD', expected: '0.00 IQD' },
            { cents: 5, currency: 'USD', expected: '0.05 USD' },
            { cents: 1, currency: 'IQD', expected: '0.01 IQD' },
            { cents: 999999, currency: 'USD', expected: '9,999.99 USD' },
        ];

        parseCases.forEach((tc, i) => {
            it(`formatCents Case ${i + 1}: ${tc.cents} cents`, () => {
                const result = formatCents(tc.cents, tc.currency);
                expect(result).toBe(tc.expected);
            });
        });
    });
});
