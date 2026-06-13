/**
 * ProductPagination - Footer pagination controls
 */
import React, { memo } from 'react';
import { ArrowRight } from 'lucide-react';

interface ProductPaginationProps {
    page: number;
    pageSize: number;
    totalRecords: number;
    currentCount: number;
    onPageChange: (page: number) => void;
}

export const ProductPagination = memo(({
    page,
    pageSize,
    totalRecords,
    currentCount,
    onPageChange
}: ProductPaginationProps) => (
    <div className="shrink-0 py-3 flex items-center justify-between border-t border-border px-4 bg-surface rounded-b-xl backdrop-blur-sm">
        <span className="text-[10px] text-text-muted font-mono flex items-center gap-2 font-bold">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]"></div>
            Showing {currentCount} of {totalRecords} records
        </span>
        <div className="flex items-center gap-2">
            <button
                disabled={page === 0}
                onClick={() => onPageChange(Math.max(0, page - 1))}
                className="p-2 bg-bg border border-border rounded-xl text-text-main hover:bg-surface-hover disabled:opacity-30 transition-colors"
                title="الصفحة السابقة"
            >
                <ArrowRight size={16} className="rotate-180" />
            </button>
            <span className="text-xs font-bold text-text-main min-w-[32px] text-center bg-bg py-2 rounded-xl border border-border">
                {page + 1}
            </span>
            <button
                disabled={(page + 1) * pageSize >= totalRecords}
                onClick={() => onPageChange(page + 1)}
                className="p-2 bg-bg border border-border rounded-xl text-text-main hover:bg-surface-hover disabled:opacity-30 transition-colors"
                title="الصفحة التالية"
            >
                <ArrowRight size={16} />
            </button>
        </div>
    </div>
));

ProductPagination.displayName = 'ProductPagination';
