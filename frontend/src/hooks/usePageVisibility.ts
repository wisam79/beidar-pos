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
