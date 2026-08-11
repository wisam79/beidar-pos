import { describe, it, expect } from 'vitest';
import {
    formatCurrency,
    formatCents,
    calculateCartTotal,
    calculateDiscount,
    parseCentsFromInput,
} from '../core/utils';

describe('Financial & Money Utilities (Zero Floating-Point Drift Protocol)', () => {
    /**
     * Test 1: Formatting integer cent values from backend into standard display currency
     */
    it('test_formatCurrency_withCentsValues', () => {
        // Backend stores money as int64 cents (e.g. 1250 cents = 12.50)
        expect(formatCents(1250, 'IQD')).toBe('12.50 IQD');
        expect(formatCents(1250, 'USD')).toBe('12.50 USD');
        expect(formatCents(100, 'USD')).toBe('1.00 USD');
        expect(formatCents(5, 'USD')).toBe('0.05 USD');
        expect(formatCents(0, 'IQD')).toBe('0.00 IQD');
        expect(formatCents(10000000, 'IQD')).toBe('100,000.00 IQD');

        // Standard formatCurrency helper with unit amount
        expect(formatCurrency(12.5, 'IQD')).toContain('12.5');
        expect(formatCurrency(1500, 'IQD')).toBe('1,500 IQD');
        expect(formatCurrency(0, 'USD')).toBe('0 USD');
    });

    /**
     * Test 2: Negative amounts formatted clearly with minus sign
     */
    it('test_formatCurrency_negativeAmounts', () => {
        // Negative cents values
        expect(formatCents(-500, 'IQD')).toBe('-5.00 IQD');
        expect(formatCents(-1250, 'USD')).toBe('-12.50 USD');
        expect(formatCents(-1000000, 'IQD')).toBe('-10,000.00 IQD');
        expect(formatCents(-1, 'USD')).toBe('-0.01 USD');

        // Standard formatCurrency helper with negative amount
        expect(formatCurrency(-500, 'IQD')).toBe('-500 IQD');
        expect(formatCurrency(-1250.75, 'USD')).toBe('-1,250.75 USD');
    });

    /**
     * Test 3: Summing 20 items with fractional float cents using integer/cents math to prevent floating point drift
     */
    it('test_calculateCartTotal_noFloatingPointDrift', () => {
        // Naive float operations in JavaScript cause IEEE 754 precision drift:
        // 0.1 + 0.2 in raw JS equals 0.30000000000000004 (not 0.3)
        // 1.1 + 2.2 in raw JS equals 3.3000000000000003 (not 3.3)
        const naiveSum = 0.1 + 0.2;
        expect(naiveSum).not.toBe(0.3);
        expect(naiveSum.toString()).toBe('0.30000000000000004');

        const naiveSum2 = 1.1 + 2.2;
        expect(naiveSum2).not.toBe(3.3);
        expect(naiveSum2.toString()).toBe('3.3000000000000003');

        // calculateCartTotal uses integer/cents arithmetic to eliminate drift
        const sampleCart = [
            { price: 0.1, qty: 1 },
            { price: 0.2, qty: 1 },
        ];
        expect(calculateCartTotal(sampleCart)).toBe(0.3);

        const sampleCart2 = [
            { price: 1.1, qty: 1 },
            { price: 2.2, qty: 1 },
        ];
        expect(calculateCartTotal(sampleCart2)).toBe(3.3);

        // Test with 20 items with varied fractional prices and item discounts
        const twentyItems = [
            { price: 19.99, qty: 3 }, // 59.97
            { price: 0.1, qty: 7 }, // 0.70
            { price: 0.2, qty: 3 }, // 0.60
            { price: 4.95, qty: 2 }, // 9.90
            { price: 9.99, qty: 4 }, // 39.96
            { price: 1.15, qty: 5 }, // 5.75
            { price: 0.05, qty: 10 }, // 0.50
            { price: 33.33, qty: 3, itemDiscount: 1.0 }, // 99.99 - 1.00 = 98.99
            { price: 12.49, qty: 2 }, // 24.98
            { price: 7.85, qty: 1 }, // 7.85
            { price: 15.0, qty: 2 }, // 30.00
            { price: 2.25, qty: 4 }, // 9.00
            { price: 6.75, qty: 2 }, // 13.50
            { price: 0.99, qty: 6 }, // 5.94
            { price: 11.11, qty: 1 }, // 11.11
            { price: 8.45, qty: 2 }, // 16.90
            { price: 3.3, qty: 3 }, // 9.90
            { price: 14.2, qty: 2 }, // 28.40
            { price: 0.55, qty: 4 }, // 2.20
            { price: 25.5, qty: 1, itemDiscount: 0.5 }, // 25.50 - 0.50 = 25.00
        ];

        // Sum in cents: 40115 cents = 401.15
        const total = calculateCartTotal(twentyItems);
        expect(total).toBe(401.15);
        expect(Number.isInteger(Math.round(total * 100))).toBe(true);
    });

    /**
     * Test 4: 33.33% discount on amounts rounded correctly to whole cents
     */
    it('test_calculateDiscount_percentageWithRounding', () => {
        // 33.33% on 100.00 = 33.33
        expect(calculateDiscount(100, 33.33)).toBe(33.33);

        // 33.33% on 10.00 = 3.333 -> rounds to 3.33
        expect(calculateDiscount(10, 33.33)).toBe(3.33);

        // 15% discount on 15.55 = 2.3325 -> rounds to 2.33
        expect(calculateDiscount(15.55, 15)).toBe(2.33);

        // Half-up rounding edge cases
        // 1 cent (0.01) with 50% discount = 0.005 -> 0.01
        expect(calculateDiscount(0.01, 50)).toBe(0.01);

        // 3 cents (0.03) with 50% discount = 0.015 -> 0.02
        expect(calculateDiscount(0.03, 50)).toBe(0.02);

        // 0% and 100% boundary discounts
        expect(calculateDiscount(250.75, 0)).toBe(0);
        expect(calculateDiscount(250.75, 100)).toBe(250.75);
    });

    /**
     * Test 5: User input strings parsed safely into valid integer cents
     */
    it('test_parseCentsFromInput_edgeCases', () => {
        // Standard inputs
        expect(parseCentsFromInput('0')).toBe(0);
        expect(parseCentsFromInput('0.1')).toBe(10);
        expect(parseCentsFromInput('0.01')).toBe(1);
        expect(parseCentsFromInput('12.50')).toBe(1250);

        // Rounding fractional cent inputs
        expect(parseCentsFromInput('99.999')).toBe(10000);
        expect(parseCentsFromInput('99.994')).toBe(9999);

        // Empty and invalid inputs fallback safely to 0 cents
        expect(parseCentsFromInput('')).toBe(0);
        expect(parseCentsFromInput('   ')).toBe(0);
        expect(parseCentsFromInput('abc')).toBe(0);
        expect(parseCentsFromInput('$$$')).toBe(0);
        expect(parseCentsFromInput(null)).toBe(0);
        expect(parseCentsFromInput(undefined)).toBe(0);

        // Negative numbers and signed inputs
        expect(parseCentsFromInput('-5')).toBe(-500);
        expect(parseCentsFromInput('-0.50')).toBe(-50);

        // Inputs with thousand separators and whitespace
        expect(parseCentsFromInput(' 1,250.50 ')).toBe(125050);
        expect(parseCentsFromInput(25.75)).toBe(2575);
    });

    /**
     * Test 6: Extreme locale values, NaN, and Infinity formatting safety
     */
    it('test_FormatCurrency_Locales_RTL_NoNaN', () => {
        expect(formatCents(NaN, 'IQD')).toBe('0.00 IQD');
        expect(formatCents(Infinity, 'IQD')).toBe('0.00 IQD');
        expect(formatCents(-Infinity, 'IQD')).toBe('0.00 IQD');

        expect(formatCurrency(NaN, 'IQD')).toBe('0 IQD');
        expect(formatCurrency(Infinity, 'IQD')).toBe('0 IQD');
    });
});

