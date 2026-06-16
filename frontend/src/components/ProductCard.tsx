import React, { memo, useMemo } from 'react';
import { Check, Printer, XCircle, Package, AlertTriangle, Plus } from 'lucide-react';
import { Product } from '../core/api';
import { formatCurrency } from '../core/utils';
import { cn } from '../theme/cn';

// Generate a consistent color based on product name for visual variety
const productGradients = [
    { from: 'from-emerald-500/15', to: 'to-teal-500/5', text: 'text-emerald-500', border: 'border-emerald-500/20' },
    { from: 'from-blue-500/15', to: 'to-indigo-500/5', text: 'text-blue-500', border: 'border-blue-500/20' },
    { from: 'from-purple-500/15', to: 'to-violet-500/5', text: 'text-purple-500', border: 'border-purple-500/20' },
    { from: 'from-amber-500/15', to: 'to-orange-500/5', text: 'text-amber-500', border: 'border-amber-500/20' },
    { from: 'from-rose-500/15', to: 'to-pink-500/5', text: 'text-rose-500', border: 'border-rose-500/20' },
    { from: 'from-cyan-500/15', to: 'to-sky-500/5', text: 'text-cyan-500', border: 'border-cyan-500/20' },
    { from: 'from-lime-500/15', to: 'to-green-500/5', text: 'text-lime-600', border: 'border-lime-500/20' },
    { from: 'from-fuchsia-500/15', to: 'to-pink-500/5', text: 'text-fuchsia-500', border: 'border-fuchsia-500/20' },
];

function getProductColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return productGradients[Math.abs(hash) % productGradients.length];
}

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
    const colorScheme = useMemo(() => getProductColor(product.name), [product.name]);
    const firstLetter = product.name.charAt(0);

    return (
        <button
            onClick={() => onClick(product)}
            className={cn(
                'group relative flex h-[210px] w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-surface p-2.5 text-right shadow-xs hover:border-primary/30 hover:bg-surface-hover/30 transition-all duration-120 ease-out active:scale-[0.985] outline-none touch-action-manipulation',
                isOut && 'cursor-not-allowed opacity-60 grayscale',
            )}
        >
            <div className="relative flex h-[106px] w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-surface-hover/50">
                {hasImage ? (
                    <img src={imageUrl} className="h-full w-full object-cover" alt={product.name} loading="lazy" />
                ) : (
                    <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br', colorScheme.from, colorScheme.to, colorScheme.border, 'border')}>
                        <span className={cn('text-4xl font-black opacity-80', colorScheme.text)}>
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
                        className="absolute left-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-lg border border-border/30 bg-surface/90 text-text-muted hover:text-text-main opacity-0 group-hover:opacity-100 transition-opacity touch-target cursor-pointer"
                        title="طباعة"
                    >
                        <Printer size={13} />
                    </div>
                )}
                <div className="absolute right-2 top-2 z-20">
                    {isOut ? (
                        <span className="flex items-center gap-1 rounded-lg bg-danger/10 border border-danger/25 px-2 py-0.5 text-[9px] font-black text-danger">
                            <XCircle size={10} strokeWidth={3} /> نفذت
                        </span>
                    ) : (
                        <span className={cn('flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[9px] font-black', isLow ? 'bg-warning/15 text-warning border-warning/25' : 'bg-surface/95 text-text-muted border-border')}>
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
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface text-text-muted transition-colors group-hover:border-primary/45 group-hover:bg-primary-dim group-hover:text-primary">
                        <Plus size={15} strokeWidth={3.5} />
                    </div>
                </div>
            </div>

            {isJustAdded && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-primary/10 backdrop-blur-[1px]">
                    <div className="rounded-xl bg-primary p-4 text-primary-fg shadow-lg">
                        <Check size={28} strokeWidth={4} />
                    </div>
                </div>
            )}
        </button>
    );
});

ProductCard.displayName = 'ProductCard';
