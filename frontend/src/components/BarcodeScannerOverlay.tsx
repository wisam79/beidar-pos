
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, RefreshCw, AlertTriangle, Zap, ZapOff, CheckCircle2, ScanLine, Box, Ban, ShoppingCart, Package } from 'lucide-react';
import { playBeep } from '../core/utils';

import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';

export interface ScanResult {
    success: boolean;
    name?: string;
    message?: string;
}

interface Html5QrcodeCamera {
    id: string;
    label: string;
}

interface BarcodeScannerOverlayProps {
    onClose: () => void;
    onScan: (code: string) => Promise<ScanResult>; // Updated signature
    continuous?: boolean;
}

export const BarcodeScannerOverlay = ({ onClose, onScan, continuous = true }: BarcodeScannerOverlayProps) => {
    const [error, setError] = useState<string | null>(null);
    const [cameras, setCameras] = useState<Html5QrcodeCamera[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
    const [torchOn, setTorchOn] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);

    // Smart Feedback State
    const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

    const [isProcessing, setIsProcessing] = useState(false);
    const scannerRef = useRef<Html5QrcodeType | null>(null);
    const isScanning = useRef(false);
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

    // Mini Cart for scanned items
    const [scannedItems, setScannedItems] = useState<Array<{ code: string; name: string; count: number; timestamp: number }>>([]);
    const lastScanTimeRef = useRef<{ [code: string]: number }>({});
    const SAME_ITEM_DELAY = 1500; // 1.5 seconds delay for same item

    useEffect(() => {
        setMountNode(document.body);
        const initScanner = async () => {
            // Imported Html5Qrcode is always available


            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length) {
                    setCameras(devices);
                    // Try to restore saved preference
                    const savedId = localStorage.getItem('preferred-camera-id');
                    const savedCamera = devices.find((d: { id: string }) => d.id === savedId);

                    if (savedCamera) {
                        setActiveCameraId(savedCamera.id);
                    } else {
                        // Fallback logic
                        const backCamera = devices.find((d: Html5QrcodeCamera) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
                        setActiveCameraId(backCamera ? backCamera.id : devices[0].id);
                    }
                } else {
                    setError("لم يتم العثور على كاميرا.");
                }
            } catch (err) {
                setError("فشل الوصول للكاميرا. يرجى التحقق من الصلاحيات.");
            }
        };

        initScanner();
        return () => { stopScanner(); };
    }, []);

    useEffect(() => {
        if (activeCameraId) {
            // Always restart scanner when camera changes
            const switchCamera = async () => {
                await stopScanner();
                await startScanner(activeCameraId);
            };
            switchCamera();
            localStorage.setItem('preferred-camera-id', activeCameraId);
        }
    }, [activeCameraId]);

    const startScanner = async (cameraId: string) => {
        if (isScanning.current) await stopScanner();

        const { Html5Qrcode } = await import('html5-qrcode');
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        try {
            isScanning.current = true;
            await html5QrCode.start(
                cameraId,
                {
                    fps: 15,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    disableFlip: false
                },
                async (decodedText: string) => {
                    if (isProcessing) return; // Debounce

                    // Check if same item was scanned recently (within delay period)
                    const now = Date.now();
                    const lastTime = lastScanTimeRef.current[decodedText] || 0;
                    if (now - lastTime < SAME_ITEM_DELAY) return;

                    // Prevent duplicate fast scans of the same error code to avoid spamming
                    if (decodedText === lastScannedCode && scanStatus === 'error') return;

                    setIsProcessing(true);
                    setLastScannedCode(decodedText);
                    lastScanTimeRef.current[decodedText] = now;

                    // Execute Scan Action
                    try {
                        const result = await onScan(decodedText);

                        if (result.success) {
                            playBeep('success');
                            setScanStatus('success');
                            setFeedbackMessage(result.name || decodedText);

                            // Add to scanned items list
                            setScannedItems(prev => {
                                const existing = prev.find(i => i.code === decodedText);
                                if (existing) {
                                    return prev.map(i => i.code === decodedText
                                        ? { ...i, count: i.count + 1, timestamp: now }
                                        : i
                                    );
                                }
                                return [...prev, { code: decodedText, name: result.name || decodedText, count: 1, timestamp: now }];
                            });
                        } else {
                            playBeep('error');
                            setScanStatus('error');
                            setFeedbackMessage(result.message || "المنتج غير موجود");
                        }

                        if (!continuous && result.success) {
                            setTimeout(() => onClose(), 800);
                        } else {
                            // Reset logic for continuous scanning - faster for success
                            setTimeout(() => {
                                setIsProcessing(false);
                                setScanStatus('idle');
                                setFeedbackMessage(null);
                            }, result.success ? 800 : 2000);
                        }
                    } catch (e) {
                        setIsProcessing(false);
                    }
                },
                (errorMessage: string) => { }
            );

            try {
                const capabilities = html5QrCode.getRunningTrackCameraCapabilities() as { torch?: boolean };
                setHasTorch(!!capabilities.torch);
            } catch (e) { setHasTorch(false); }

        } catch (err) {
            isScanning.current = false;
            setError("تعذر تشغيل الكاميرا.");
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current && isScanning.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
                isScanning.current = false;
            } catch (err) { console.error(err); }
        }
    };

    const toggleTorch = async () => {
        if (scannerRef.current && hasTorch) {
            try {
                await scannerRef.current.applyVideoConstraints({ advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet] });
                setTorchOn(!torchOn);
            } catch {
                // Torch toggle failed - silently ignore
            }
        }
    };

    if (!mountNode) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-300">

            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex gap-4">
                    {hasTorch && (
                        <button onClick={toggleTorch} className={`p-3 rounded-full transition-all backdrop-blur-md border ${torchOn ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'bg-white/10 text-white border-white/10'}`}>
                            {torchOn ? <Zap size={20} fill="currentColor" /> : <ZapOff size={20} />}
                        </button>
                    )}
                    {cameras.length > 0 && (
                        <div className="relative group">
                            <select
                                value={activeCameraId || ''}
                                onChange={(e) => setActiveCameraId(e.target.value)}
                                className="appearance-none pl-10 pr-4 py-3 bg-white/10 border border-white/10 rounded-full text-white hover:bg-white/20 transition-all backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-primary text-sm max-w-[150px] truncate cursor-pointer [&>option]:bg-gray-900"
                                aria-label="اختيار الكاميرا"
                            >
                                {cameras?.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.label || `Camera ${c.id.substring(0, 5)}...`}
                                    </option>
                                ))}
                            </select>
                            <Camera size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                        </div>
                    )}
                </div>
                <button onClick={onClose} className="text-white p-3 bg-white/10 border border-white/10 rounded-full hover:bg-red-500/20 hover:text-red-500 transition-all backdrop-blur-md" aria-label="إغلاق الماسح">
                    <X size={20} />
                </button>
            </div>

            {/* Main Area */}
            <div className="relative w-full max-w-lg aspect-[3/4] flex flex-col items-center justify-center p-4">
                {error ? (
                    <div className="text-center p-8 bg-surface rounded-3xl border border-red-500/20 shadow-2xl">
                        <AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
                        <p className="text-red-400 font-bold mb-6 text-lg">{error}</p>
                        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-xl font-bold">إغلاق</button>
                    </div>
                ) : (
                    <>
                        <div className="relative w-full h-full overflow-hidden rounded-[2.5rem] border border-white/10 shadow-2xl bg-black">
                            <div id="reader" className="w-full h-full object-cover"></div>

                            {/* Visual Feedback Overlay */}
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                {/* Success Flash */}
                                <div className={`absolute inset-0 bg-green-500/40 transition-opacity duration-200 ${scanStatus === 'success' ? 'opacity-100' : 'opacity-0'}`}></div>
                                {/* Error Flash */}
                                <div className={`absolute inset-0 bg-red-500/40 transition-opacity duration-200 ${scanStatus === 'error' ? 'opacity-100' : 'opacity-0'}`}></div>

                                {/* Frame */}
                                <div className={`
                                    w-[260px] h-[260px] rounded-3xl relative transition-all duration-300
                                    ${scanStatus === 'success' ? 'border-4 border-green-500 scale-105 shadow-[0_0_50px_rgba(34,197,94,0.6)]' :
                                        scanStatus === 'error' ? 'border-4 border-red-500 scale-105 shadow-[0_0_50px_rgba(239,68,68,0.6)]' :
                                            'border-2 border-white/30 shadow-[0_0_100px_rgba(0,200,150,0.1)]'}
                                `}>
                                    {scanStatus === 'idle' && (
                                        <>
                                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl -translate-x-1 -translate-y-1"></div>
                                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl translate-x-1 -translate-y-1"></div>
                                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl -translate-x-1 translate-y-1"></div>
                                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl translate-x-1 translate-y-1"></div>
                                            <div className="absolute inset-x-0 h-0.5 bg-red-500 shadow-[0_0_15px_red] top-1/2 -translate-y-1/2 animate-scan-line opacity-80"></div>
                                        </>
                                    )}

                                    {/* Success Icon */}
                                    {scanStatus === 'success' && (
                                        <div className="absolute inset-0 flex items-center justify-center animate-in zoom-in duration-300">
                                            <div className="bg-green-500 text-black rounded-full p-5 shadow-xl">
                                                <CheckCircle2 size={64} strokeWidth={3} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Error Icon */}
                                    {scanStatus === 'error' && (
                                        <div className="absolute inset-0 flex items-center justify-center animate-in zoom-in duration-300">
                                            <div className="bg-red-500 text-white rounded-full p-5 shadow-xl">
                                                <Ban size={64} strokeWidth={3} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Result Message Card */}
                        <div className="absolute bottom-12 left-6 right-6 flex flex-col items-center z-50 pointer-events-none">
                            {scanStatus === 'idle' ? (
                                <div className="bg-black/60 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/10 shadow-lg">
                                    <p className="text-gray-300 font-bold text-sm flex items-center gap-2">
                                        <Camera size={18} className="text-primary animate-pulse" />
                                        وجه الكاميرا نحو الباركود
                                    </p>
                                </div>
                            ) : scanStatus === 'success' ? (
                                <div className="bg-green-500 text-black px-6 py-4 rounded-2xl font-black text-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 w-full justify-center">
                                    <Box size={24} strokeWidth={2.5} />
                                    <span className="truncate">{feedbackMessage}</span>
                                </div>
                            ) : (
                                <div className="bg-red-500 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 w-full justify-center">
                                    <AlertTriangle size={24} strokeWidth={2.5} />
                                    <span>{feedbackMessage}</span>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Scanned Items Panel - Clean Professional Design */}
            {scannedItems.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 py-4 px-4 z-50">
                    <div className="max-w-2xl mx-auto">
                        {/* Header Row */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <ShoppingCart size={16} className="text-primary" />
                                <span className="text-white font-bold text-sm">السلة</span>
                                <span className="bg-white/10 text-white/80 px-2 py-0.5 rounded-md text-[11px] font-mono">
                                    {scannedItems.reduce((sum, i) => sum + i.count, 0)}
                                </span>
                            </div>
                            <button
                                onClick={onClose}
                                className="bg-primary text-primary-fg px-4 py-2 rounded-lg font-bold text-xs hover:brightness-110 transition-all flex items-center gap-1.5"
                            >
                                <CheckCircle2 size={14} />
                                تم
                            </button>
                        </div>

                        {/* Items List - Horizontal Scroll */}
                        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                            {scannedItems.slice(-10).reverse().map((item, idx) => (
                                <div
                                    key={item.code}
                                    className={`
                                        shrink-0 flex items-center gap-2.5 
                                        bg-white/5 border rounded-xl px-3 py-2.5
                                        transition-all duration-200
                                        ${idx === 0
                                            ? 'border-primary/60 bg-primary/10'
                                            : 'border-white/10 hover:border-white/20'}
                                    `}
                                >
                                    {/* Quantity Badge */}
                                    <div className={`
                                        w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black
                                        ${item.count > 1
                                            ? 'bg-primary text-primary-fg'
                                            : 'bg-white/10 text-white/70'}
                                    `}>
                                        {item.count}
                                    </div>

                                    {/* Product Info */}
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-white text-xs font-bold truncate max-w-[120px]">
                                            {item.name}
                                        </span>
                                        <span className="text-white/40 text-[9px] font-mono">
                                            {item.code.length > 12 ? `${item.code.slice(0, 4)}...${item.code.slice(-4)}` : item.code}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes scan-line {
                    0%, 100% { transform: translateY(-100px); opacity: 0; }
                    50% { opacity: 1; }
                    100% { transform: translateY(100px); opacity: 0; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-scan-line { animation: scan-line 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
                #reader video { object-fit: cover; width: 100% !important; height: 100% !important; border-radius: 2.5rem; }
            `}</style>
        </div>,
        mountNode
    );
};
