import { describe, it, expect } from 'vitest';
import { validateSettings } from '../core/schemas/settings.schema';

describe('Settings Validation Schema', () => {
    it('validates a correct store configuration', () => {
        const input = {
            storeName: 'My Store',
            vatRate: 0,
            taxRate: 0,
            lowStockTrigger: 5,
            adminPin: '1234',
            dailySalesTarget: 1000,
            enableSound: true
        };
        const result = validateSettings(input);
        expect(result.success).toBe(true);
    });

    it('fails when store name is empty', () => {
        const input = {
            storeName: '',
            adminPin: '1234'
        };
        const result = validateSettings(input);
        expect(result.success).toBe(false);
        expect(result.errors?.storeName).toBeDefined();
    });

    it('fails when PIN is too short', () => {
        const input = {
            storeName: 'Store',
            adminPin: '123'
        };
        const result = validateSettings(input);
        expect(result.success).toBe(false);
        expect(result.errors?.adminPin).toBeDefined();
    });

    it('fails when numeric values are negative', () => {
        const input = {
            storeName: 'Store',
            adminPin: '1234',
            vatRate: -1,
            dailySalesTarget: -100
        };
        const result = validateSettings(input);
        expect(result.success).toBe(false);
        expect(result.errors?.vatRate).toBeDefined();
        expect(result.errors?.dailySalesTarget).toBeDefined();
    });

    it('fills default values for missing fields', () => {
        const input = {
            storeName: 'Store',
            adminPin: '1234',
        };

        const result = validateSettings(input);
        expect(result.success).toBe(true);
        // Check defaults are applied
        expect(result.data?.taxRate).toBe(0);
        expect(result.data?.dailySalesTarget).toBe(0);
    });
});
