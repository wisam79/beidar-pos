/**
 * BarcodeTagBlock — شريط معاينة الباركود التفاعلي لسطح المكتب
 */
import React, { memo } from 'react';
import { Barcode, Printer } from 'lucide-react';

interface BarcodeTagBlockProps {
    barcode: string;
    label?: string;
    onPrint?: () => void;
    className?: string;
}

export const BarcodeTagBlock = memo(({
    barcode,
    label,
    onPrint,
    className = '',
}: BarcodeTagBlockProps) => {
    return (
        <div className={`inline-flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl border border-border bg-surface-hover shadow-xs ${className}`}>
            <div className="flex items-center gap-2">
                <Barcode size={18} className="text-text-muted shrink-0" />
                <div className="text-right">
                    {label && <span className="block text-[10px] text-text-muted font-bold leading-none">{label}</span>}
                    <span className="block font-mono font-bold text-xs text-text-main leading-tight tracking-wider">{barcode}</span>
                </div>
            </div>
            {onPrint && (
                <button
                    type="button"
                    onClick={onPrint}
                    className="p-1 rounded-lg hover:bg-primary/10 text-text-muted hover:text-primary transition-colors touch-target"
                    title="طباعة الباركود"
                >
                    <Printer size={14} />
                </button>
            )}
        </div>
    );
});

BarcodeTagBlock.displayName = 'BarcodeTagBlock';
