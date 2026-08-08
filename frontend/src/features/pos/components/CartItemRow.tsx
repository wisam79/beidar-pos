import React, { memo } from 'react';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { Product } from '../../../core/types';
import { formatCurrency } from '../../../core/utils';
import { cn } from '../../../theme/cn';
import { Button } from '../../../components/ds/Button';

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
    const total = (item.price * item.qty) - (item.itemDiscount || 0);

    return (
        <div
            onClick={() => onEdit(item)}
            className="group relative flex h-[88px] overflow-hidden cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-surface p-3 transition-colors duration-150 ease-out hover:bg-surface-hover hover:border-emerald-500/30 select-none"
        >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-surface-hover text-xl text-text-muted">
                {imageUrl ? <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" /> : item.image}
            </div>

            <div className="min-w-0 flex-1">
                <h4 className="line-clamp-1 text-xs font-black leading-tight text-text-main group-hover:text-emerald-400 transition-colors">{item.name}</h4>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-black text-emerald-400">{formatCurrency(item.price, currency)}</span>
                    {item.itemDiscount && item.itemDiscount > 0 && <span className="rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-black text-red-400">خصم -{item.itemDiscount}</span>}
                    {item.barcode && <span className="hidden font-mono text-[10px] text-text-muted xl:inline">{item.barcode}</span>}
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border/80 bg-surface-hover/90 p-1" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={() => onUpdateQty(item.id, Math.max(1, Math.ceil(item.qty)) - 1 - item.qty)}
                    title="إنقاص 1"
                    className="h-10 w-10 shrink-0 rounded-xl bg-surface border border-border/60 text-text-main hover:bg-red-500/15 hover:text-red-400 flex items-center justify-center transition-colors active:scale-95 touch-target cursor-pointer"
                >
                    <Minus size={18} strokeWidth={3} />
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onQtyClick?.(item); }}
                    className="min-w-[40px] shrink-0 h-10 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2 text-center font-black text-base font-mono text-emerald-400 transition hover:bg-emerald-500/20 cursor-pointer"
                    title="تعديل الكمية"
                >
                    {qty}
                </button>
                <button
                    type="button"
                    onClick={() => onUpdateQty(item.id, Math.floor(item.qty) + 1 - item.qty)}
                    title="زيادة 1"
                    className="h-10 w-10 shrink-0 rounded-xl bg-surface border border-border/60 text-text-main hover:bg-emerald-500/15 hover:text-emerald-400 flex items-center justify-center transition-colors active:scale-95 touch-target cursor-pointer"
                >
                    <Plus size={18} strokeWidth={3} />
                </button>
            </div>

            <div className="min-w-[85px] shrink-0 pl-2 text-right">
                <p className="truncate text-base font-black font-mono tracking-tight text-emerald-400" title={formatCurrency(total, currency).replace(currency, '')}>{formatCurrency(total, currency).replace(currency, '')}</p>
                <p className="text-[10px] font-bold text-text-muted">الصافي</p>
            </div>

            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                className={cn('absolute bottom-0 top-0 z-10 flex w-12 items-center justify-center bg-red-600 text-white opacity-0 transition duration-150 rtl:left-0 rtl:-translate-x-full rtl:group-hover:translate-x-0 rtl:group-hover:opacity-100 cursor-pointer')}
                title="حذف"
            >
                <Trash2 size={20} />
            </button>
        </div>
    );
});

CartItemRow.displayName = 'CartItemRow';
