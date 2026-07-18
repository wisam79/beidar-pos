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
    const isOut = product.stock === 0;
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
                'group relative flex h-[210px] w-full flex-col overflow-hidden rounded-2xl bg-surface p-2.5 text-right shadow-sm hover:shadow-md hover:bg-surface-hover transition-all duration-120 ease-out active:scale-[0.985] outline-none touch-action-manipulation',
                isOut && 'cursor-not-allowed opacity-60 grayscale',
            )}
        >
            <div className="relative flex h-[106px] w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-hover">
                {hasImage ? (
                    <img src={imageUrl} className="h-full w-full object-cover" alt={product.name} loading="lazy" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                        <span className="text-4xl font-black text-primary/80">
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
                        className="absolute left-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-text-muted hover:text-text-main opacity-0 group-hover:opacity-100 shadow-sm transition-opacity touch-target cursor-pointer"
                        title="طباعة"
                    >
                        <Printer size={13} />
                    </div>
                )}
                <div className="absolute right-2 top-2 z-20">
                    {isOut ? (
                        <span className="flex items-center gap-1 rounded-lg bg-danger/10 px-2 py-0.5 text-[9px] font-black text-danger">
                            <XCircle size={10} strokeWidth={3} /> نفذت
                        </span>
                    ) : (
                        <span className={cn('flex items-center gap-1 rounded-lg px-2 py-0.5 text-[9px] font-black', isLow ? 'bg-warning/15 text-warning' : 'bg-surface text-text-muted shadow-sm')}>
                            {isLow && <AlertTriangle size={10} />}
                            <Package size={10} className="opacity-70" /> {product.stock}
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-2.5 flex flex-1 flex-col justify-between">
                <h3 className="mb-0.5 line-clamp-1 text-right text-xs font-bold leading-snug text-text-main" title={product.name}>
                    {product.name}
                </h3>
                <div className="mt-auto flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className={cn('flex items-baseline gap-1 text-[14px] font-black font-mono tracking-tight tabular-nums', isWholesale ? 'text-warning' : 'text-text-main')}>
                            {formatCurrency(displayPrice, currency).replace(currency, '')}
                            <span className="text-[9px] font-black opacity-60 text-text-muted">{currency}</span>
                        </span>
                        {isWholesale && <span className="-mt-0.5 text-[8px] font-black text-warning/80">سعر الجملة</span>}
                    </div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-text-muted transition-colors group-hover:bg-primary/20 group-hover:text-primary">
                        <Plus size={15} strokeWidth={3.5} />
                    </div>
                </div>
            </div>

            {isJustAdded && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-primary/10 ">
                    <div className="rounded-xl bg-primary p-4 text-primary-fg shadow-lg">
                        <Check size={28} strokeWidth={4} />
                    </div>
                </div>
            )}
        </button>
    );
});

ProductCard.displayName = 'ProductCard';
