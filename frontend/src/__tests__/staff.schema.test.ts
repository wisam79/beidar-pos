import { describe, it, expect } from 'vitest';
import { validateStaffInput, passwordSchema, pinSchema } from '../core/schemas/staff.schema';

describe('Staff Validation Schema', () => {
    it('validates a correct staff member', () => {
        const input = {
            name: 'John Doe',
            username: 'johndoe',
            role: 'cashier',
            email: 'john@example.com',
            phone: '07701234567',
            active: true
        };
        const result = validateStaffInput(input);
        expect(result.success).toBe(true);
    });

    it('fails when name is too short', () => {
        const input = {
            name: 'J',
            username: 'johndoe',
            role: 'cashier'
        };
        const result = validateStaffInput(input);
        expect(result.success).toBe(false);
        expect(result.errors?.name).toBeDefined();
    });

    it('fails when username has invalid characters', () => {
        const input = {
            name: 'John',
            username: 'john doe', // space not allowed
            role: 'cashier'
        };
        const result = validateStaffInput(input);
        expect(result.success).toBe(false);
        expect(result.errors?.username).toBeDefined();
    });

    it('validates password constraints', () => {
        const valid = passwordSchema.safeParse('123456');
        expect(valid.success).toBe(true);

        const invalid = passwordSchema.safeParse('123');
        expect(invalid.success).toBe(false);
    });

    it('validates PIN constraints', () => {
        const valid = pinSchema.safeParse('1234');
        expect(valid.success).toBe(true);

        const invalidLength = pinSchema.safeParse('123');
        expect(invalidLength.success).toBe(false);

        const invalidChars = pinSchema.safeParse('12ab');
        expect(invalidChars.success).toBe(false);
    });
});
