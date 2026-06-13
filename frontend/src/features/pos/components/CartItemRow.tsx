
import React, { memo } from 'react';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { Product } from '../../../core/types';
import { formatCurrency } from '../../../core/utils';

export interface CartItem extends Product {
    qty: number;
    itemDiscount?: number;
}

interface CartItemRowProps {
    item: CartItem;
    onUpdateQty: (id: string, delta: number) => void;
    onRemove: (id: string) => void;
    onEdit: (item: CartItem) => void;
    onQtyClick?: (item: CartItem) => void; // Added for fractional quantity support
    currency?: string;
}

// Helper for resolving image path
const resolveImage = (img: string | undefined) => {
    if (!img) return null;
    if (img.startsWith('data') || img.startsWith('http')) return img;
    if (img.includes('.')) return `http://localhost:48123/${img}`;
    return null; // For emoji or text
};

export const CartItemRow = memo(({ item, onUpdateQty, onRemove, onEdit, onQtyClick, currency = 'IQD' }: CartItemRowProps) => {
    // Handler for manual quantity edit
    const handleQtyClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // We will trigger a specific action for quantity edit. 
        // Re-using onEdit but passing a special flag or handling it in parent would be ideal.
        // For now, let's assume onEdit handles this if we pass a specific property, 
        // OR we can add a new prop onEditQty. 
        // Since I can't change the interface easily without breaking usages, 
        // I'll emit a custom event or rely on the parent logic. 
        // Wait, I can pass a callback prop if I execute multi-step.
        // Let's stick to the plan: The parent (Sales.tsx) passes a handler. 
        // But CartItemRowProps is defined here. Let's add onQtyClick.
    };

    return (
        <div className="bg-surface p-3 2xl:p-4 rounded-2xl flex items-center gap-4 group border border-border hover:border-primary/40 hover:bg-surface-hover transition-all relative overflow-hidden cursor-pointer select-none shadow-md shadow-black/10 hover:shadow-xl hover:shadow-primary/10 mb-2" onClick={() => onEdit(item)}>
            {/* Image Thumbnail */}
            <div className="w-14 h-14 2xl:w-16 2xl:h-16 bg-bg rounded-xl flex items-center justify-center text-2xl shadow-sm border border-border shrink-0 overflow-hidden text-gray-600">
                {resolveImage(item.image) ? (
                    <img src={resolveImage(item.image)!} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                    item.image
                )}
            </div>

            {/* Details - Better space usage */}
            <div className="flex-1 min-w-0">
                <h4 className="font-bold text-text-main text-base 2xl:text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">{item.name}</h4>
                <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-lg">{formatCurrency(item.price, currency)}</span>
                    {item.itemDiscount && item.itemDiscount > 0 ? <span className="text-xs text-red-500 bg-red-500/10 px-2 py-0.5 rounded font-bold">خصم -{item.itemDiscount}</span> : null}
                    {item.barcode && <span className="text-xs text-text-muted font-mono hidden xl:inline">{item.barcode}</span>}
                </div>
            </div>

            {/* Touch-Friendly Controls - Responsive */}
            <div className="flex items-center gap-1.5 shrink-0 bg-bg rounded-2xl p-1.5 border border-border" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => {
                        const target = Math.max(1, Math.ceil(item.qty) - 1);
                        onUpdateQty(item.id, target - item.qty);
                    }}
                    className="w-11 h-11 2xl:w-12 2xl:h-12 flex items-center justify-center bg-surface hover:bg-red-500/10 text-text-muted hover:text-red-500 rounded-xl transition-colors active:scale-90 border border-transparent hover:border-red-500/20"
                    title="إنقاص 1"
                >
                    <Minus size={18} strokeWidth={3} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onQtyClick?.(item); }}
                    className="min-w-[44px] 2xl:min-w-[52px] h-11 2xl:h-12 px-2 text-center font-black text-lg 2xl:text-xl text-text-main font-mono bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors border border-primary/20"
                    title="تعديل الكمية"
                >
                    {Number.isInteger(item.qty) ? item.qty : item.qty.toFixed(2).replace(/\.00$/, '')}
                </button>
                <button
                    onClick={() => {
                        const target = Math.floor(item.qty) + 1;
                        onUpdateQty(item.id, target - item.qty);
                    }}
                    className="w-11 h-11 2xl:w-12 2xl:h-12 flex items-center justify-center bg-surface hover:bg-green-500/10 text-text-muted hover:text-green-500 rounded-xl transition-colors active:scale-90 border border-transparent hover:border-green-500/20"
                    title="زيادة 1"
                >
                    <Plus size={18} strokeWidth={3} />
                </button>
            </div>

            {/* Total Price */}
            <div className="text-right min-w-[70px] shrink-0 pl-2">
                <p className="font-black text-text-main text-sm 2xl:text-base tracking-tight">{formatCurrency((item.price * item.qty) - (item.itemDiscount || 0), currency).replace(currency, '')}</p>
                <p className="text-[9px] text-text-muted font-bold">الإجمالي</p>
            </div>

            {/* Delete Overlay Action */}
            <button
                onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                className="absolute top-0 bottom-0 w-12 bg-red-500 text-white flex items-center justify-center opacity-0 transition-all duration-150 z-10 shadow-lg ltr:right-0 ltr:translate-x-full ltr:group-hover:opacity-100 ltr:group-hover:translate-x-0 rtl:left-0 rtl:-translate-x-full rtl:group-hover:opacity-100 rtl:group-hover:translate-x-0"
                title="حذف"
            >
                <Trash2 size={18} />
            </button>
        </div>
    );
});
