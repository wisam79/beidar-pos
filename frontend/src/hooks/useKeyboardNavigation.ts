/**
 * useKeyboardNavigation - Custom hook for managing keyboard navigation in lists/grids
 */
import { useEffect, useState, useCallback } from 'react';

interface UseKeyboardNavigationProps {
    itemCount: number;
    columns?: number;
    onSelect?: (index: number) => void;
    disabled?: boolean;
}

export const useKeyboardNavigation = ({
    itemCount,
    columns = 1,
    onSelect,
    disabled = false
}: UseKeyboardNavigationProps) => {
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (disabled || itemCount === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + columns, itemCount - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - columns, 0));
                break;
            case 'ArrowRight':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, itemCount - 1));
                break;
            case 'ArrowLeft':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < itemCount) {
                    onSelect?.(selectedIndex);
                }
                break;
            case 'Escape':
                setSelectedIndex(-1);
                break;
        }
    }, [itemCount, columns, onSelect, disabled, selectedIndex]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return {
        selectedIndex,
        setSelectedIndex
    };
};
