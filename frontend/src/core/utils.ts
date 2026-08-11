import { SoundManager } from './sound';

/**
 * Formats a number as a currency string with thousands separators.
 * @param amount The number to format
 * @param currency The currency suffix (default: 'IQD')
 * @returns Formatted currency string (e.g. "1,250 IQD")
 */
export const formatCurrency = (amount: number, currency: string = 'IQD'): string => {
    // Format number with thousands separator
    const formatted = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
    }).format(amount);
    // Return with currency suffix (Arabic style: number first, then currency)
    return `${formatted} ${currency}`;
};

/**
 * Safely parses a JSON string from localStorage with a fallback value.
 * @param key LocalStorage key to read
 * @param fallback Fallback value if parsing fails or item doesn't exist
 * @returns Parsed value or fallback
 */
export const safeJSONParse = <T = unknown>(key: string, fallback: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        console.error(`Error parsing ${key}`, e);
        return fallback;
    }
};

/**
 * Strips secrets (Admin PIN, AI API keys) from a preferences object before it
 * is mirrored to localStorage. Sensitive values are replaced with the same
 * masked placeholder the backend uses, so plaintext keys never touch disk.
 */
export const sanitizePrefsForStorage = (prefs: Record<string, unknown>): Record<string, unknown> => {
    const MASKED = '********';
    const sanitized: Record<string, unknown> = { ...prefs };
    const secretKeys = ['adminPin', 'geminiApiKey', 'geminiApiKeys', 'groqApiKey', 'AdminPin', 'GeminiAPIKey', 'GeminiAPIKeys', 'GroqAPIKey'];
    for (const key of secretKeys) {
        if (key in sanitized) {
            const value = sanitized[key];
            sanitized[key] = Array.isArray(value) ? [MASKED] : MASKED;
        }
    }
    return sanitized;
};

/**
 * Plays a system beep sound based on the type.
 * @param type Type of sound: 'success' | 'error' | 'warning' | 'click'
 */
export const playBeep = (type: 'success' | 'error' | 'warning' | 'click' = 'success') => {
    try {
        if (type === 'success') SoundManager.playSuccess();
        else if (type === 'error') SoundManager.playError();
        else if (type === 'click') SoundManager.playClick();
        else SoundManager.playWarning();
    } catch {
        // Ignore audio errors
    }
};

/**
 * Generates a unique ID using crypto API or a fallback method.
 * @returns Unique ID string
 */
export const generateId = () => {
    // Use crypto API for cryptographically secure unique IDs
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID().split('-')[0]; // Returns first 8 chars
    }
    // Fallback for older browsers
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

/**
 * Compresses an image file to a specified max width and quality.
 * @param base64 Source image as Base64 string
 * @param maxWidth Maximum width in pixels (default: 400 for smaller DB writes)
 * @param quality JPEG quality 0-1 (default: 0.6 for better compression)
 * @returns Promise resolving to compressed Base64 string
 */
export const compressImage = async (base64: string, maxWidth = 400, quality = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Validate input
        if (!base64 || typeof base64 !== 'string') {
            reject(new Error('Invalid image data'));
            return;
        }

        const img = new Image();

        // Handle load error
        img.onerror = () => {
            console.error('Failed to load image for compression');
            reject(new Error('فشل تحميل الصورة - جرب صورة أخرى'));
        };

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // More aggressive resize for production stability
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                // Also limit height
                const maxHeight = 400;
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('فشل إنشاء سياق الرسم'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                const result = canvas.toDataURL('image/jpeg', quality);

                // Check final size (max 500KB for SQLite safety)
                const sizeKB = (result.length * 0.75) / 1024;
                if (sizeKB > 500) {
                    // Re-compress with lower quality
                    const lowerQuality = canvas.toDataURL('image/jpeg', 0.4);
                    resolve(lowerQuality);
                } else {
                    resolve(result);
                }
            } catch (err) {
                console.error('Image compression error:', err);
                reject(new Error('فشل ضغط الصورة'));
            }
        };

        img.src = base64;
    });
};

/**
 * Returns the current local date in YYYY-MM-DD format.
 */
export const getLocalDateString = (d: Date = new Date()): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

