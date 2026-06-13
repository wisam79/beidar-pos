/**
 * ProductStats - Premium product statistics cards
 * Displays total products, cost value, sell value, and expected profit
 */
import React, { memo } from 'react';
import { Package, DollarSign, Tag, Calculator } from 'lucide-react';
import { formatCurrency } from '../../../core/utils';
import { StatsGrid, StatCard } from '../../../components/blocks';

interface ProductStatsProps {
    totalRecords: number;
    stats: {
        totalStock: number;
        totalValue: number;
        totalCost: number;
        profit: number;
    };
    currency: string;
}

export const ProductStats = memo(({ totalRecords, stats, currency }: ProductStatsProps) => (
    <StatsGrid columns={4}>
        <StatCard
            label="إجمالي المنتجات"
            value={totalRecords}
            icon={Package}
            color="blue"
        />
        <StatCard
            label="قيمة المخزون (شراء)"
            value={formatCurrency(stats.totalCost, currency).replace(currency, '')}
            icon={DollarSign}
            color="blue"
            subtitle={currency}
        />
        <StatCard
            label="قيمة المخزون (بيع)"
            value={formatCurrency(stats.totalValue, currency).replace(currency, '')}
            icon={Tag}
            color="emerald"
            subtitle={currency}
        />
        <StatCard
            label="الأرباح المتوقعة"
            value={formatCurrency(stats.profit, currency).replace(currency, '')}
            icon={Calculator}
            color="purple"
            subtitle={currency}
        />
    </StatsGrid>
));

ProductStats.displayName = 'ProductStats';
