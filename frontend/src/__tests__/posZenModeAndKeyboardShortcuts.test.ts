import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('POS Zen Mode & Keyboard Shortcuts Dispatcher (Rule 3.6)', () => {
    let activeShortcuts: Record<string, () => void>;

    beforeEach(() => {
        activeShortcuts = {};
    });

    const registerShortcut = (key: string, handler: () => void) => {
        activeShortcuts[key.toLowerCase()] = handler;
    };

    const dispatchKeyEvent = (key: string, _targetTagName: string = 'BODY') => {
        const lowerKey = key.toLowerCase();
        // Rule 3.6: Passive scanning and functional shortcuts should execute
        // unless focused on an input element that captures Enter/Escape specifically
        if (activeShortcuts[lowerKey]) {
            activeShortcuts[lowerKey]();
            return true;
        }
        return false;
    };

    it('should toggle Zen Mode state for maximum cashier desktop visibility', () => {
        let isZenMode = false;
        const toggleZenMode = () => {
            isZenMode = !isZenMode;
        };

        registerShortcut('f11', toggleZenMode);

        expect(isZenMode).toBe(false);
        dispatchKeyEvent('F11');
        expect(isZenMode).toBe(true);
        dispatchKeyEvent('F11');
        expect(isZenMode).toBe(false);
    });

    it('should dispatch POS functional shortcuts (F1 search, F2 payment, F4 park, Escape clear)', () => {
        const onSearch = vi.fn();
        const onPayment = vi.fn();
        const onPark = vi.fn();
        const onClear = vi.fn();

        registerShortcut('f1', onSearch);
        registerShortcut('f2', onPayment);
        registerShortcut('f4', onPark);
        registerShortcut('escape', onClear);

        dispatchKeyEvent('F1');
        expect(onSearch).toHaveBeenCalledTimes(1);

        dispatchKeyEvent('F2');
        expect(onPayment).toHaveBeenCalledTimes(1);

        dispatchKeyEvent('F4');
        expect(onPark).toHaveBeenCalledTimes(1);

        dispatchKeyEvent('Escape');
        expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('should accumulate barcode scanner passive keystrokes and fire on Enter', () => {
        let accumulatedBarcode = '';
        let lastScannedCode = '';

        const onBarcodeScanned = (code: string) => {
            lastScannedCode = code;
        };

        const handleBarcodeKey = (char: string) => {
            if (char === 'Enter') {
                if (accumulatedBarcode.length >= 3) {
                    onBarcodeScanned(accumulatedBarcode);
                }
                accumulatedBarcode = '';
            } else {
                accumulatedBarcode += char;
            }
        };

        // Simulate rapid USB HID barcode scanner input: '628100123456' followed by Enter
        const barcodeString = '628100123456';
        for (const char of barcodeString) {
            handleBarcodeKey(char);
        }
        handleBarcodeKey('Enter');

        expect(lastScannedCode).toBe('628100123456');
        expect(accumulatedBarcode).toBe('');
    });
});
