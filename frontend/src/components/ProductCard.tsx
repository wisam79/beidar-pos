
import React, { memo } from 'react';
import { Check, Printer, XCircle, Package, AlertTriangle, Plus } from 'lucide-react';
import { Product } from '../core/api';
import { formatCurrency } from '../core/utils';

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
    // Determine image logic: base64/url or placeholder emoji or local filename
    let imageUrl = product.image;
    if (product.image && !product.image.startsWith('data') && !product.image.startsWith('http') && product.image.includes('.')) {
        imageUrl = `/local-image/${product.image}`;
    }
    const hasImage = imageUrl && (imageUrl.startsWith('data') || imageUrl.startsWith('http') || imageUrl.startsWith('/local-image/'));

    const displayPrice = isWholesale ? (product.wholesalePrice || product.price) : product.price;

    return (
        <button
            onClick={() => onClick(product)}
            className={`
                group relative flex flex-col w-full h-[200px] text-right overflow-hidden
                bg-surface border border-border rounded-lg shadow-[var(--shadow-card)]
                transition-colors duration-100
                hover:border-primary/50
                active:opacity-80
                touch-action-manipulation outline-none
                ${isOut ? 'opacity-60 grayscale' : ''}
            `}
        >
            {/* Image Container - Reduced Height */}
            <div className="relative h-[110px] w-full bg-black/5 dark:bg-white/[0.02] flex items-center justify-center overflow-hidden shrink-0 border-b border-border/40">
                {/* Background Pattern */}
                {!hasImage && (
                    <div className="absolute inset-0 bg-primary-dim opacity-10"></div>
                )}

                {hasImage ? (
                    <img
                        src={imageUrl}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        alt={product.name}
                        loading="lazy"
                    />
                ) : (
                    <div className="text-5xl transition-transform duration-500 group-hover:scale-110 drop-shadow-lg select-none">
                        {product.image}
                    </div>
                )}

                {/* Print Action (Touch Friendly) */}
                {onPrint && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onPrint(e); }}
                        className="absolute top-2 left-2 z-20 w-8 h-8 rounded-lg bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-black transition-all border border-white/10 shadow-lg touch-target"
                        title="طباعة"
                    >
                        <Printer size={16} />
                    </div>
                )}

                {/* Stock Badge */}
                <div className="absolute top-2 right-2 z-20">
                    {isOut ? (
                        <span className="bg-red-500 text-white px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-lg border border-red-400/50">
                            <XCircle size={10} strokeWidth={3} /> نفذت
                        </span>
                    ) : (
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold shadow-lg border flex items-center gap-1 ${isLow ? 'bg-orange-500 text-white border-orange-400/50' : 'bg-surface/90 text-text-main border-white/10'}`}>
                            {isLow && <AlertTriangle size={10} className="animate-pulse" />}
                            <Package size={10} className="opacity-70" /> {product.stock}
                        </span>
                    )}
                </div>
            </div>

            {/* Info Section - Tighter Padding */}
            <div className="flex flex-col flex-1 w-full p-3 relative bg-transparent justify-between">
                <h3 className="font-bold text-text-main text-sm leading-snug line-clamp-2 text-right w-full mb-1 group-hover:text-primary transition-colors" title={product.name}>
                    {product.name}
                </h3>

                <div className="flex items-end justify-between w-full mt-auto">
                    <div className="flex flex-col">
                        <span className={`text-lg font-black font-mono tracking-tight tabular-nums transition-colors flex items-baseline gap-1 ${isWholesale ? 'text-amber-500' : 'text-text-main group-hover:text-primary'}`}>
                            {formatCurrency(displayPrice, currency).replace(currency, '')}
                            <span className="text-[10px] font-bold opacity-60 text-text-muted">{currency}</span>
                        </span>
                        {isWholesale && <span className="text-[9px] text-amber-500/70 font-bold -mt-1">سعر الجملة</span>}
                    </div>

                    {/* Smaller Add Button */}
                    <div className="w-8 h-8 shrink-0 rounded-full bg-surface-hover border border-border flex items-center justify-center text-text-muted group-hover:bg-primary group-hover:text-black group-hover:border-primary transition-all duration-300 shadow-sm group-active:scale-90">
                        <Plus size={18} strokeWidth={3} />
                    </div>
                </div>
            </div>

            {/* Success Overlay - Instant Feedback */}
            {isJustAdded && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px] animate-in fade-in duration-150 pointer-events-none">
                    <div className="bg-primary text-primary-fg rounded-2xl p-5 shadow-2xl animate-in zoom-in-50 duration-200 border-2 border-white/20 pointer-events-none">
                        <Check size={40} strokeWidth={4} />
                    </div>
                </div>
            )}
        </button>
    );
});
