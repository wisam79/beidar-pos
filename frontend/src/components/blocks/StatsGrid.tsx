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
        valueText: 'text-emerald-500',
        hoverBorder: 'hover:border-emerald-500/30',
        hoverShadow: 'hover:shadow-emerald-500/5',
    },
    blue: {
        iconBg: 'bg-blue-500/10',
        iconBorder: 'border-blue-500/20',
        iconText: 'text-blue-500',
        valueText: 'text-blue-500',
        hoverBorder: 'hover:border-blue-500/30',
        hoverShadow: 'hover:shadow-blue-500/5',
    },
    red: {
        iconBg: 'bg-red-500/10',
        iconBorder: 'border-red-500/20',
        iconText: 'text-red-500',
        valueText: 'text-red-500',
        hoverBorder: 'hover:border-red-500/30',
        hoverShadow: 'hover:shadow-red-500/5',
    },
    orange: {
        iconBg: 'bg-orange-500/10',
        iconBorder: 'border-orange-500/20',
        iconText: 'text-orange-500',
        valueText: 'text-orange-500',
        hoverBorder: 'hover:border-orange-500/30',
        hoverShadow: 'hover:shadow-orange-500/5',
    },
    purple: {
        iconBg: 'bg-purple-500/10',
        iconBorder: 'border-purple-500/20',
        iconText: 'text-purple-500',
        valueText: 'text-purple-500',
        hoverBorder: 'hover:border-purple-500/30',
        hoverShadow: 'hover:shadow-purple-500/5',
    },
    amber: {
        iconBg: 'bg-amber-500/10',
        iconBorder: 'border-amber-500/20',
        iconText: 'text-amber-500',
        valueText: 'text-amber-500',
        hoverBorder: 'hover:border-amber-500/30',
        hoverShadow: 'hover:shadow-amber-500/5',
    },
    primary: {
        iconBg: 'bg-primary/10',
        iconBorder: 'border-primary/20',
        iconText: 'text-primary',
        valueText: 'text-primary',
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
        <Card
            onClick={onClick}
            interactive={!!onClick}
            className="p-5 rounded-3xl flex items-center gap-4 group"
        >
            {/* Icon */}
            <div className={`w-12 h-12 rounded-2xl ${c.iconBg} border ${c.iconBorder} flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-sm`}>
                <Icon size={22} className={c.iconText} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 text-start">
                <span className="text-[10px] font-black text-text-muted uppercase block leading-tight tracking-wider">{label}</span>
                <div className="flex items-center justify-start gap-2 mt-1">
                    <span className={`font-mono font-black text-2xl ${c.valueText} leading-none tracking-tight`}>{value}</span>
                    {trend}
                </div>
                {subtitle && <span className="text-[9px] text-text-muted font-bold block mt-1">{subtitle}</span>}
                {children}
            </div>
        </Card>
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
