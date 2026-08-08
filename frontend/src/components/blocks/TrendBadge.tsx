/**
 * TrendBadge — شارة مؤشر النسبة والاتجاه المالي (موجب/سالب)
 */
import React, { memo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendBadgeProps {
    value: number;
    suffix?: string;
    showIcon?: boolean;
    className?: string;
}

export const TrendBadge = memo(({ value, suffix = '%', showIcon = true, className = '' }: TrendBadgeProps) => {
    const isPositive = value > 0;
    const isNegative = value < 0;

    const colorClass = isPositive
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
        : isNegative
        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
        : 'bg-surface-hover text-text-muted border-border';

    const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold font-mono ${colorClass} ${className}`}>
            {showIcon && <Icon size={12} className="shrink-0" />}
            <span>{isPositive ? `+${value.toFixed(1)}` : value.toFixed(1)}{suffix}</span>
        </span>
    );
});

TrendBadge.displayName = 'TrendBadge';
