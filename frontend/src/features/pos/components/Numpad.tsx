import React, { useCallback, useEffect, useState } from 'react';
import { Delete, CornerDownLeft, X, Plus, Minus, Check } from 'lucide-react';
import { formatCurrency, playBeep } from '../../../core/utils';
import { Button } from '../../../components/ds/Button';

interface NumpadProps {
    value: number;
    onChange: (value: number) => void;
    total?: number;
    onQuickCash?: (amount: number) => void;
    onClear?: () => void;
    onConfirm?: () => void;
    currency?: string;
    mode?: 'payment' | 'quantity';
    productName?: string;
    maxQty?: number;
}

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000, 50000, 100000];
const QUICK_QUANTITIES = [0.5, 1, 2, 3, 5, 10];
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];

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
    maxQty = 9999,
}) => {
    const [display, setDisplay] = useState(value > 0 ? value.toString() : '');

    useEffect(() => {
        setDisplay(value > 0 ? value.toString() : '');
    }, [value]);

    const handleDigit = useCallback((digit: string) => {
        playBeep('click');
        let next = display;
        if (digit === '.') {
            if (display.includes('.')) return;
            next = display === '' || display === '0' ? '0.' : `${display}.`;
        } else {
            next = display === '0' ? digit : `${display}${digit}`;
        }
        const nextValue = Number.parseFloat(next) || 0;
        if (mode === 'quantity' && nextValue > maxQty) return;
        setDisplay(next);
        onChange(nextValue);
    }, [display, maxQty, mode, onChange]);

    const handleBackspace = useCallback(() => {
        playBeep('click');
        const next = display.slice(0, -1);
        setDisplay(next);
        onChange(Number.parseFloat(next) || 0);
    }, [display, onChange]);

    const handleClear = useCallback(() => {
        playBeep('click');
        setDisplay('');
        onChange(0);
        onClear?.();
    }, [onClear, onChange]);

    const handleQuickAmount = useCallback((amount: number) => {
        playBeep('click');
        setDisplay(amount.toString());
        onChange(amount);
        onQuickCash?.(amount);
    }, [onQuickCash, onChange]);

    const handleIncrement = useCallback((delta: number) => {
        playBeep('click');
        const current = Number.parseFloat(display) || 0;
        const next = Math.max(1, Math.min(current + delta, maxQty));
        const formatted = Number.isInteger(next) ? next.toString() : next.toFixed(2);
        setDisplay(formatted);
        onChange(next);
    }, [display, maxQty, onChange]);

    const handleExact = useCallback(() => {
        playBeep('click');
        setDisplay(total.toString());
        onChange(total);
    }, [onChange, total]);

    const quickItems = mode === 'payment' ? QUICK_AMOUNTS : QUICK_QUANTITIES;
    const change = value - total;
    const currentValue = Number.parseFloat(display) || 0;

    return (
        <div className="space-y-3 border-t bg-surface p-4">
            <div className="rounded-2xl border bg-bg p-4">
                {mode === 'quantity' && productName && <p className="mb-2 text-sm font-bold text-text-muted">{productName}</p>}
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-text-muted">{mode === 'payment' ? 'المستلم' : 'الكمية الجديدة'}</p>
                        <div className="flex items-center gap-2">
                            {mode === 'quantity' && (
                                <Button variant="icon" onClick={() => handleIncrement(-1)} title="إنقاص 1">
                                    <Minus size={22} />
                                </Button>
                            )}
                            <p className="truncate text-center text-4xl font-black font-mono tracking-tighter text-text-main">{display || '0'}</p>
                            {mode === 'quantity' && (
                                <Button variant="icon" onClick={() => handleIncrement(1)} title="زيادة 1">
                                    <Plus size={22} />
                                </Button>
                            )}
                        </div>
                    </div>
                    {mode === 'payment' && (
                        <div className="shrink-0 text-right">
                            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-text-muted">الباقي</p>
                            <p className={`text-xl font-black font-mono tracking-tighter ${change >= 0 ? 'text-success' : 'text-danger'}`}>
                                {change >= 0 ? formatCurrency(change, currency).replace(currency, '') : `-${formatCurrency(Math.abs(change), currency).replace(currency, '')}`}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
                {quickItems.map((amount) => {
                    const selected = mode === 'payment' ? amount === total : amount === currentValue;
                    return (
                        <button
                            key={amount}
                            type="button"
                            onClick={() => (mode === 'payment' ? handleQuickAmount(amount) : handleIncrement(amount - currentValue))}
                            className={`rounded-xl px-2 py-2 text-[10px] font-bold transition active:scale-[0.98] ${selected ? 'bg-primary text-white' : 'border bg-primary-dim text-primary hover:bg-primary/15'}`}
                        >
                            {mode === 'payment' ? `${amount / 1000}K` : amount}
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-4 gap-2">
                {DIGITS.map((digit) => (
                    <Button key={digit} variant="secondary" onClick={() => handleDigit(digit)} className="h-14 text-2xl font-bold">
                        {digit}
                    </Button>
                ))}
                <Button variant="soft" onClick={handleBackspace} title="مسح" className="h-14">
                    <Delete size={22} />
                </Button>
                <Button variant="soft" onClick={handleClear} title="إلغاء" className="h-14">
                    <X size={22} />
                </Button>
                <Button variant="primary" onClick={handleExact} title="المبلغ المضبوط" className="h-14">
                    <CornerDownLeft size={22} />
                </Button>
                <Button variant="primary" onClick={onConfirm} className="h-14">
                    <Check size={22} />
                </Button>
            </div>
        </div>
    );
};
