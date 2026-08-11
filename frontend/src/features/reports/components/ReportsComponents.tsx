// ═══════════════════════════════════════════════════════════════════════════════
// 📊 Reports Helper Components
// Extracted from Reports.tsx for better code organization and bundle optimization
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '../../../core/utils';

// ─────────────────────────────────────────────────────────────────────────────────
// MetricCard Component
// ─────────────────────────────────────────────────────────────────────────────────

export interface MetricCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    subtext?: string;
    trend?: 'up' | 'down' | 'neutral';
    color: 'blue' | 'emerald' | 'red' | 'purple';
}

const metricCardColors = {
    blue: 'text-primary bg-primary/10 border-primary/20 hover:border-primary/40 hover:shadow-primary/10',
    emerald: 'text-success bg-success/10 border-success/20 hover:border-success/40 hover:shadow-success/10',
    red: 'text-danger bg-danger/10 border-danger/20 hover:border-danger/40 hover:shadow-danger/10',
    purple: 'text-primary bg-primary/10 border-primary/20 hover:border-primary/40 hover:shadow-primary/10',
};

export const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, subtext, trend, color }) => {
    const colorClasses = metricCardColors[color];
    const [textColor, bgColor, ...borderClasses] = colorClasses.split(' ');

    return (
        <div className={`bg-surface border rounded-lg p-5 flex items-center gap-4 transition-all hover:shadow-lg group ${borderClasses.join(' ')}`}>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${textColor} ${bgColor}`}>
                {icon}
            </div>
            <div className="flex-1">
                <p className="text-[10px] font-bold text-text-muted uppercase">{label}</p>
                <p className={`font-mono font-black text-xl ${textColor}`}>{value}</p>
                {subtext && (
                    <p className="text-[10px] text-text-muted font-medium flex items-center gap-1 mt-0.5">
                        {trend === 'up' && <ArrowUpRight size={10} className="text-success" />}
                        {trend === 'down' && <ArrowDownRight size={10} className="text-danger" />}
                        {subtext}
                    </p>
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────────
// DateRangeButton Component
// ─────────────────────────────────────────────────────────────────────────────────

export interface DateRangeButtonProps {
    active: boolean;
    label: string;
    onClick: () => void;
}

export const DateRangeButton: React.FC<DateRangeButtonProps> = ({ active, label, onClick }) => (
    <button
        onClick={onClick}
        className={`
            px-5 py-3 rounded-lg text-sm font-bold transition-all touch-target active:scale-95
            ${active
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
            }
        `}
    >
        {label}
    </button>
);

// ─────────────────────────────────────────────────────────────────────────────────
// CustomerRank Component
// ─────────────────────────────────────────────────────────────────────────────────

export interface CustomerRankProps {
    rank: number;
    name: string;
    total: number;
    currency?: string;
}

const rankColors = {
    1: 'bg-warning text-primary-fg',
    2: 'bg-gray-400 text-black',
    3: 'bg-warning text-white',
};

export const CustomerRank: React.FC<CustomerRankProps> = ({ rank, name, total, currency = 'IQD' }) => {
    return (
        <div className="flex justify-between items-center bg-surface-hover/80 p-3.5 rounded-2xl border border-border/40 hover:border-success/30 transition-colors">
            <div className="flex items-center gap-3.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${rankColors[rank as keyof typeof rankColors] || 'bg-surface border border-border text-text-muted'}`}>
                    {rank}
                </div>
                <span className="text-text-main text-sm font-extrabold">{name}</span>
            </div>
            <span className="text-success font-black text-sm font-mono">
                {formatCurrency(total, currency).replace(currency, '')}
            </span>
        </div>
    );
};
