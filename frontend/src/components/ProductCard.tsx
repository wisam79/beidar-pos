import React, { memo } from 'react';
import { Check, Printer, XCircle, Package, AlertTriangle, Plus } from 'lucide-react';
import { Product } from '../core/api';
import { formatCurrency } from '../core/utils';
import { cn } from '../theme/cn';

interface ProductCardProps {
    product: Product;
    onClick: (p: Product) => void;
    isJustAdded?: boolean;
    onPrint?: (e: React.MouseEvent) => void;
    currency?: string;
    isWholesale?: boolean;
}

export const ProductCard = memo(({ product, onClick, isJustAdded, onPrint, currency = 'IQD', isWholesale = false }: ProductCardProps) => {
    const isOut = product.stock <= 0;
    const isLow = product.stock <= (product.minStock || 5) && !isOut;
    let imageUrl = product.image;
    if (product.image && !product.image.startsWith('data') && !product.image.startsWith('http') && product.image.includes('.')) {
        imageUrl = `/local-image/${product.image}`;
    }
    const hasImage = imageUrl && (imageUrl.startsWith('data') || imageUrl.startsWith('http') || imageUrl.startsWith('/local-image/'));
    const displayPrice = isWholesale ? (product.wholesalePrice || product.price) : product.price;
    const firstLetter = product.name.charAt(0);

    return (
        <button
            onClick={() => onClick(product)}
            className={cn(
                'group relative flex h-[172px] w-full flex-col overflow-hidden rounded-xl bg-surface p-2.5 text-right border border-border/80 hover:border-primary/40 transition-colors duration-150 ease-out active:scale-[0.98] outline-none touch-action-manipulation select-none cursor-pointer',
                isOut && 'cursor-not-allowed opacity-60 grayscale',
            )}
        >
            <div className="relative flex h-[76px] w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-hover border border-border/40">
                {hasImage ? (
                    <img src={imageUrl} className="h-full w-full object-cover" alt={product.name} loading="lazy" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface-hover">
                        <span className="text-3xl font-bold text-text-muted">
                            {firstLetter}
                        </span>
                    </div>
                )}
                {onPrint && (
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onPrint(e); }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                onPrint(e as unknown as React.MouseEvent);
                            }
                        }}
                        className="absolute left-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-text-muted hover:text-primary opacity-0 group-hover:opacity-100 border border-border/60 transition-opacity touch-target cursor-pointer"
                        title="طباعة"
                    >
                        <Printer size={15} />
                    </div>
                )}
                <div className="absolute right-2 top-2 z-20">
                    {isOut ? (
                        <span className="flex items-center gap-1 rounded-lg bg-danger/15 px-2 py-0.5 text-[10px] font-extrabold text-danger border border-danger/20">
                            <XCircle size={11} strokeWidth={3} /> نفذت
                        </span>
                    ) : (
                        <span className={cn('flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[10px] font-extrabold border', isLow ? 'bg-warning/15 text-warning border-warning/20' : 'bg-surface/90 text-text-muted border-border/60')}>
                            {isLow && <AlertTriangle size={11} />}
                            <Package size={11} className="opacity-80 text-text-muted" /> {product.stock}
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-2 flex flex-1 flex-col justify-between">
                <h3 className="mb-0.5 line-clamp-1 text-right text-xs font-black leading-snug text-text-main group-hover:text-primary transition-colors" title={product.name}>
                    {product.name}
                </h3>
                <div className="mt-auto flex items-center justify-between pt-1">
                    <div className="flex flex-col">
                        <span className={cn('flex items-baseline gap-1 text-[15px] font-black font-mono tracking-tight tabular-nums', isWholesale ? 'text-warning' : 'text-text-main')}>
                            {formatCurrency(displayPrice, currency).replace(currency, '')}
                            <span className="text-[10px] font-extrabold opacity-70 text-text-muted">{currency}</span>
                        </span>
                        {isWholesale && <span className="-mt-0.5 text-[8px] font-black text-warning/90">سعر الجملة</span>}
                    </div>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 transition-colors group-hover:bg-primary group-hover:text-primary-fg">
                        <Plus size={18} strokeWidth={3.5} />
                    </div>
                </div>
            </div>

            {isJustAdded && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-success/20">
                    <div className="rounded-2xl bg-success p-4 text-primary-fg border border-success">
                        <Check size={32} strokeWidth={4} />
                    </div>
                </div>
            )}
        </button>
    );
});

ProductCard.displayName = 'ProductCard';
