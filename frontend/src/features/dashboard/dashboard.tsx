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
    Activity
} from 'lucide-react';
import { View } from '../../core/types';
import { SalesAreaChart } from '../../components/charts';
import { AnimatedNumber } from '../../components/ui';
import { useDashboardStats, useMonthlyComparison } from '../../hooks';
import { TransactionCard } from './components';
import { formatCurrency } from '../../core/utils';
import { PageShell, StatsGrid, StatCard, SegmentedControl } from '../../components/blocks';
import { usePreferences } from '../../components/PreferencesContext';
import { useAuth } from '../../core/AuthContext';
import { Card, Button } from '../../components/ds';

// ============ Configuration ============
const timeRangeMap: Record<string, string> = {
    'يوم': 'day',
    'أسبوع': 'week',
    'شهر': 'month',
};

export const Dashboard: React.FC = () => {
    const { prefs, setView } = usePreferences();
    const { currentUser } = useAuth();
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
        <PageShell className="p-0">

            {/* ═══════════════════════════════════════════════════════════════
                1. HEADER BAR - Dribbble Profile & Filter
            ═══════════════════════════════════════════════════════════════ */}
            <div className="shrink-0 flex items-center justify-between gap-4 px-2 select-none">
                {/* Right: Welcome Profile */}
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary font-black text-sm flex items-center justify-center select-none">
                        {currentUser?.username?.substring(0, 2).toUpperCase() || 'US'}
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-bg shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                    </div>
                    <div className="text-right">
                        <h1 className="text-base font-black text-text-main leading-tight tracking-tight">
                            مرحباً، {currentUser?.username || 'المستخدم'} 👋
                        </h1>
                        <p className="text-[10px] text-text-muted font-bold mt-0.5">مركز القيادة والتحكم</p>
                    </div>
                </div>

                {/* Center: Time Range Filter */}
                <SegmentedControl
                    options={Object.keys(timeRangeMap).map(k => ({ id: k, label: k }))}
                    value={chartFilter}
                    onChange={setChartFilter}
                />

                {/* Left: AI Button */}
                <button
                    onClick={() => setView('reports')}
                    className="flex items-center gap-2 bg-gradient-to-r from-primary to-emerald-500 hover:brightness-105 text-black px-4 py-2 rounded-xl transition-all duration-200 font-black text-xs shadow-md shadow-primary/20 hover:scale-105 active:scale-95 touch-target"
                >
                    <Sparkles size={13} className="text-black shrink-0" />
                    <span>المستشار الذكي</span>
                </button>
            </div>

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
                    {/* Chart */}
                    <Card className="flex-1 p-4 shadow-sm flex flex-col min-h-0">
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
                    </Card>

                    {/* Quick Actions Toolbar */}
                    <div className="shrink-0 flex items-center gap-2 p-1.5 bg-surface-active/10 border border-border rounded-xl">
                        <span className="text-xs text-text-muted font-black px-2">إجراءات سريعة:</span>
                        <Button
                            onClick={() => handleQuickAction('sales')}
                            variant="primary"
                            size="sm"
                            icon={Zap}
                        >
                            بيع سريع
                        </Button>
                        <Button
                            onClick={() => handleQuickAction('products', 'openAddModal')}
                            variant="secondary"
                            size="sm"
                            icon={Plus}
                        >
                            مادة جديدة
                        </Button>
                        <Button
                            onClick={() => handleQuickAction('customers', 'openAddModal')}
                            variant="secondary"
                            size="sm"
                            icon={UserPlus}
                        >
                            عميل جديد
                        </Button>
                        <Button
                            onClick={() => handleQuickAction('reports')}
                            variant="secondary"
                            size="sm"
                            icon={FileText}
                        >
                            التقارير
                        </Button>
                    </div>
                </div>

                {/* RIGHT: Widgets Column */}
                <div className="col-span-4 flex flex-col gap-3 min-h-0">

                    {/* Recent Transactions */}
                    {/* Recent Transactions */}
                    <Card className="flex-1 shadow-sm flex flex-col min-h-0 overflow-hidden">
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
                    </Card>

                    {/* Top Selling & Top Customers - Stacked */}
                    <div className="shrink-0 grid grid-cols-2 gap-3">
                        {/* Top Selling */}
                        <Card className="p-3 shadow-sm">
                            <h4 className="text-xs font-bold text-text-muted flex items-center gap-1.5 mb-2">
                                <Trophy size={14} className="text-amber-500" />
                                الأكثر مبيعاً
                            </h4>
                            <div className="space-y-1.5">
                                {stats.topSelling && stats.topSelling.length > 0 ? (
                                    stats.topSelling.slice(0, 3).map((item, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm ${
                                                    i === 0 ? 'bg-amber-500 shadow-amber-500/20' : 
                                                    i === 1 ? 'bg-gray-400 shadow-gray-400/20' : 
                                                    'bg-orange-700 shadow-orange-700/20'
                                                }`}>{i + 1}</span>
                                                <span className="text-text-main font-medium truncate max-w-[80px]">{item.label}</span>
                                            </div>
                                            <span className="font-mono font-bold text-primary">{item.value}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-text-muted text-center py-2">لا توجد بيانات</p>
                                )}
                            </div>
                        </Card>

                        {/* Top Customers */}
                        <Card className="p-3 shadow-sm">
                            <h4 className="text-xs font-bold text-text-muted flex items-center gap-1.5 mb-2">
                                <Users size={14} className="text-blue-500" />
                                أفضل العملاء
                            </h4>
                            <div className="space-y-1.5">
                                {stats.topCustomers && stats.topCustomers.length > 0 ? (
                                    stats.topCustomers.slice(0, 3).map((customer, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm ${
                                                    i === 0 ? 'bg-blue-500 shadow-blue-500/20' : 
                                                    i === 1 ? 'bg-blue-400 shadow-blue-400/20' : 
                                                    'bg-blue-300 shadow-blue-300/20'
                                                }`}>{i + 1}</span>
                                                <span className="text-text-main font-medium truncate max-w-[80px]">{customer.name}</span>
                                            </div>
                                            <span className="font-mono font-bold text-emerald-500">{formatCurrency(customer.total, currency)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-text-muted text-center py-2">لا توجد بيانات</p>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </PageShell>
    );
};
