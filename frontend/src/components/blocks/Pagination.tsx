/**
 * Pagination — التنقل بين الصفحات الموحد
 * يستبدل pagination في Invoices, Inventory, Products
 */
import React, { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    page: number;
    totalPages?: number;
    totalRecords?: number;
    pageSize?: number;
    onPageChange: (page: number) => void;
    className?: string;
}

export const Pagination = memo(({
    page,
    totalPages,
    totalRecords,
    pageSize,
    onPageChange,
    className = '',
}: PaginationProps) => {
    const computedTotalPages = totalPages ?? (totalRecords && pageSize ? Math.ceil(totalRecords / pageSize) : 1);
    const isFirstPage = page === 0;
    const isLastPage = computedTotalPages ? page >= computedTotalPages - 1 : false;

    return (
        <div className={`shrink-0 py-3 flex items-center justify-center border-t border-border px-4 bg-surface ${className}`}>
            <div className="flex items-center gap-2">
                <button
                    disabled={isFirstPage}
                    onClick={() => onPageChange(Math.max(0, page - 1))}
                    className="p-2.5 bg-bg border border-border rounded-xl text-text-main hover:bg-surface-hover disabled:opacity-30 transition-colors touch-target active:scale-95"
                    title="الصفحة السابقة"
                >
                    <ChevronRight size={18} />
                </button>
                <span className="text-sm font-bold text-text-main min-w-[40px] text-center bg-bg py-2 rounded-xl border border-border">
                    {page + 1}
                </span>
                <button
                    disabled={isLastPage}
                    onClick={() => onPageChange(page + 1)}
                    className="p-2.5 bg-bg border border-border rounded-xl text-text-main hover:bg-surface-hover disabled:opacity-30 transition-colors touch-target active:scale-95"
                    title="الصفحة التالية"
                >
                    <ChevronLeft size={18} />
                </button>
            </div>
        </div>
    );
});
Pagination.displayName = 'Pagination';
