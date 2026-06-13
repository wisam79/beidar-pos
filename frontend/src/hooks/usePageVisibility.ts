// ═══════════════════════════════════════════════════════════════════════════════
// 👁️ usePageVisibility Hook - Pause operations when tab is hidden
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';

/**
 * Hook to detect if the page/tab is currently visible to the user.
 * Use this to pause expensive operations (polling, animations) when tab is hidden.
 * 
 * @returns boolean - true if page is visible, false if hidden
 * 
 * @example
 * const isVisible = usePageVisibility();
 * useEffect(() => {
 *   if (!isVisible) return; // Don't poll when hidden
 *   const interval = setInterval(fetchData, 5000);
 *   return () => clearInterval(interval);
 * }, [isVisible]);
 */
export function usePageVisibility(): boolean {
    const [isVisible, setIsVisible] = useState(!document.hidden);

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(!document.hidden);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return isVisible;
}

/**
 * Hook to create an interval that automatically pauses when page is hidden.
 * This saves CPU and battery when user switches to another tab.
 * 
 * @param callback - Function to call on each interval
 * @param delay - Interval delay in milliseconds
 * @param enabled - Whether the interval should be active (default: true)
 */
export function useVisibilityAwareInterval(
    callback: () => void,
    delay: number,
    enabled: boolean = true
): void {
    const isVisible = usePageVisibility();

    useEffect(() => {
        // Don't run if not visible or not enabled
        if (!isVisible || !enabled) return;

        // Run immediately on visibility change
        callback();

        const interval = setInterval(callback, delay);
        return () => clearInterval(interval);
    }, [isVisible, enabled, delay, callback]);
}
