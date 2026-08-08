/**
 * StatsGrid + StatCard — بطاقات الإحصائيات الموحدة
 * يستبدل 4 أنماط مختلفة (Dashboard, Finance, Invoices, Customers)
 */
import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from '../ds';

// ═══════════════════════════════════════════════════════
//  StatCard Colors
// ═══════════════════════════════════════════════════════

export type StatColor = 'emerald' | 'blue' | 'red' | 'orange' | 'purple' | 'amber' | 'primary';

const colorMap: Record<StatColor, {
    iconBg: string;
    iconBorder: string;
    iconText: string;
    valueText: string;
    hoverBorder: string;
    hoverShadow: string;
}> = {
    emerald: {
        iconBg: 'bg-emerald-500/10',
        iconBorder: 'border-emerald-500/20',
        iconText: 'text-emerald-500',
        valueText: 'text-text-main',
        hoverBorder: 'hover:border-emerald-500/30',
        hoverShadow: 'hover:shadow-emerald-500/5',
    },
    blue: {
        iconBg: 'bg-blue-500/10',
        iconBorder: 'border-blue-500/20',
        iconText: 'text-blue-500',
        valueText: 'text-text-main',
        hoverBorder: 'hover:border-blue-500/30',
        hoverShadow: 'hover:shadow-blue-500/5',
    },
    red: {
        iconBg: 'bg-red-500/10',
        iconBorder: 'border-red-500/20',
        iconText: 'text-red-500',
        valueText: 'text-text-main',
        hoverBorder: 'hover:border-red-500/30',
        hoverShadow: 'hover:shadow-red-500/5',
    },
    orange: {
        iconBg: 'bg-orange-500/10',
        iconBorder: 'border-orange-500/20',
        iconText: 'text-orange-500',
        valueText: 'text-text-main',
        hoverBorder: 'hover:border-orange-500/30',
        hoverShadow: 'hover:shadow-orange-500/5',
    },
    purple: {
        iconBg: 'bg-purple-500/10',
        iconBorder: 'border-purple-500/20',
        iconText: 'text-purple-500',
        valueText: 'text-text-main',
        hoverBorder: 'hover:border-purple-500/30',
        hoverShadow: 'hover:shadow-purple-500/5',
    },
    amber: {
        iconBg: 'bg-amber-500/10',
        iconBorder: 'border-amber-500/20',
        iconText: 'text-amber-500',
        valueText: 'text-text-main',
        hoverBorder: 'hover:border-amber-500/30',
        hoverShadow: 'hover:shadow-amber-500/5',
    },
    primary: {
        iconBg: 'bg-primary/10',
        iconBorder: 'border-primary/20',
        iconText: 'text-primary',
        valueText: 'text-text-main',
        hoverBorder: 'hover:border-primary/30',
        hoverShadow: 'hover:shadow-primary/5',
    },
};

// ═══════════════════════════════════════════════════════
//  StatCard Component
// ═══════════════════════════════════════════════════════

interface StatCardProps {
    icon: LucideIcon;
    label: string;
    value: React.ReactNode;
    color?: StatColor;
    /** Small text below value (e.g., "margin: 12.5%") */
    subtitle?: string;
    /** Trend badge (e.g., "+12%") */
    trend?: React.ReactNode;
    /** Make the entire card clickable */
    onClick?: () => void;
    /** Extra children rendered below the value */
    children?: React.ReactNode;
}

export const StatCard = memo(({
    icon: Icon,
    label,
    value,
    color = 'primary',
    subtitle,
    trend,
    onClick,
    children,
}: StatCardProps) => {
    const c = colorMap[color];

    return (
        <div
            onClick={onClick}
            className={`
                bg-surface rounded-2xl p-4 sm:p-5 flex items-center gap-4 group transition-colors duration-150 select-none
                border border-border/80 hover:border-border
                ${onClick ? 'cursor-pointer active:scale-[0.98] touch-target' : ''}
            `}
        >
            {/* Icon Pod */}
            <div className={`w-12 h-12 rounded-xl ${c.iconBg} border ${c.iconBorder} flex items-center justify-center shrink-0`}>
                <Icon size={22} className={c.iconText} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 text-start">
                <span className="text-xs font-extrabold text-text-muted block leading-tight tracking-tight">{label}</span>
                <div className="flex items-center justify-start gap-2.5 mt-1">
                    <span className={`font-mono font-black text-2xl ${c.valueText} leading-none tracking-tight`}>{value}</span>
                    {trend}
                </div>
                {subtitle && <span className="text-[11px] text-text-muted font-semibold block mt-1">{subtitle}</span>}
                {children}
            </div>
        </div>
    );
});
StatCard.displayName = 'StatCard';

// ═══════════════════════════════════════════════════════
//  StatsGrid Container
// ═══════════════════════════════════════════════════════

interface StatsGridProps {
    children: React.ReactNode;
    /** Number of columns on large screens (default 4) */
    columns?: 2 | 3 | 4;
    /** Show/hide the grid */
    visible?: boolean;
    className?: string;
}

const colClasses: Record<number, string> = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4',
};

export const StatsGrid = memo(({ children, columns = 4, visible = true, className = '' }: StatsGridProps) => {
    if (!visible) return null;

    return (
        <div className={`grid ${colClasses[columns]} gap-4 shrink-0 ${className}`}>
            {children}
        </div>
    );
});
StatsGrid.displayName = 'StatsGrid';

// ═══════════════════════════════════════════════════════
//  MiniCard Component - Touch-Optimized Compact Tile
// ═══════════════════════════════════════════════════════

export interface MiniCardProps {
    icon?: LucideIcon;
    label: string;
    value: React.ReactNode;
    subtitle?: string;
    badge?: React.ReactNode;
    color?: StatColor;
    onClick?: () => void;
    active?: boolean;
    className?: string;
}

export const MiniCard = memo(({
    icon: Icon,
    label,
    value,
    subtitle,
    badge,
    color = 'primary',
    onClick,
    active,
    className = ''
}: MiniCardProps) => {
    const c = colorMap[color];

    return (
        <div
            onClick={onClick}
            className={`
                bg-surface border rounded-2xl p-3.5 flex items-center justify-between gap-3 
                select-none transition-colors duration-150 relative overflow-hidden
                ${active
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-border/80 hover:border-border hover:bg-surface-hover/60'
                }
                ${onClick ? 'cursor-pointer active:scale-[0.98] min-h-[48px]' : ''}
                ${className}
            `}
        >
            <div className="flex items-center gap-3 min-w-0">
                {Icon && (
                    <div className={`w-9 h-9 rounded-xl ${c.iconBg} border ${c.iconBorder} flex items-center justify-center shrink-0`}>
                        <Icon size={18} className={c.iconText} />
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-[11px] font-extrabold text-text-muted truncate leading-tight">{label}</p>

                    <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="font-mono font-black text-sm sm:text-base text-text-main leading-tight truncate">
                            {value}
                        </span>
                        {subtitle && (
                            <span className="text-[10px] text-text-muted font-bold truncate">{subtitle}</span>
                        )}
                    </div>
                </div>
            </div>

            {badge && (
                <div className="shrink-0">
                    {badge}
                </div>
            )}
        </div>
    );
});
MiniCard.displayName = 'MiniCard';
