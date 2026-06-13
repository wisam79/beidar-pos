/**
 * Input Validation & Sanitization Utilities
 * Provides protection against XSS and injection attacks
 */

/**
 * Escapes HTML special characters to prevent XSS
 */
export const escapeHtml = (str: string): string => {
    const htmlEscapes: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    return str.replace(/[&<>"'`=/]/g, (char) => htmlEscapes[char] || char);
};

/**
 * Removes potentially dangerous HTML tags
 */
export const stripTags = (str: string): string => {
    return str.replace(/<[^>]*>/g, '');
};

/**
 * Sanitizes input for safe display
 */
export const sanitizeInput = (input: string): string => {
    if (!input) return '';
    return escapeHtml(stripTags(input.trim()));
};

/**
 * Validates and sanitizes a barcode
 */
export const sanitizeBarcode = (barcode: string): string => {
    // Allow only alphanumeric and dashes
    return barcode.replace(/[^a-zA-Z0-9-]/g, '');
};

/**
 * Validates and sanitizes a phone number
 */
export const sanitizePhone = (phone: string): string => {
    // Allow only digits, plus, and dashes
    return phone.replace(/[^0-9+-]/g, '');
};

/**
 * Validates and sanitizes an email
 */
export const sanitizeEmail = (email: string): string => {
    // Basic email sanitization
    return email.toLowerCase().trim().replace(/[^a-z0-9@._-]/g, '');
};

/**
 * Validates a price value
 */
export const isValidPrice = (price: number): boolean => {
    return !isNaN(price) && isFinite(price) && price >= 0;
};

/**
 * Validates a stock quantity
 */
export const isValidStock = (stock: number, allowNegative = false): boolean => {
    if (isNaN(stock) || !isFinite(stock)) return false;
    if (!allowNegative && stock < 0) return false;
    return Number.isInteger(stock);
};

/**
 * Validates a PIN code
 */
export const isValidPin = (pin: string): boolean => {
    return /^\d{4,6}$/.test(pin);
};

/**
 * Validates an API key format
 */
export const isValidApiKey = (key: string): boolean => {
    // Gemini API keys start with 'AIzaSy'
    if (key.startsWith('AIzaSy')) return true;
    // General API key format
    return key.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(key);
};

/**
 * Masks sensitive data for display
 */
export const maskSensitiveData = (data: string, visibleChars = 4): string => {
    if (data.length <= visibleChars * 2) {
        return '*'.repeat(data.length);
    }
    const start = data.slice(0, visibleChars);
    const end = data.slice(-visibleChars);
    const middle = '*'.repeat(data.length - visibleChars * 2);
    return start + middle + end;
};

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
    private calls: number[] = [];
    private maxCalls: number;
    private windowMs: number;

    constructor(maxCalls: number = 10, windowMs: number = 60000) {
        this.maxCalls = maxCalls;
        this.windowMs = windowMs;
    }

    canMakeCall(): boolean {
        const now = Date.now();
        this.calls = this.calls.filter(time => now - time < this.windowMs);

        if (this.calls.length >= this.maxCalls) {
            return false;
        }

        this.calls.push(now);
        return true;
    }

    getRemainingCalls(): number {
        const now = Date.now();
        this.calls = this.calls.filter(time => now - time < this.windowMs);
        return Math.max(0, this.maxCalls - this.calls.length);
    }

    getResetTime(): number {
        if (this.calls.length === 0) return 0;
        const oldestCall = Math.min(...this.calls);
        return Math.max(0, this.windowMs - (Date.now() - oldestCall));
    }
}

/**
 * Content Security Policy headers generator
 */
export const generateCSPHeaders = (): Record<string, string> => {
    return {
        'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob:",
            "connect-src 'self' https://*.googleapis.com https://*.google.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; ')
    };
};

/**
 * Validates URL to prevent open redirect attacks
 */
export const isValidRedirectUrl = (url: string): boolean => {
    // Only allow relative URLs or same-origin URLs
    if (url.startsWith('/') && !url.startsWith('//')) {
        return true;
    }

    try {
        const parsedUrl = new URL(url);
        return parsedUrl.origin === window.location.origin;
    } catch {
        return false;
    }
};

/**
 * Generates a secure random ID
 */
export const generateSecureId = (length: number = 16): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => chars[byte % chars.length]).join('');
};
