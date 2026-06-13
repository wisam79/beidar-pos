/**
 * Dashboard.tsx - Desktop POS Command Center
 * 
 * Redesigned with a desktop-first approach:
 * - Information density over whitespace
 * - Compact stats bar instead of large cards
 * - Dominant chart for data visualization
 * - Toolbar-style quick actions
 * - Integrated transaction list sidebar
 */
import React, { useState } from 'react';
import {
    LayoutDashboard,
    Wallet,
    ShoppingCart,
    Package,
    AlertTriangle,
    Clock,
    BarChart3,
    Zap,
    Plus,
    UserPlus,
    FileText,
    Sparkles,
    TrendingUp,
    TrendingDown,
    Trophy,
    Users,
    ChevronLeft,
    Activity
} from 'lucide-react';
import { AppPreferences, View } from '../core/types';
import { SalesAreaChart } from '../components/charts';
import { AnimatedNumber } from '../components/ui';
import { useDashboardStats, useMonthlyComparison } from '../hooks';
import { TransactionCard } from '../components/dashboard';
import { formatCurrency } from '../core/utils';
import { PageShell, StatsGrid, StatCard, SegmentedControl } from '../components/blocks';

// ============ Configuration ============
const timeRangeMap: Record<string, string> = {
    'يوم': 'day',
    'أسبوع': 'week',
    'شهر': 'month',
};

interface DashboardProps {
    prefs: AppPreferences;
    setView: (v: View) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ prefs, setView }) => {
    const [chartFilter, setChartFilter] = useState('أسبوع');
    const { stats } = useDashboardStats(timeRangeMap[chartFilter] || 'week');
    const { comparison } = useMonthlyComparison();
    const currency = prefs?.currency || 'IQD';

    const revImp = comparison.revenueChange || 0;
    const ordImp = comparison.ordersChange || 0;

    // Quick action handler
    const handleQuickAction = (view: View, action?: string) => {
        if (action) sessionStorage.setItem('pendingAction', action);
        setView(view);
    };

    return (
        <PageShell className="p-3 lg:p-4">

            {/* ═══════════════════════════════════════════════════════════════
                1. HEADER BAR - Compact & Functional
            ═══════════════════════════════════════════════════════════════ */}
            <header className="shrink-0 flex items-center justify-between gap-4 bg-surface/80 backdrop-blur-sm border border-border rounded-2xl px-4 py-2.5 shadow-sm">
                {/* Left: Title */}
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <LayoutDashboard size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-text-main">لوحة القيادة</h1>
                        <p className="text-xs text-text-muted">مركز التحكم الرئيسي</p>
                    </div>
                </div>

                {/* Center: Time Range Filter */}
                <SegmentedControl
                    options={Object.keys(timeRangeMap).map(k => ({ id: k, label: k }))}
                    value={chartFilter}
                    onChange={setChartFilter}
                />

                {/* Right: AI Button */}
                <button
                    onClick={() => setView('reports')}
                    className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                >
                    <Sparkles size={16} className="text-yellow-300" />
                    <span className="font-bold text-sm">المستشار الذكي</span>
                </button>
            </header>

            {/* ═══════════════════════════════════════════════════════════════
                2. STATS BAR - Compact Horizontal Pills
            ═══════════════════════════════════════════════════════════════ */}
            <StatsGrid columns={4}>
                <StatCard icon={Wallet} label="الإيرادات" value={<AnimatedNumber value={stats.dailyRevenue} />} color="emerald" onClick={() => setView('finance')} trend={
                    <span className={`text-xs font-bold flex items-center ${revImp >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {revImp >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(revImp).toFixed(0)}%
                    </span>
                } />
                <StatCard icon={ShoppingCart} label="الطلبات" value={stats.dailyOrders} color="blue" onClick={() => setView('invoices')} trend={
                    <span className={`text-xs font-bold flex items-center ${ordImp >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {ordImp >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(ordImp).toFixed(0)}%
                    </span>
                } />
                <StatCard icon={Package} label="المنتجات" value={stats.totalProducts} color="primary" onClick={() => setView('products')} />
                <StatCard icon={AlertTriangle} label="التنبيهات" value={stats.lowStockCount} color={stats.lowStockCount > 0 ? 'red' : 'emerald'} onClick={() => setView('inventory')} />
            </StatsGrid>

            {/* ═══════════════════════════════════════════════════════════════
                3. MAIN CONTENT GRID
            ═══════════════════════════════════════════════════════════════ */}
            <div className="flex-1 min-h-0 grid grid-cols-12 gap-3">

                {/* LEFT: Chart + Quick Actions */}
                <div className="col-span-8 flex flex-col gap-3 min-h-0">

                    {/* Chart */}
                    <div className="flex-1 bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-3 shrink-0">
                            <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                                <BarChart3 size={18} className="text-primary" />
                                تحليل الإيرادات
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-medium text-text-muted bg-surface-active px-2 py-1 rounded-lg border border-border">
                                <Activity size={12} className="text-primary animate-pulse" />
                                بيانات حية
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            <SalesAreaChart data={stats.chartData} />
                        </div>
                    </div>

                    {/* Quick Actions Toolbar */}
                    <div className="shrink-0 flex items-center gap-2 bg-surface border border-border rounded-xl p-2 shadow-sm">
                        <span className="text-xs text-text-muted font-medium px-2">إجراءات سريعة:</span>
                        <button
                            onClick={() => handleQuickAction('sales')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-fg font-bold text-sm shadow-sm hover:shadow-md hover:shadow-primary/20 hover:-translate-y-0.5 transition-all duration-150"
                        >
                            <Zap size={16} />
                            بيع سريع
                        </button>
                        <button
                            onClick={() => handleQuickAction('products', 'openAddModal')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg/80 dark:bg-white/5 text-text-main border border-border/80 dark:border-white/10 font-bold text-sm shadow-sm hover:shadow-md hover:bg-bg dark:hover:bg-white/10 hover:-translate-y-0.5 transition-all duration-150"
                        >
                            <Plus size={16} />
                            مادة جديدة
                        </button>
                        <button
                            onClick={() => handleQuickAction('customers', 'openAddModal')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg/80 dark:bg-white/5 text-text-main border border-border/80 dark:border-white/10 font-bold text-sm shadow-sm hover:shadow-md hover:bg-bg dark:hover:bg-white/10 hover:-translate-y-0.5 transition-all duration-150"
                        >
                            <UserPlus size={16} />
                            عميل جديد
                        </button>
                        <button
                            onClick={() => handleQuickAction('reports')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg/80 dark:bg-white/5 text-text-main border border-border/80 dark:border-white/10 font-bold text-sm shadow-sm hover:shadow-md hover:bg-bg dark:hover:bg-white/10 hover:-translate-y-0.5 transition-all duration-150"
                        >
                            <FileText size={16} />
                            التقارير
                        </button>
                    </div>
                </div>

                {/* RIGHT: Widgets Column */}
                <div className="col-span-4 flex flex-col gap-3 min-h-0">

                    {/* Recent Transactions */}
                    <div className="flex-1 bg-surface border border-border rounded-xl shadow-sm flex flex-col min-h-0 overflow-hidden">
                        <div className="p-3 border-b border-border flex items-center justify-between shrink-0 bg-surface-active/30">
                            <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                                <Clock size={16} className="text-primary" />
                                أحدث المعاملات
                            </h3>
                            <button onClick={() => setView('invoices')} className="text-xs font-bold text-primary hover:underline">
                                عرض الكل
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                            {stats.recentSales.length > 0 ? (
                                stats.recentSales.slice(0, 10).map((sale) => (
                                    <TransactionCard key={sale.id} sale={sale} onClick={() => setView('invoices')} currency={currency} />
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center p-4 opacity-50">
                                    <Clock size={28} className="text-text-muted mb-2" />
                                    <p className="text-sm text-text-muted">لا توجد معاملات حديثة</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Selling & Top Customers - Stacked */}
                    <div className="shrink-0 grid grid-cols-2 gap-3">
                        {/* Top Selling */}
                        <div className="bg-surface border border-border rounded-xl p-3 shadow-sm">
                            <h4 className="text-xs font-bold text-text-muted flex items-center gap-1.5 mb-2">
                                <Trophy size={14} className="text-amber-500" />
                                الأكثر مبيعاً
                            </h4>
                            <div className="space-y-1.5">
                                {stats.topSelling?.slice(0, 3).map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : 'bg-orange-700'
                                                }`}>{i + 1}</span>
                                            <span className="text-text-main font-medium truncate max-w-[80px]">{item.label}</span>
                                        </div>
                                        <span className="font-mono font-bold text-primary">{item.value}</span>
                                    </div>
                                )) || <p className="text-xs text-text-muted text-center py-2">لا توجد بيانات</p>}
                            </div>
                        </div>

                        {/* Top Customers */}
                        <div className="bg-surface border border-border rounded-xl p-3 shadow-sm">
                            <h4 className="text-xs font-bold text-text-muted flex items-center gap-1.5 mb-2">
                                <Users size={14} className="text-blue-500" />
                                أفضل العملاء
                            </h4>
                            <div className="space-y-1.5">
                                {stats.topCustomers?.slice(0, 3).map((customer, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold ${i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-blue-400' : 'bg-blue-300'
                                                }`}>{i + 1}</span>
                                            <span className="text-text-main font-medium truncate max-w-[80px]">{customer.name}</span>
                                        </div>
                                        <span className="font-mono font-bold text-emerald-500">{formatCurrency(customer.total, currency)}</span>
                                    </div>
                                )) || <p className="text-xs text-text-muted text-center py-2">لا توجد بيانات</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageShell>
    );
};
