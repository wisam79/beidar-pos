import React, { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ProductCard } from '../../../components/ProductCard';
import { Package } from 'lucide-react';
import { Product } from '../../../core/types';

interface VirtualProductGridProps {
    products: Product[];
    onProductClick: (product: Product) => void;
    justAddedId: string | null;
    onQuickAdd?: () => void;
    currency?: string;
    isWholesale?: boolean;
}

// Fixed card height + gap for accurate virtualization
const CARD_HEIGHT = 230; // ProductCard is 220px + 10px gap
const GAP = 12;

/**
 * Virtualized product grid for smooth scrolling with large product lists
 * Uses @tanstack/react-virtual for efficient rendering
 * Responsive columns: 2 on mobile, 3 on tablet, 4 on desktop, 5 on wide
 */
export const VirtualProductGrid: React.FC<VirtualProductGridProps> = ({
    products,
    onProductClick,
    justAddedId,
    onQuickAdd,
    currency = 'IQD',
    isWholesale = false,
}) => {
    const parentRef = useRef<HTMLDivElement>(null);

    // Get dynamic column count based on container width
    const getColumns = (): number => {
        if (!parentRef.current) return 4;
        const width = parentRef.current.offsetWidth;
        if (width < 400) return 2;
        if (width < 600) return 3;
        if (width < 900) return 4;
        return 5;
    };

    const [columns, setColumns] = React.useState(4);

    // Update columns on resize AND container size changes
    React.useEffect(() => {
        let resizeTimeout: ReturnType<typeof setTimeout>;

        const updateColumns = () => {
            const newCols = getColumns();
            setColumns(prev => (newCols !== prev ? newCols : prev));
        };

        // Debounced resize handler for better performance
        const debouncedUpdate = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(updateColumns, 100);
        };

        // Initial update
        updateColumns();

        // Listen for window resize with debounce
        window.addEventListener('resize', debouncedUpdate);

        // Use ResizeObserver for container size changes (cart expand/collapse)
        const resizeObserver = new ResizeObserver(() => {
            updateColumns();
        });

        if (parentRef.current) {
            resizeObserver.observe(parentRef.current);
        }

        return () => {
            clearTimeout(resizeTimeout);
            window.removeEventListener('resize', debouncedUpdate);
            resizeObserver.disconnect();
        };
    }, []);

    // Calculate rows
    const rowCount = Math.ceil(products.length / columns);

    const rowVirtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => parentRef.current,
        estimateSize: () => CARD_HEIGHT,
        overscan: 2,
        gap: GAP,
    });

    if (products.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center text-text-muted flex flex-col items-center justify-center opacity-50">
                    <Package size={56} className="mb-4 stroke-1" />
                    <p className="text-sm font-bold mb-2">لا توجد منتجات مطابقة</p>
                    {onQuickAdd && (
                        <button
                            onClick={onQuickAdd}
                            className="mt-3 px-5 py-2.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 border border-primary/20 transition-all"
                        >
                            إضافة منتج يدوياً
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            ref={parentRef}
            className="h-full overflow-auto custom-scrollbar p-1"
        >
            <div
                className="w-full relative"
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const startIndex = virtualRow.index * columns;
                    const rowProducts = products.slice(startIndex, startIndex + columns);

                    return (
                        <div
                            key={virtualRow.key}
                            className="absolute top-0 left-0 right-0 grid px-0.5"
                            style={{
                                height: `${CARD_HEIGHT - GAP}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                                gap: `${GAP}px`,
                            }}
                        >
                            {rowProducts.map((product) => (
                                <div key={product.id}>
                                    <ProductCard
                                        product={product}
                                        onClick={() => onProductClick(product)}
                                        isJustAdded={justAddedId === product.id}
                                        currency={currency}
                                        isWholesale={isWholesale}
                                    />
                                </div>
                            ))}
                            {/* Fill empty slots to maintain grid structure */}
                            {rowProducts.length < columns &&
                                Array.from({ length: columns - rowProducts.length }).map((_, i) => (
                                    <div key={`empty-${i}`} className="invisible" />
                                ))
                            }
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
