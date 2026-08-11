/**
 * BulkActions - Bulk selection actions bar for products
 */
import React, { memo } from 'react';
import { Check } from 'lucide-react';

interface BulkActionsProps {
    selectedCount: number;
    onPrintSelected: () => void;
    onDeleteSelected: () => void;
    onClearSelection: () => void;
}

export const BulkActions = memo(({
    selectedCount,
    onPrintSelected,
    onDeleteSelected,
    onClearSelection
}: BulkActionsProps) => {
    if (selectedCount === 0) return null;

    return (
        <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl flex justify-between items-center animate-in slide-in-from-top-2">
            <span className="text-primary font-bold text-xs flex items-center gap-2">
                <Check size={14} /> تم تحديد {selectedCount} منتج
            </span>
            <div className="flex gap-2">
                <button
                    onClick={onPrintSelected}
                    className="px-3 py-1.5 bg-primary/20 text-primary rounded-lg text-xs font-bold hover:bg-primary hover:text-primary-fg transition-colors"
                >
                    طباعة المحدد
                </button>
                <button
                    onClick={onDeleteSelected}
                    className="px-3 py-1.5 bg-danger/10 text-danger rounded-lg text-xs font-bold hover:bg-danger hover:text-white transition-colors"
                >
                    حذف المحدد
                </button>
                <button
                    onClick={onClearSelection}
                    className="px-3 py-1.5 bg-surface text-text-muted rounded-lg text-xs font-bold hover:bg-surface-hover hover:text-text-main transition-colors"
                >
                    إلغاء
                </button>
            </div>
        </div>
    );
});

BulkActions.displayName = 'BulkActions';
