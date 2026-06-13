import { describe, it, expect } from 'vitest';
import { validateDiscountInput } from '../core/schemas/discount.schema';

describe('Discount Validation Schema', () => {
    it('validates a correct percentage discount', () => {
        const input = {
            name: 'Summer Sale',
            type: 'percentage',
            value: 20,
            active: true
        };
        const result = validateDiscountInput(input);
        expect(result.success).toBe(true);
        expect(result.errors).toBeUndefined();
    });

    it('validates a correct fixed discount', () => {
        const input = {
            name: 'Fixed Off',
            type: 'fixed',
            value: 5000,
            minPurchase: 10000,
            active: true
        };
        const result = validateDiscountInput(input);
        expect(result.success).toBe(true);
    });

    it('fails when name is missing', () => {
        const input = {
            type: 'percentage',
            value: 10
        };
        const result = validateDiscountInput(input);
        expect(result.success).toBe(false);
        expect(result.errors?.name).toBeDefined();
    });

    it('fails when value is invalid (negative)', () => {
        const input = {
            name: 'Bad Value',
            type: 'percentage',
            value: -10
        };
        const result = validateDiscountInput(input);
        expect(result.success).toBe(false);
        expect(result.errors?.value).toBeDefined();
    });

    it('validates optional fields correctly', () => {
        const input = {
            name: 'Coupon',
            type: 'percentage',
            value: 10,
            code: 'SAVE10',
            usageLimit: 100
        };
        const result = validateDiscountInput(input);
        expect(result.success).toBe(true);
        // @ts-expect-error - accessing data property for testing
        expect(result.data.code).toBe('SAVE10');
    });
});
