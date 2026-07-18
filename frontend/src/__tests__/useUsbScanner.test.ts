import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUsbScannerDetection } from '../hooks/useUsbScannerDetection';

describe('useUsbScannerDetection Hook', () => {
    const onScan = vi.fn();
    const onUsbDetected = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    const triggerKeydown = (key: string, timeDiffMs: number) => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true });
        const now = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(now + timeDiffMs);
        
        act(() => {
            window.dispatchEvent(event);
        });
    };

    it('should not do anything if hook is disabled', () => {
        renderHook(() => useUsbScannerDetection({ onScan, onUsbDetected, enabled: false }));

        const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
        act(() => {
            window.dispatchEvent(event);
        });

        expect(onScan).not.toHaveBeenCalled();
    });

    it('should ignore input when focused on an input element', () => {
        const input = document.createElement('input');
        renderHook(() => useUsbScannerDetection({ onScan, onUsbDetected }));

        const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
        Object.defineProperty(event, 'target', { value: input, enumerable: true });
        
        act(() => {
            window.dispatchEvent(event);
        });
        expect(onScan).not.toHaveBeenCalled();
    });

    it('should buffer keys and invoke onScan on Enter key press', () => {
        renderHook(() => useUsbScannerDetection({ onScan, onUsbDetected }));

        // Fast typing simulating USB Scanner (time difference = 10ms per key)
        triggerKeydown('A', 10);
        triggerKeydown('B', 10);
        triggerKeydown('C', 10);
        triggerKeydown('Enter', 10);

        expect(onScan).toHaveBeenCalledWith('ABC');
        expect(onUsbDetected).toHaveBeenCalled();
    });

    it('should reject inputs if too slow (acting like a human typing)', () => {
        renderHook(() => useUsbScannerDetection({ onScan, onUsbDetected }));

        triggerKeydown('X', 200); // 200ms (human speed)
        triggerKeydown('Y', 200);
        triggerKeydown('Z', 200);
        triggerKeydown('Enter', 200);

        expect(onScan).not.toHaveBeenCalled();
        // Because it was slow, it shouldn't trigger USB detection
        expect(onUsbDetected).not.toHaveBeenCalled();
    });
});
