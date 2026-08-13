import { describe, it, expect, beforeEach } from 'vitest';
import { logger, maskPhone, sanitizeLogData } from '../core/logger';

describe('Logger PII Masking', () => {
    beforeEach(() => {
        logger.clearLogs();
    });

    it('should mask phone numbers correctly', () => {
        expect(maskPhone('')).toBe('');
        expect(maskPhone('12')).toBe('***');
        expect(maskPhone('1234')).toBe('***');
        expect(maskPhone('0770123')).toBe('07****3');
        expect(maskPhone('07701234567')).toBe('0770****567');
        expect(maskPhone('+9647701234567')).toBe('+9647******567');
    });

    it('should sanitize sensitive object fields', () => {
        const payload = {
            username: 'admin',
            pin: '1234',
            password: 'super-secret-password',
            token: 'jwt-token-12345',
            phone: '07701234567',
            profile: {
                mobile: '07809876543',
                apiKey: 'secret-key-xyz',
                address: 'Baghdad',
            },
        };

        const sanitized = sanitizeLogData(payload) as Record<string, unknown>;
        const profile = sanitized.profile as Record<string, unknown>;

        expect(sanitized.username).toBe('admin');
        expect(sanitized.pin).toBe('[REDACTED]');
        expect(sanitized.password).toBe('[REDACTED]');
        expect(sanitized.token).toBe('[REDACTED]');
        expect(sanitized.phone).toBe('0770****567');
        expect(profile.mobile).toBe('0780****543');
        expect(profile.apiKey).toBe('[REDACTED]');
        expect(profile.address).toBe('Baghdad');
    });

    it('should sanitize error objects and log entries in buffer', () => {
        logger.error('Failed to authenticate with token 07701234567', {
            secret: 'pass123',
            phone: '07701234567',
        }, 'Auth');

        const logs = logger.getLogs();
        expect(logs.length).toBe(1);
        expect(logs[0].message).toContain('0770****567');
        expect(logs[0].message).not.toContain('07701234567');
        const data = logs[0].data as Record<string, unknown>;
        expect(data.secret).toBe('[REDACTED]');
        expect(data.phone).toBe('0770****567');
    });
});
