
import React, { memo } from 'react';
import { ProductCard } from '../ProductCard';
import { Product } from '../../core/types';
import { VirtualItem, Virtualizer } from '@tanstack/react-virtual';

interface ProductGridViewProps {
    virtualItems: VirtualItem[];
    products: Product[];
    columns: number;
    selectedIds: string[];
    currency: string;
    onToggleSelect: (id: string) => void;
    onEditProduct: (product: Product) => void;
    onAddToPrintQueue: (product: Product, qty: number) => void;
    rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
}

export const ProductGridView = memo(({
    virtualItems,
    products,
    columns,
    selectedIds,
    currency,
    onToggleSelect,
    onEditProduct,
    onAddToPrintQueue,
    rowVirtualizer
}: ProductGridViewProps) => {

    return (
        <div
            style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
            }}
        >
            {virtualItems.map((virtualRow) => {
                const startIndex = virtualRow.index * columns;
                const endIndex = startIndex + columns;
                const rowItems = products.slice(startIndex, endIndex);

                return (
                    <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                            display: 'grid',
                            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                        }}
                        className="gap-3 px-1 pb-3"
                    >
                        {rowItems.map(p => (
                            <div key={p.id} className="relative group animate-in fade-in duration-300">
                                <div className={`absolute top-3 right-3 z-20 transition-all duration-200 ${p.id && selectedIds.includes(p.id) ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}`}>
                                    <input
                                        type="checkbox"
                                        checked={p.id ? selectedIds.includes(p.id) : false}
                                        onChange={() => p.id && onToggleSelect(p.id)}
                                        className="w-5 h-5 rounded-lg accent-primary cursor-pointer shadow-lg border-2 border-white/50"
                                        aria-label="تحديد المنتج"
                                    />
                                </div>
                                <ProductCard
                                    product={p}
                                    onClick={onEditProduct}
                                    onPrint={(e) => { e.stopPropagation(); onAddToPrintQueue(p, 1); }}
                                    currency={currency}
                                />
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
});

ProductGridView.displayName = 'ProductGridView';
