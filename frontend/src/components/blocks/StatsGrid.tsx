/**
 * StatsGrid + StatCard — بطاقات الإحصائيات الموحدة
 * يستبدل 4 أنماط مختلفة (Dashboard, Finance, Invoices, Customers)
 */
import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════
//  StatCard Colors
// ═══════════════════════════════════════════════════════

type StatColor = 'emerald' | 'blue' | 'red' | 'orange' | 'purple' | 'amber' | 'primary';

type StatColorStyle = {
    iconBg: string;
    iconBorder: string;
    iconText: string;
    hoverBorder: string;
    hoverShadow: string;
};

const success: StatColorStyle = {
    iconBg: 'bg-success/10',
    iconBorder: 'border-success/20',
    iconText: 'text-success',
    hoverBorder: 'hover:border-success/30',
    hoverShadow: 'hover:shadow-success/5',
};

const primary: StatColorStyle = {
    iconBg: 'bg-primary/10',
    iconBorder: 'border-primary/20',
    iconText: 'text-primary',
    hoverBorder: 'hover:border-primary/30',
    hoverShadow: 'hover:shadow-primary/5',
};

const danger: StatColorStyle = {
    iconBg: 'bg-danger/10',
    iconBorder: 'border-danger/20',
    iconText: 'text-danger',
    hoverBorder: 'hover:border-danger/30',
    hoverShadow: 'hover:shadow-danger/5',
};

const warning: StatColorStyle = {
    iconBg: 'bg-warning/10',
    iconBorder: 'border-warning/20',
    iconText: 'text-warning',
    hoverBorder: 'hover:border-warning/30',
    hoverShadow: 'hover:shadow-warning/5',
};

const colorMap: Record<StatColor, StatColorStyle> = {
    emerald: success,
    blue: primary,
    red: danger,
    orange: warning,
    purple: primary,
    amber: warning,
    primary,
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
                bg-surface rounded-2xl p-3.5 flex items-center gap-3 group transition-colors duration-150 select-none
                border border-border/80 hover:border-border
                ${onClick ? 'cursor-pointer active:scale-[0.98] touch-target' : ''}
            `}
        >
            {/* Icon Pod */}
            <div className={`w-10 h-10 rounded-xl ${c.iconBg} border ${c.iconBorder} flex items-center justify-center shrink-0`}>
                <Icon size={20} className={c.iconText} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 text-start">
                <span className="text-xs font-extrabold text-text-muted block leading-tight tracking-tight">{label}</span>
                <div className="flex items-center justify-start gap-2.5 mt-1">
                    <span className="font-mono font-black text-xl text-text-main leading-none tracking-tight">{value}</span>
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
