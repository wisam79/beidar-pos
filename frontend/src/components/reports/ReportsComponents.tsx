// ═══════════════════════════════════════════════════════════════════════════════
// 📊 Reports Helper Components
// Extracted from Reports.tsx for better code organization and bundle optimization
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '../../core/utils';

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
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40 hover:shadow-blue-500/10',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-emerald-500/10',
    red: 'text-red-500 bg-red-500/10 border-red-500/20 hover:border-red-500/40 hover:shadow-red-500/10',
    purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40 hover:shadow-purple-500/10',
};

export const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, subtext, trend, color }) => {
    const colorClasses = metricCardColors[color];
    const [textColor, bgColor, ...borderClasses] = colorClasses.split(' ');

    return (
        <div className={`bg-surface border rounded-2xl p-5 flex items-center gap-4 transition-all hover:shadow-lg group ${borderClasses.join(' ')}`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${textColor} ${bgColor}`}>
                {icon}
            </div>
            <div className="flex-1">
                <p className="text-[10px] font-bold text-text-muted uppercase">{label}</p>
                <p className={`font-mono font-black text-xl ${textColor}`}>{value}</p>
                {subtext && (
                    <p className="text-[10px] text-text-muted font-medium flex items-center gap-1 mt-0.5">
                        {trend === 'up' && <ArrowUpRight size={10} className="text-emerald-500" />}
                        {trend === 'down' && <ArrowDownRight size={10} className="text-red-500" />}
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
            px-5 py-3 rounded-xl text-sm font-bold transition-all touch-target active:scale-95
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
    1: 'bg-amber-500 text-black',
    2: 'bg-gray-400 text-black',
    3: 'bg-orange-700 text-white',
};

export const CustomerRank: React.FC<CustomerRankProps> = ({ rank, name, total, currency = 'IQD' }) => {
    return (
        <div className="flex justify-between items-center bg-bg p-3.5 rounded-xl border border-border hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${rankColors[rank as keyof typeof rankColors] || 'bg-surface-hover text-text-muted'}`}>
                    {rank}
                </div>
                <span className="text-text-main text-sm font-bold">{name}</span>
            </div>
            <span className="text-primary font-bold text-sm font-mono">
                {formatCurrency(total, currency).replace(currency, '')}
            </span>
        </div>
    );
};
