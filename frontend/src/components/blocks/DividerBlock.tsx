/**
 * DividerBlock — الفاصل البصري الموحد مع عنوان أو شارة فرعية
 */
import React, { memo } from 'react';

interface DividerBlockProps {
    label?: string;
    badge?: React.ReactNode;
    orientation?: 'horizontal' | 'vertical';
    className?: string;
}

export const DividerBlock = memo(({
    label,
    badge,
    orientation = 'horizontal',
    className = '',
}: DividerBlockProps) => {
    if (orientation === 'vertical') {
        return <div className={`w-px h-full bg-border shrink-0 ${className}`} />;
    }

    if (!label && !badge) {
        return <div className={`w-full h-px bg-border shrink-0 my-3 ${className}`} />;
    }

    return (
        <div className={`w-full flex items-center gap-3 my-3 select-none ${className}`}>
            <div className="flex-1 h-px bg-border" />
            {label && <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{label}</span>}
            {badge}
            <div className="flex-1 h-px bg-border" />
        </div>
    );
});

DividerBlock.displayName = 'DividerBlock';
