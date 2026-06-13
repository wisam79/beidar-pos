
import React, { useState, useCallback, useEffect } from 'react';
import { Delete, CornerDownLeft, X, Plus, Minus } from 'lucide-react';
import { formatCurrency, playBeep } from '../../../core/utils';

interface NumpadProps {
    value: number;
    onChange: (value: number) => void;
    total?: number; // Optional now
    onQuickCash?: (amount: number) => void;
    onClear?: () => void;
    onConfirm?: () => void; // Added onConfirm callback
    currency?: string;
    mode?: 'payment' | 'quantity'; // New mode prop
    productName?: string; // Show product name in quantity mode
    maxQty?: number; // Maximum allowed quantity
}

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000, 50000, 100000];
const QUICK_QUANTITIES = [0.5, 1, 2, 3, 5, 10];

export const Numpad: React.FC<NumpadProps> = ({
    value,
    onChange,
    total = 0,
    onQuickCash,
    onClear,
    onConfirm,
    currency = 'IQD',
    mode = 'payment',
    productName,
    maxQty = 9999
}) => {
    const [display, setDisplay] = useState(value > 0 ? value.toString() : '');

    // Sync display with external value changes
    useEffect(() => {
        setDisplay(value > 0 ? value.toString() : '');
    }, [value]);

    const handleDigit = useCallback((digit: string) => {
        playBeep('click');
        let newDisplay = display;

        // Handle decimal for quantity mode
        if (digit === '.') {
            if (display.includes('.')) return; // Prevent multiple dots
            if (display === '' || display === '0') {
                newDisplay = '0.';
            } else {
                newDisplay = display + '.';
            }
        } else if (display === '0' && digit !== '.') {
            newDisplay = digit;
        } else {
            newDisplay += digit;
        }

        const newValue = parseFloat(newDisplay) || 0;

        // Check max quantity limit
        if (mode === 'quantity' && newValue > maxQty) {
            return;
        }

        setDisplay(newDisplay);
        onChange(newValue);
    }, [display, onChange, mode, maxQty]);

    const handleBackspace = useCallback(() => {
        playBeep('click');
        const newDisplay = display.slice(0, -1);
        setDisplay(newDisplay);
        onChange(parseFloat(newDisplay) || 0);
    }, [display, onChange]);

    const handleClear = useCallback(() => {
        playBeep('click');
        setDisplay('');
        onChange(0);
        onClear?.();
    }, [onChange, onClear]);

    const handleQuickAmount = useCallback((amount: number) => {
        playBeep('click');
        setDisplay(amount.toString());
        onChange(amount);
        onQuickCash?.(amount);
    }, [onChange, onQuickCash]);

    const handleQuickQuantity = useCallback((qty: number) => {
        playBeep('click');
        const newQty = Math.min(qty, maxQty);
        setDisplay(newQty.toString());
        onChange(newQty);
    }, [onChange, maxQty]);

    const handleIncrement = useCallback((delta: number) => {
        playBeep('click');
        const currentValue = parseFloat(display) || 0;
        const newValue = Math.max(1, Math.min(currentValue + delta, maxQty));
        const formatted = Number.isInteger(newValue) ? newValue.toString() : newValue.toFixed(2);
        setDisplay(formatted);
        onChange(newValue);
    }, [display, onChange, maxQty]);

    const handleExact = useCallback(() => {
        playBeep('click');
        setDisplay(total.toString());
        onChange(total);
    }, [total, onChange]);

    const change = value - total;
    const currentValue = parseFloat(display) || 0;

    return (
        <div className="bg-gradient-to-b from-surface to-bg border-t border-border p-4 space-y-4">
            {/* Display */}
            <div className="bg-bg border border-border rounded-2xl p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary-dim),transparent)] opacity-30"></div>
                <div className="relative">
                    {/* Product Name in Quantity Mode */}
                    {mode === 'quantity' && productName && (
                        <p className="text-sm text-text-muted font-bold mb-2 truncate">{productName}</p>
                    )}
                    <div className="flex justify-between items-center">
                        <div className="text-left w-full">
                            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{mode === 'payment' ? 'المستلم' : 'الكمية الجديدة'}</p>
                            <div className="flex items-center gap-2">
                                {mode === 'quantity' && (
                                    <button
                                        onClick={() => handleIncrement(-1)}
                                        className="w-14 h-14 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border-2 border-red-500/20 flex items-center justify-center transition-all active:scale-95"
                                        title="إنقاص 1"
                                    >
                                        <Minus size={24} />
                                    </button>
                                )}
                                <p className="text-5xl font-black text-text-main font-mono tracking-tighter flex-1 text-center py-2">
                                    <span>{display || '0'}</span>
                                    {mode === 'payment' && <span className="text-lg text-text-muted ml-2">{currency}</span>}
                                </p>
                                {mode === 'quantity' && (
                                    <button
                                        onClick={() => handleIncrement(1)}
                                        className="w-14 h-14 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-2 border-emerald-500/20 flex items-center justify-center transition-all active:scale-95"
                                        title="زيادة 1"
                                    >
                                        <Plus size={24} />
                                    </button>
                                )}
                            </div>
                        </div>
                        {mode === 'payment' && (
                            <div className="text-right">
                                <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">الباقي</p>
                                <p className={`text-xl font-black font-mono tracking-tighter ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {change >= 0 ? formatCurrency(change, currency).replace(currency, '') : `-${formatCurrency(Math.abs(change), currency).replace(currency, '')}`}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Buttons */}
            {mode === 'payment' ? (
                <div className="grid grid-cols-6 gap-1.5">
                    {QUICK_AMOUNTS.map(amount => (
                        <button
                            key={amount}
                            onClick={() => handleQuickAmount(amount)}
                            className="py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-[10px] font-bold transition-all active:scale-95"
                        >
                            {(amount / 1000)}K
                        </button>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-6 gap-2">
                    {QUICK_QUANTITIES.map(qty => (
                        <button
                            key={qty}
                            onClick={() => handleQuickQuantity(qty)}
                            className={`py-3.5 rounded-xl text-base font-bold transition-all active:scale-95 ${currentValue === qty
                                ? 'bg-primary text-primary-fg shadow-lg shadow-primary/30'
                                : 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20'
                                }`}
                        >
                            {qty}
                        </button>
                    ))}
                </div>
            )}

            {/* Numpad Grid */}
            <div className="grid grid-cols-4 gap-2">
                {['7', '8', '9'].map(d => (
                    <button key={d} onClick={() => handleDigit(d)} className="h-16 text-2xl font-bold bg-surface hover:bg-surface-hover border border-border rounded-2xl text-text-main transition-all active:scale-95 shadow-sm">
                        {d}
                    </button>
                ))}
                <button onClick={handleBackspace} title="مسح" className="h-16 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 rounded-2xl transition-all active:scale-95 flex items-center justify-center">
                    <Delete size={22} />
                </button>

                {['4', '5', '6'].map(d => (
                    <button key={d} onClick={() => handleDigit(d)} className="h-16 text-2xl font-bold bg-surface hover:bg-surface-hover border border-border rounded-2xl text-text-main transition-all active:scale-95 shadow-sm">
                        {d}
                    </button>
                ))}
                <button onClick={handleClear} title="إلغاء" className="h-16 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-2xl transition-all active:scale-95 flex items-center justify-center">
                    <X size={22} />
                </button>

                {['1', '2', '3'].map(d => (
                    <button key={d} onClick={() => handleDigit(d)} className="h-16 text-2xl font-bold bg-surface hover:bg-surface-hover border border-border rounded-2xl text-text-main transition-all active:scale-95 shadow-sm">
                        {d}
                    </button>
                ))}
                {mode === 'payment' ? (
                    <button onClick={handleExact} className="h-16 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 rounded-2xl transition-all active:scale-95 text-sm font-bold">
                        المبلغ
                    </button>
                ) : (
                    <button
                        onClick={() => handleIncrement(0.5)}
                        className="h-16 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 rounded-2xl transition-all active:scale-95 text-base font-bold"
                        title="إضافة 0.5"
                    >
                        +0.5
                    </button>
                )}

                {mode === 'payment' ? (
                    <button onClick={() => handleDigit('00')} className="h-16 text-xl font-bold bg-surface hover:bg-surface-hover border border-border rounded-2xl text-text-main transition-all active:scale-95 shadow-sm">
                        00
                    </button>
                ) : (
                    <button onClick={() => handleDigit('.')} className="h-16 text-2xl font-bold bg-surface hover:bg-surface-hover border border-border rounded-2xl text-text-main transition-all active:scale-95 shadow-sm">
                        .
                    </button>
                )}
                <button onClick={() => handleDigit('0')} className="h-16 text-2xl font-bold bg-surface hover:bg-surface-hover border border-border rounded-2xl text-text-main transition-all active:scale-95 shadow-sm">
                    0
                </button>
                {mode === 'payment' ? (
                    <button onClick={() => handleDigit('.')} className="h-16 text-2xl font-bold bg-surface hover:bg-surface-hover border border-border rounded-2xl text-text-main transition-all active:scale-95 shadow-sm">
                        .
                    </button>
                ) : (
                    <button onClick={() => handleDigit('000')} className="h-16 text-xl font-bold bg-surface hover:bg-surface-hover border border-border rounded-2xl text-text-main transition-all active:scale-95 shadow-sm">
                        000
                    </button>
                )}
                <button
                    onClick={() => onConfirm?.()}
                    title="تأكيد"
                    disabled={mode === 'quantity' && currentValue <= 0}
                    className={`h-16 rounded-2xl transition-all active:scale-95 flex items-center justify-center font-bold ${mode === 'quantity' && currentValue <= 0
                        ? 'bg-gray-500/10 text-gray-500 border border-gray-500/20 cursor-not-allowed'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                        }`}
                >
                    <CornerDownLeft size={24} />
                </button>
            </div>
        </div>
    );
};
