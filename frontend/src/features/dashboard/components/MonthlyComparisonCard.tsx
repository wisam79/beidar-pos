import React, { memo } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AnimatedNumber } from '../../../components/ui';
import { MonthData } from '../../../hooks/useMonthlyComparison';

interface MonthlyComparisonCardProps {
    currentMonth: MonthData;
    previousMonth: MonthData;
    revenueChange: number;
    ordersChange: number;
    profitChange: number;
    currency?: string;
    isLoading?: boolean;
}

const TrendBadge = ({ percent }: { percent: number }) => {
    const isPositive = percent > 0;
    const isNeutral = percent === 0;
    const colorClass = isPositive ? 'text-emerald-500 bg-emerald-500/10' : isNeutral ? 'text-gray-500 bg-gray-500/10' : 'text-red-500 bg-red-500/10';
    const Icon = isPositive ? ArrowUpRight : isNeutral ? Minus : ArrowDownRight;

    return (
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${colorClass}`}>
            <Icon size={12} />
            <span>{Math.abs(percent).toFixed(1)}%</span>
        </div>
    );
};

export const MonthlyComparisonCard = memo(({
    currentMonth,
    revenueChange,
    ordersChange,
    profitChange,
    currency = 'IQD',
    isLoading
}: MonthlyComparisonCardProps) => {
    if (isLoading) return <div className="animate-pulse h-32 bg-gray-200/5 rounded-xl" />;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                    <TrendingUp size={16} className="text-primary" />
                    الأداء الشهري
                </h3>
                <span className="text-[10px] text-text-muted bg-bg px-2 py-1 rounded-full border border-border">
                    مقارنة بالشهر السابق
                </span>
            </div>

            <div className="space-y-3">
                {/* Revenue */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-bg border border-border/50 hover:border-border transition-colors">
                    <div>
                        <p className="text-[10px] text-text-muted mb-0.5">الإيرادات</p>
                        <p className="text-sm font-bold text-text-main font-mono">
                            <AnimatedNumber value={currentMonth.revenue} /> <span className="text-[9px] text-text-muted">{currency}</span>
                        </p>
                    </div>
                    <TrendBadge percent={revenueChange} />
                </div>

                {/* Profit */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-bg border border-border/50 hover:border-border transition-colors">
                    <div>
                        <p className="text-[10px] text-text-muted mb-0.5">صافي الربح</p>
                        <p className="text-sm font-bold text-text-main font-mono">
                            <AnimatedNumber value={currentMonth.netProfit} /> <span className="text-[9px] text-text-muted">{currency}</span>
                        </p>
                    </div>
                    <TrendBadge percent={profitChange} />
                </div>

                {/* Orders */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-bg border border-border/50 hover:border-border transition-colors">
                    <div>
                        <p className="text-[10px] text-text-muted mb-0.5">الطلبات</p>
                        <p className="text-sm font-bold text-text-main font-mono">
                            <AnimatedNumber value={currentMonth.orders} /> <span className="text-[9px] text-text-muted">طلب</span>
                        </p>
                    </div>
                    <TrendBadge percent={ordersChange} />
                </div>
            </div>
        </div>
    );
});

MonthlyComparisonCard.displayName = 'MonthlyComparisonCard';
