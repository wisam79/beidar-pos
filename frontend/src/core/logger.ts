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

function addToBuffer(entry: LogEntry): void {
    LOG_BUFFER.push(entry);
    if (LOG_BUFFER.length > MAX_BUFFER_SIZE) {
        LOG_BUFFER.shift();
    }
}

function log(level: LogLevel, message: string, data?: unknown, context?: string): void {
    const entry: LogEntry = {
        level,
        message,
        timestamp: Date.now(),
        data,
        context,
    };

    addToBuffer(entry);

    // In production, only log warnings and errors
    if (IS_PRODUCTION && level !== 'warn' && level !== 'error') {
        return;
    }

    const prefix = `${ICONS[level]} [${formatTimestamp()}]${context ? ` [${context}]` : ''}`;
    const style = STYLES[level];

    if (data !== undefined) {
        console.groupCollapsed(`%c${prefix} ${message}`, style);
        console.log('Data:', data);
        console.groupEnd();
    } else {
        console.log(`%c${prefix} ${message}`, style);
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

// ═══════════════════════════════════════════════════════════════════════════════
// Performance Logging Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Measure execution time of an async function
 */
export async function measureAsync<T>(
    name: string, 
    fn: () => Promise<T>,
    context?: string
): Promise<T> {
    const start = performance.now();
    try {
        const result = await fn();
        const duration = performance.now() - start;
        logger.debug(`${name} completed in ${duration.toFixed(2)}ms`, undefined, context);
        return result;
    } catch (error) {
        const duration = performance.now() - start;
        logger.error(`${name} failed after ${duration.toFixed(2)}ms`, error, context);
        throw error;
    }
}

/**
 * Create a performance marker for manual timing
 */
export function createTimer(name: string, context?: string) {
    const start = performance.now();
    return {
        end: () => {
            const duration = performance.now() - start;
            logger.debug(`${name}: ${duration.toFixed(2)}ms`, undefined, context);
            return duration;
        },
    };
}

export default logger;
