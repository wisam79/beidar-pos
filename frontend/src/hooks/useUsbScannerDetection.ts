import { useState, useEffect, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔌 USB SCANNER DETECTION HOOK
// Detects if a USB barcode scanner is connected based on input patterns
// ═══════════════════════════════════════════════════════════════════════════════

const USB_SCANNER_KEY = 'beidar_usb_scanner_detected';
const DETECTION_THRESHOLD_MS = 50; // USB scanners type much faster than humans
const MIN_BARCODE_LENGTH = 3;

interface UsbScannerState {
    isUsbDetected: boolean;
    lastDetectionTime: number | null;
    scanCount: number;
}

interface UseUsbScannerOptions {
    onScan: (code: string) => void | Promise<unknown>;
    onUsbDetected?: () => void;
    enabled?: boolean;
}

export const useUsbScannerDetection = ({
    onScan,
    onUsbDetected,
    enabled = true
}: UseUsbScannerOptions) => {
    const [state, setState] = useState<UsbScannerState>(() => {
        const stored = localStorage.getItem(USB_SCANNER_KEY);
        return {
            isUsbDetected: stored === 'true',
            lastDetectionTime: stored === 'true' ? Date.now() : null,
            scanCount: 0
        };
    });

    const bufferRef = useRef('');
    const lastKeyTimeRef = useRef(0);
    const consecutiveFastInputsRef = useRef(0);

    // Detect USB scanner pattern: fast consecutive keystrokes ending with Enter
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!enabled) return;

        // Skip if focused on input/textarea
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }

        const now = Date.now();
        const timeDiff = now - lastKeyTimeRef.current;
        lastKeyTimeRef.current = now;

        // Enter key = submit barcode
        if (e.key === 'Enter') {
            if (bufferRef.current.length >= MIN_BARCODE_LENGTH) {
                // Check if this was fast input (USB scanner pattern)
                if (consecutiveFastInputsRef.current >= MIN_BARCODE_LENGTH - 1) {
                    // Definitely a USB scanner!
                    if (!state.isUsbDetected) {
                        localStorage.setItem(USB_SCANNER_KEY, 'true');
                        setState(prev => ({
                            ...prev,
                            isUsbDetected: true,
                            lastDetectionTime: now,
                            scanCount: prev.scanCount + 1
                        }));
                        onUsbDetected?.();
                    } else {
                        setState(prev => ({ ...prev, scanCount: prev.scanCount + 1 }));
                    }
                }

                // Execute scan callback
                onScan(bufferRef.current);
            }

            // Reset buffer
            bufferRef.current = '';
            consecutiveFastInputsRef.current = 0;
            return;
        }

        // Only accept printable characters
        if (e.key.length === 1) {
            // Reset buffer if too much time passed (human typing)
            if (timeDiff > DETECTION_THRESHOLD_MS) {
                bufferRef.current = '';
                consecutiveFastInputsRef.current = 0;
            }

            bufferRef.current += e.key;

            // Track fast inputs
            if (timeDiff <= DETECTION_THRESHOLD_MS) {
                consecutiveFastInputsRef.current++;
            }
        }
    }, [enabled, onScan, onUsbDetected, state.isUsbDetected]);

    // Attach global keydown listener
    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown, enabled]);

    // Reset USB detection (e.g., when user manually wants to switch to camera)
    const resetDetection = useCallback(() => {
        localStorage.removeItem(USB_SCANNER_KEY);
        setState({
            isUsbDetected: false,
            lastDetectionTime: null,
            scanCount: 0
        });
    }, []);

    // Mark as USB detected manually
    const markAsUsbConnected = useCallback(() => {
        localStorage.setItem(USB_SCANNER_KEY, 'true');
        setState(prev => ({
            ...prev,
            isUsbDetected: true,
            lastDetectionTime: Date.now()
        }));
    }, []);

    return {
        isUsbDetected: state.isUsbDetected,
        scanCount: state.scanCount,
        resetDetection,
        markAsUsbConnected
    };
};

export default useUsbScannerDetection;
