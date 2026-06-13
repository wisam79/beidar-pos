import React from 'react';

interface SkeletonProps {
    className?: string;
}

/**
 * Premium skeleton loader with subtle animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
    <div
        className={`bg-surface animate-pulse rounded-lg ${className}`}
        style={{
            background: 'linear-gradient(90deg, var(--color-surface) 0%, rgba(var(--color-primary-rgb), 0.05) 50%, var(--color-surface) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite'
        }}
    />
);

/**
 * Product card skeleton for loading states
 */
export const ProductCardSkeleton: React.FC = () => (
    <div className="bg-surface rounded-2xl p-3 border border-border">
        <Skeleton className="w-full h-24 rounded-xl mb-3" />
        <Skeleton className="w-3/4 h-4 rounded mb-2" />
        <Skeleton className="w-1/2 h-3 rounded" />
    </div>
);

/**
 * Table row skeleton for lists
 */
export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
    <div className="flex items-center gap-4 p-4 border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className={`h-4 rounded ${i === 0 ? 'w-24' : 'flex-1'}`} />
        ))}
    </div>
);

/**
 * Card skeleton for dashboard
 */
export const DashboardCardSkeleton: React.FC = () => (
    <div className="bg-surface rounded-2xl p-6 border border-border">
        <div className="flex justify-between items-start mb-4">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="w-16 h-4 rounded" />
        </div>
        <Skeleton className="w-24 h-8 rounded mb-2" />
        <Skeleton className="w-32 h-3 rounded" />
    </div>
);

/**
 * Full page loading with multiple skeletons
 */
export const PageLoadingSkeleton: React.FC<{ type?: 'grid' | 'list' | 'dashboard' }> = ({ type = 'grid' }) => {
    if (type === 'grid') {
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
                {Array.from({ length: 10 }).map((_, i) => (
                    <ProductCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (type === 'list') {
        return (
            <div className="p-4 space-y-1">
                {Array.from({ length: 8 }).map((_, i) => (
                    <TableRowSkeleton key={i} />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <DashboardCardSkeleton key={i} />
            ))}
        </div>
    );
};
