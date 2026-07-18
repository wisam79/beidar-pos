/**
 * useKeyboardNavigation - Custom hook for managing keyboard navigation in lists/grids
 */
import { useEffect, useState, useCallback, useRef } from 'react';

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

    // Keep state and callbacks in refs to avoid re-binding window keydown listener
    const selectedIndexRef = useRef(selectedIndex);
    useEffect(() => {
        selectedIndexRef.current = selectedIndex;
    }, [selectedIndex]);

    const itemCountRef = useRef(itemCount);
    const columnsRef = useRef(columns);
    const onSelectRef = useRef(onSelect);
    const disabledRef = useRef(disabled);

    useEffect(() => {
        itemCountRef.current = itemCount;
        columnsRef.current = columns;
        onSelectRef.current = onSelect;
        disabledRef.current = disabled;
    }); // updates on every render

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const disabledVal = disabledRef.current;
        const itemCountVal = itemCountRef.current;
        const columnsVal = columnsRef.current;
        const selectedIndexVal = selectedIndexRef.current;
        const onSelectVal = onSelectRef.current;

        if (disabledVal || itemCountVal === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + columnsVal, itemCountVal - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - columnsVal, 0));
                break;
            case 'ArrowRight':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, itemCountVal - 1));
                break;
            case 'ArrowLeft':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndexVal >= 0 && selectedIndexVal < itemCountVal) {
                    onSelectVal?.(selectedIndexVal);
                }
                break;
            case 'Escape':
                setSelectedIndex(-1);
                break;
        }
    }, []); // Stable handleKeyDown

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return {
        selectedIndex,
        setSelectedIndex
    };
};
