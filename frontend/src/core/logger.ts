// ═══════════════════════════════════════════════════════════════════════════════
// 📝 Logger - Centralized Logging System
// ═══════════════════════════════════════════════════════════════════════════════

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: number;
    data?: unknown;
    context?: string;
}

// Check if we're in production (Wails build)
const IS_PRODUCTION = import.meta.env.PROD;

// In-memory log buffer for debugging (last 100 entries)
const LOG_BUFFER: LogEntry[] = [];
const MAX_BUFFER_SIZE = 100;

// Styled console output
const STYLES = {
    debug: 'color: #9CA3AF; font-weight: normal;',
    info: 'color: #3B82F6; font-weight: bold;',
    warn: 'color: #F59E0B; font-weight: bold;',
    error: 'color: #EF4444; font-weight: bold;',
};

const ICONS = {
    debug: '🔍',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
};

function formatTimestamp(): string {
    return new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
}

export function maskPhone(phone: string): string {
    const cleaned = (phone || '').trim();
    if (!cleaned) return '';
    if (cleaned.length <= 4) return '***';
    if (cleaned.length <= 7) return `${cleaned.slice(0, 2)}****${cleaned.slice(-1)}`;
    const prefixLen = cleaned.startsWith('+') ? 5 : 4;
    const suffixLen = 3;
    const maskedCount = cleaned.length - prefixLen - suffixLen;
    if (maskedCount <= 0) return `${cleaned.slice(0, 2)}****${cleaned.slice(-2)}`;
    return `${cleaned.slice(0, prefixLen)}${'*'.repeat(maskedCount)}${cleaned.slice(-suffixLen)}`;
}

const PHONE_REGEX = /(?:\+?964|0)?7[0-9]{8,9}/g;
const SENSITIVE_KEY_REGEX = /^(pin|password|secret|token|apiKey|authorization|privateKey|accessToken|refreshToken)$/i;

export function sanitizeLogData(data: unknown, depth = 0): unknown {
    if (data === null || data === undefined) return data;
    if (depth > 5) return '[NESTED_OBJECT]';

    if (typeof data === 'string') {
        return data.replace(PHONE_REGEX, (m) => maskPhone(m));
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
        return data;
    }

    if (data instanceof Error) {
        return {
            name: data.name,
            message: sanitizeLogData(data.message, depth + 1),
            stack: data.stack ? sanitizeLogData(data.stack, depth + 1) : undefined,
        };
    }

    if (Array.isArray(data)) {
        return data.map((item) => sanitizeLogData(item, depth + 1));
    }

    if (typeof data === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
            if (SENSITIVE_KEY_REGEX.test(key)) {
                sanitized[key] = '[REDACTED]';
            } else if (/(phone|mobile)/i.test(key) && typeof value === 'string') {
                sanitized[key] = maskPhone(value);
            } else {
                sanitized[key] = sanitizeLogData(value, depth + 1);
            }
        }
        return sanitized;
    }

    return String(data);
}

function addToBuffer(entry: LogEntry): void {
    LOG_BUFFER.push(entry);
    if (LOG_BUFFER.length > MAX_BUFFER_SIZE) {
        LOG_BUFFER.shift();
    }
}

function log(level: LogLevel, message: string, data?: unknown, context?: string): void {
    const sanitizedMsg = typeof message === 'string' ? message.replace(PHONE_REGEX, (m) => maskPhone(m)) : message;
    const sanitizedData = data !== undefined ? sanitizeLogData(data) : undefined;

    const entry: LogEntry = {
        level,
        message: sanitizedMsg,
        timestamp: Date.now(),
        data: sanitizedData,
        context,
    };

    addToBuffer(entry);

    // In production, only log warnings and errors
    if (IS_PRODUCTION && level !== 'warn' && level !== 'error') {
        return;
    }

    const prefix = `${ICONS[level]} [${formatTimestamp()}]${context ? ` [${context}]` : ''}`;
    const style = STYLES[level];

    if (sanitizedData !== undefined) {
        // eslint-disable-next-line no-console
        console.groupCollapsed(`%c${prefix} ${sanitizedMsg}`, style);
        // eslint-disable-next-line no-console
        console.log('Data:', sanitizedData);
        // eslint-disable-next-line no-console
        console.groupEnd();
    } else {
        // eslint-disable-next-line no-console
        console.log(`%c${prefix} ${sanitizedMsg}`, style);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

export const logger = {
    /**
     * Debug level - for development only
     */
    debug: (message: string, data?: unknown, context?: string): void => {
        log('debug', message, data, context);
    },

    /**
     * Info level - general information
     */
    info: (message: string, data?: unknown, context?: string): void => {
        log('info', message, data, context);
    },

    /**
     * Warning level - something unexpected but not critical
     */
    warn: (message: string, data?: unknown, context?: string): void => {
        log('warn', message, data, context);
    },

    /**
     * Error level - something went wrong
     */
    error: (message: string, error?: unknown, context?: string): void => {
        log('error', message, error, context);
    },

    /**
     * Get all logs from buffer (for debugging)
     */
    getLogs: (): LogEntry[] => [...LOG_BUFFER],

    /**
     * Clear the log buffer
     */
    clearLogs: (): void => {
        LOG_BUFFER.length = 0;
    },

    /**
     * Create a scoped logger with a fixed context
     */
    withContext: (context: string) => ({
        debug: (msg: string, data?: unknown) => logger.debug(msg, data, context),
        info: (msg: string, data?: unknown) => logger.info(msg, data, context),
        warn: (msg: string, data?: unknown) => logger.warn(msg, data, context),
        error: (msg: string, err?: unknown) => logger.error(msg, err, context),
    }),
};
