import React, { memo } from 'react';
import { Plus, Minus, Trash2, Package } from 'lucide-react';
import { Product } from '../../../core/types';
import { formatCurrency } from '../../../core/utils';
import { cn } from '../../../theme/cn';

export interface CartItem extends Product {
    qty: number;
    itemDiscount?: number;
}

interface CartItemRowProps {
    item: CartItem;
    onUpdateQty: (id: string, delta: number) => void;
    onRemove: (id: string) => void;
    onEdit: (item: CartItem) => void;
    onQtyClick?: (item: CartItem) => void;
    currency?: string;
}

const resolveImage = (img: string | undefined) => {
    if (!img) return null;
    if (img.startsWith('data') || img.startsWith('http')) return img;
    if (img.includes('.')) return `/local-image/${img}`;
    return null;
};

export const CartItemRow = memo(({ item, onUpdateQty, onRemove, onEdit, onQtyClick, currency = 'IQD' }: CartItemRowProps) => {
    const imageUrl = resolveImage(item.image);
    const qty = Number.isInteger(item.qty) ? item.qty : item.qty.toFixed(2).replace(/\.00$/, '');
    const total = Math.round(item.price * item.qty) - (item.itemDiscount || 0);

    const formattedUnitPrice = formatCurrency(item.price, currency);
    const formattedTotal = formatCurrency(total, currency);

    return (
        <div
            onClick={() => onEdit(item)}
            className="group relative flex h-[88px] items-center justify-between gap-3 rounded-2xl border border-border/70 bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2.5 transition-all duration-150 ease-out hover:bg-black/[0.06] dark:hover:bg-white/[0.07] hover:border-primary/50 select-none shadow-3xs overflow-hidden"
        >
            {/* Product Image & Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {imageUrl ? (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-surface-hover">
                        <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" />
                    </div>
                ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary font-black text-sm shadow-3xs">
                        <Package size={20} />
                    </div>
                )}

                <div className="min-w-0 flex-1">
                    <h4 className="truncate text-xs font-black leading-tight text-text-main group-hover:text-primary transition-colors" title={item.name}>
                        {item.name}
                    </h4>
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="whitespace-nowrap rounded-lg bg-surface-active px-2 py-0.5 text-[11px] font-mono font-bold text-text-muted border border-border/50">
                            {formattedUnitPrice}
                        </span>
                        {item.itemDiscount && item.itemDiscount > 0 && (
                            <span className="whitespace-nowrap rounded-lg bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">
                                -{item.itemDiscount}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Large Touch-Friendly Stepper Quantity Control */}
            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border/70 bg-bg p-1" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={() => onUpdateQty(item.id, Math.max(1, Math.ceil(item.qty)) - 1 - item.qty)}
                    title="إنقاص 1"
                    className="h-10 w-10 shrink-0 rounded-xl bg-surface border border-border/60 text-text-main hover:bg-danger/15 hover:text-danger flex items-center justify-center transition-all active:scale-90 touch-target cursor-pointer shadow-3xs"
                >
                    <Minus size={18} strokeWidth={3} />
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onQtyClick?.(item); }}
                    className="min-w-[42px] shrink-0 h-10 rounded-xl border border-primary/30 bg-primary/10 px-2 text-center font-black text-sm font-mono text-primary transition hover:bg-primary/20 cursor-pointer shadow-3xs flex items-center justify-center"
                    title="تعديل الكمية"
                >
                    {qty}
                </button>
                <button
                    type="button"
                    onClick={() => onUpdateQty(item.id, Math.floor(item.qty) + 1 - item.qty)}
                    title="زيادة 1"
                    className="h-10 w-10 shrink-0 rounded-xl bg-surface border border-border/60 text-text-main hover:bg-primary/15 hover:text-primary flex items-center justify-center transition-all active:scale-90 touch-target cursor-pointer shadow-3xs"
                >
                    <Plus size={18} strokeWidth={3} />
                </button>
            </div>

            {/* Net Total Price Display */}
            <div className="shrink-0 text-left pl-1 min-w-[75px]">
                <p className="whitespace-nowrap text-sm font-black font-mono tracking-tight text-primary text-left" title={formattedTotal}>
                    {formattedTotal}
                </p>
                <p className="text-[10px] font-bold text-text-muted opacity-70 text-left">الصافي</p>
            </div>

            {/* Trash Delete Button on Hover */}
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                className={cn('absolute bottom-0 top-0 z-10 flex w-11 items-center justify-center bg-danger text-white opacity-0 transition-all duration-150 rtl:left-0 rtl:-translate-x-full rtl:group-hover:translate-x-0 rtl:group-hover:opacity-100 cursor-pointer')}
                title="حذف"
            >
                <Trash2 size={18} />
            </button>
        </div>
    );
});

CartItemRow.displayName = 'CartItemRow';
