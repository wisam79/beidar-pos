// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ Safe Async - Error-Safe Async Operations Wrapper
// ═══════════════════════════════════════════════════════════════════════════════

import { logger } from './logger';

/**
 * Result type for safe async operations
 */
export type SafeResult<T> =
    | { success: true; data: T; error: null }
    | { success: false; data: null; error: Error };

/**
 * Execute an async function safely, returning a result object instead of throwing
 */
export async function safeAsync<T>(
    fn: () => Promise<T>,
    context?: string
): Promise<SafeResult<T>> {
    try {
        const data = await fn();
        return { success: true, data, error: null };
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Async operation failed', err, context);
        return { success: false, data: null, error: err };
    }
}

/**
 * Execute an async function with a fallback value on error
 */
export async function safeAsyncWithFallback<T>(
    fn: () => Promise<T>,
    fallback: T,
    context?: string
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        logger.error('Using fallback value', error, context);
        return fallback;
    }
}

/**
 * Retry an async function with exponential backoff
 */
export async function retryAsync<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        baseDelay?: number;
        context?: string;
    } = {}
): Promise<T> {
    const { maxRetries = 3, baseDelay = 1000, context } = options;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                logger.warn(`Retry ${attempt}/${maxRetries} in ${delay}ms`, { error: lastError.message }, context);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    logger.error(`All ${maxRetries} retries failed`, lastError, context);
    throw lastError;
}

/**
 * Execute multiple async operations in parallel with error isolation
 */
export async function safeParallel<T>(
    fns: (() => Promise<T>)[],
    context?: string
): Promise<SafeResult<T>[]> {
    return Promise.all(
        fns.map(fn => safeAsync(fn, context))
    );
}

/**
 * Debounce an async function
 */
export function debounceAsync<T>(
    fn: (...args: unknown[]) => Promise<T>,
    delay: number
): (...args: unknown[]) => Promise<T | undefined> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return async (...args: unknown[]): Promise<T | undefined> => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        return new Promise((resolve) => {
            timeoutId = setTimeout(async () => {
                try {
                    const result = await fn(...args);
                    resolve(result);
                } catch (error) {
                    logger.error('Debounced function error', error);
                    resolve(undefined);
                }
            }, delay);
        });
    };
}

/**
 * Throttle an async function
 */
export function throttleAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    limit: number
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
    let lastRun = 0;
    let pendingArgs: Parameters<T> | null = null;

    return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
        const now = Date.now();

        if (now - lastRun >= limit) {
            lastRun = now;
            return fn(...args) as Promise<ReturnType<T>>;
        } else {
            pendingArgs = args;
            return undefined;
        }
    };
}

export default safeAsync;
