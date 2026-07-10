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
            className="group relative flex h-[88px] overflow-hidden cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition-[background-color,border-color,box-shadow] duration-120 ease-out hover:border-primary/40 hover:bg-surface-hover"
        >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-bg text-2xl text-text-muted">
                {imageUrl ? <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" /> : item.image}
            </div>

            <div className="min-w-0 flex-1">
                <h4 className="line-clamp-1 text-sm font-bold leading-tight text-text-main group-hover:text-primary">{item.name}</h4>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{formatCurrency(item.price, currency)}</span>
                    {item.itemDiscount && item.itemDiscount > 0 && <span className="rounded-lg bg-danger-dim px-2 py-0.5 text-[10px] font-bold text-danger">خصم -{item.itemDiscount}</span>}
                    {item.barcode && <span className="hidden font-mono text-[10px] text-text-muted xl:inline">{item.barcode}</span>}
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-xl border bg-bg p-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="icon" size="sm" onClick={() => onUpdateQty(item.id, Math.max(1, Math.ceil(item.qty)) - 1 - item.qty)} title="إنقاص 1" className="h-9 w-9 shrink-0">
                    <Minus size={16} strokeWidth={3} />
                </Button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onQtyClick?.(item); }}
                    className="min-w-[36px] shrink-0 h-9 rounded-lg border border-primary/20 bg-primary-dim px-1.5 text-center font-black text-base font-mono text-text-main transition hover:bg-primary/15"
                    title="تعديل الكمية"
                >
                    {qty}
                </button>
                <Button variant="icon" size="sm" onClick={() => onUpdateQty(item.id, Math.floor(item.qty) + 1 - item.qty)} title="زيادة 1" className="h-9 w-9 shrink-0">
                    <Plus size={16} strokeWidth={3} />
                </Button>
            </div>

            <div className="min-w-[75px] shrink-0 pl-2 text-right">
                <p className="truncate text-sm font-black tracking-tight text-text-main" title={formatCurrency(total, currency).replace(currency, '')}>{formatCurrency(total, currency).replace(currency, '')}</p>
                <p className="text-[9px] font-bold text-text-muted">الصافي</p>
            </div>

            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                className={cn('absolute bottom-0 top-0 z-10 flex w-12 items-center justify-center bg-danger text-white opacity-0 transition duration-150 rtl:left-0 rtl:-translate-x-full rtl:group-hover:translate-x-0 rtl:group-hover:opacity-100')}
                title="حذف"
            >
                <Trash2 size={18} />
            </button>
        </div>
    );
});

CartItemRow.displayName = 'CartItemRow';
