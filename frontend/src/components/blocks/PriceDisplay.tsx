/**
 * PriceDisplay — بلوك عرض المبالغ والأسعار المحاسبية الموحد
 * يعرض المبالغ النقدية بخط Mono عريض مع رمز العملة واللون المناسب
 */
import React, { memo } from 'react';
import { formatCurrency } from '../../core/utils';

export type PriceVariant = 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'muted';
export type PriceSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface PriceDisplayProps {
    amount: number;
    currency?: string;
    variant?: PriceVariant;
    size?: PriceSize;
    showSign?: boolean;
    className?: string;
}

const variantColors: Record<PriceVariant, string> = {
    default: 'text-text-main',
    primary: 'text-primary',
    success: 'text-emerald-500 dark:text-emerald-400',
    danger: 'text-rose-500 dark:text-rose-400',
    warning: 'text-amber-500 dark:text-amber-400',
    muted: 'text-text-muted',
};

const sizeClasses: Record<PriceSize, string> = {
    sm: 'text-xs font-bold',
    md: 'text-sm font-black',
    lg: 'text-lg font-black',
    xl: 'text-2xl font-black',
    '2xl': 'text-3xl font-black',
};

export const PriceDisplay = memo(({
    amount,
    currency = 'IQD',
    variant = 'default',
    size = 'md',
    showSign = false,
    className = '',
}: PriceDisplayProps) => {
    const formatted = formatCurrency(Math.abs(amount), currency);
    const sign = showSign && amount > 0 ? '+' : amount < 0 ? '-' : '';

    return (
        <span className={`font-mono tracking-tight whitespace-nowrap inline-flex items-baseline gap-1 ${variantColors[variant]} ${sizeClasses[size]} ${className}`}>
            {sign && <span>{sign}</span>}
            <span>{formatted}</span>
        </span>
    );
});

PriceDisplay.displayName = 'PriceDisplay';
