import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
    TrendingUp, DollarSign, ShoppingBag, TrendingDown, Download,
    Sparkles, RefreshCw, Activity, Wallet, CreditCard, Users,
    BarChart3, ArrowUpRight, ArrowDownRight, Package, AlertTriangle,
    Calendar, Filter, FileText, UserCheck, Clock, Receipt, LucideIcon
} from 'lucide-react';
import { formatCurrency, getLocalDateString } from '../../core/utils';
import { PageHeader, Card, SpotlightCard } from '../../components/ui';
import { PageShell, LoadingState, TabNav, SegmentedControl } from '../../components/blocks';
import { SalesAreaChart } from '../../components/charts';
import { MetricCard, DateRangeButton, CustomerRank } from './components/ReportsComponents';
import { forecastSales } from '../../core/ai';
import { api, Sale, Expense, Product, Customer, Staff, StockMovement, DashboardStats } from '../../core/api';
import { AppPreferences } from '../../core/types';
import { logger } from '../../core/logger';
import { usePreferences } from '../../components/PreferencesContext';
import { exportSalesReport, exportFinancialSummary, exportProductsReport, exportInventoryReport, exportCustomersReport } from '../../core/export';
import { useDashboardStats, useProducts, useCustomers, useMonthlyComparison, useStockMovements, MonthData } from '../../hooks';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 REPORTS PAGE - Tab-Based Analytics Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

type TabId = 'overview' | 'sales' | 'inventory' | 'customers' | 'staff' | 'monthly';

interface Analytics {
    revenue: number;
    netProfit: number;
    grossProfit: number;
    cogs: number;
    totalExpenses: number;
    profitMargin: number;
    avgOrderValue: number;
    chartData: { label: string; value: number; formattedValue: string }[];
    productPerformance: { label: string; value: number }[];
    expenseBreakdown: { label: string; value: number; percent: number; color: string }[];
    completedCount: number;
    topCustomers: { name: string; total: number }[];
}

const TABS: { id: TabId; label: string; icon: LucideIcon; color: string }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: BarChart3, color: 'from-blue-500 to-cyan-400' },
    { id: 'sales', label: 'المبيعات', icon: Receipt, color: 'from-emerald-500 to-teal-400' },
    { id: 'inventory', label: 'المخزون', icon: Package, color: 'from-orange-500 to-amber-400' },
    { id: 'customers', label: 'العملاء', icon: Users, color: 'from-purple-500 to-pink-400' },
    { id: 'staff', label: 'الموظفين', icon: UserCheck, color: 'from-rose-500 to-red-400' },
    { id: 'monthly', label: 'المقارنة الشهرية', icon: Calendar, color: 'from-cyan-500 to-blue-400' },
];

// ─────────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────────

export const ReportsPage: React.FC = () => {
    const { prefs } = usePreferences();
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('week');
    const [forecast, setForecast] = useState<string | null>(null);
    const [isForecasting, setIsForecasting] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // ── React Query data fetching ──────────────────────────────────────────────
    const { stats: dashboardStats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useDashboardStats(dateRange);
    const { data: sales = [], isLoading: salesLoading, isError: salesError } = useQuery({
        queryKey: ['reports', 'sales'],
        queryFn: () => api.sales.list(0, 100, '', '', '').then(r => r.data),
    });
    const { data: expenses = [], isLoading: expensesLoading, isError: expensesError } = useQuery({
        queryKey: ['reports', 'expenses'],
        queryFn: () => api.expenses.list(),
    });
    const { products, isLoading: productsLoading, isError: productsError } = useProducts();
    const { customers, isLoading: customersLoading, isError: customersError } = useCustomers();
    const { data: staffList = [], isLoading: staffLoading, isError: staffError } = useQuery({
        queryKey: ['reports', 'staff'],
        queryFn: () => api.staff.list(),
    });
    const { stockMovements, isLoading: stockLoading, isError: stockError } = useStockMovements();

    const loading = statsLoading || salesLoading || expensesLoading || productsLoading || customersLoading || staffLoading || stockLoading;
    const hasError = statsError || salesError || expensesError || productsError || customersError || staffError || stockError;

    useEffect(() => {
        if (hasError) console.error('Reports: Failed to load some report data');
    }, [hasError]);

    const filterByDate = useCallback(<T extends { date?: string; timestamp?: number }>(items: T[]): T[] => {
        // ... (Keep this for other tabs that still use client side lists like StockMovements)
        const now = new Date();
        return items.filter((item) => {
            const d = item.date ? new Date(item.date) : item.timestamp ? new Date(item.timestamp) : new Date();
            const diffDays = Math.ceil(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
            if (dateRange === 'week') return diffDays <= 7;
            if (dateRange === 'month') return diffDays <= 30;
            return diffDays <= 365;
        });
    }, [dateRange]);

    const analytics = useMemo<Analytics>(() => {
        const filteredSales = filterByDate(sales);
        const filteredExpenses = filterByDate(expenses);
        const completedSales = filteredSales.filter((s) => s.status === 'completed');

        let revenue = 0;
        let cogs = 0;
        completedSales.forEach((s) => {
            revenue += s.total;
            s.items?.forEach((p) => (cogs += (p.cost || 0) * p.qty));
        });

        const totalExpenses = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
        const grossProfit = revenue - cogs;
        const netProfit = grossProfit - totalExpenses;
        const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
        const avgOrderValue = completedSales.length > 0 ? revenue / completedSales.length : 0;

        // Chart Data
        const chartLength = dateRange === 'week' ? 7 : dateRange === 'month' ? 15 : 12;
        const chartData = Array.from({ length: chartLength }, (_, i) => {
            const d = new Date();
            if (dateRange === 'year') d.setMonth(d.getMonth() - i);
            else d.setDate(d.getDate() - i);

            const label = dateRange === 'year'
                ? d.toLocaleDateString('ar-IQ', { month: 'short' })
                : d.toLocaleDateString('ar-IQ', { weekday: 'short', day: dateRange === 'month' ? 'numeric' : undefined });

            let val: number;
            if (dateRange === 'year') {
                val = completedSales
                    .filter((s) => new Date(s.date).getMonth() === d.getMonth() && new Date(s.date).getFullYear() === d.getFullYear())
                    .reduce((sum, s) => sum + s.total, 0);
            } else {
                const str = getLocalDateString(d);
                val = completedSales.filter((s) => s.date.startsWith(str)).reduce((sum, s) => sum + s.total, 0);
            }
            return { label, value: val, formattedValue: formatCurrency(val, prefs?.currency) };
        }).reverse();

        // Product Performance
        const productStats = completedSales.reduce((acc: Record<string, number>, s) => {
            s.items?.forEach((p) => { acc[p.name] = (acc[p.name] || 0) + p.qty; });
            return acc;
        }, {});
        const productPerformance = Object.entries(productStats)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // Expense Categories
        const expenseCategories = filteredExpenses.reduce((acc: Record<string, number>, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
            return acc;
        }, {});
        const categoryLabels: Record<string, string> = { rent: 'إيجار', salary: 'رواتب', bills: 'فواتير', maintenance: 'صيانة', other: 'أخرى' };
        const categoryColors: Record<string, string> = { rent: 'bg-blue-500', salary: 'bg-purple-500', bills: 'bg-amber-500', maintenance: 'bg-cyan-500', other: 'bg-gray-500' };
        const expenseBreakdown = Object.entries(expenseCategories)
            .map(([cat, amount]) => ({
                label: categoryLabels[cat] || cat,
                value: amount,
                percent: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
                color: categoryColors[cat] || 'bg-gray-500',
            }))
            .sort((a, b) => b.value - a.value);

        // Top Customers
        const customerStats = completedSales.reduce((acc: Record<string, number>, s) => {
            if (!s.customer || s.customer === 'زبون عام' || s.customer === 'Guest') return acc;
            acc[s.customer] = (acc[s.customer] || 0) + s.total;
            return acc;
        }, {});
        const topCustomers = Object.entries(customerStats)
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        return { revenue, netProfit, grossProfit, cogs, totalExpenses, profitMargin, avgOrderValue, chartData, productPerformance, expenseBreakdown, completedCount: completedSales.length, topCustomers };
    }, [sales, expenses, dateRange, filterByDate, prefs?.currency]);

    const handleForecast = async () => {
        setIsForecasting(true);
        try {
            const dailyRevenues = analytics.chartData.map((d) => d.value);
            const res = await forecastSales(dailyRevenues);
            setForecast(res);
        } catch { setForecast('تعذر إنشاء التوقعات حالياً.'); }
        setIsForecasting(false);
    };

    // Loading State
    if (loading) return <LoadingState icon={BarChart3} title="جاري تحميل التقارير..." subtitle="تحليل البيانات" />;

    const currency = prefs?.currency || 'IQD';
    const storeName = prefs?.storeName;

    const handleExport = async (format: 'excel' | 'pdf') => {
        setShowExportMenu(false);
        try {
            switch (activeTab) {
                case 'sales':
                    await exportSalesReport(sales.filter(s => s.status === 'completed'), format, currency, storeName);
                    break;
                case 'inventory':
                    await exportInventoryReport(products, format, currency, storeName);
                    break;
                case 'customers': {
                    // Map customers format to match expectation
                    const custData = customers.map(c => ({
                        id: c.id,
                        name: c.name,
                        phone: c.phone || '',
                        email: '',
                        debt: c.debt || 0
                    }));
                    await exportCustomersReport(custData, format, currency, storeName);
                    break;
                }
                case 'overview':
                    // Use calculated analytics for consistency
                    await exportFinancialSummary({
                        revenue: analytics.revenue,
                        cogs: analytics.cogs,
                        grossProfit: analytics.grossProfit,
                        expenses: analytics.totalExpenses,
                        netProfit: analytics.netProfit,
                        profitMargin: analytics.profitMargin
                    }, analytics.expenseBreakdown.map(e => ({ category: e.label, amount: e.value })), format, {
                        dateRange: dateRange === 'week' ? 'أسبوع' : dateRange === 'month' ? 'شهر' : 'سنة',
                        currency,
                        storeName
                    });
                    break;
                default:
                    // Fallback to sales
                    await exportSalesReport(sales.filter(s => s.status === 'completed'), format, currency, storeName);
            }
        } catch (e) {
            logger.error('Export failed', e, 'Reports');
        }
    };

    return (
        <PageShell>
            {/* Header */}
            <PageHeader
                title="التقارير والتحليلات"
                icon={BarChart3}
                description="تحليل الأداء المالي والمؤشرات الحيوية"
                actions={
                    <div className="flex items-center gap-3">
                        {/* Date Range */}
                        <SegmentedControl
                            options={[
                                { id: 'week', label: 'أسبوع' },
                                { id: 'month', label: 'شهر' },
                                { id: 'year', label: 'سنة' },
                            ]}
                            value={dateRange}
                            onChange={(v) => setDateRange(v as 'week' | 'month' | 'year')}
                        />
                        {/* Export */}
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="bg-surface hover:bg-surface-hover text-text-main px-4 py-2.5 rounded-xl border border-border text-sm font-bold flex items-center gap-2 transition-all active:scale-95"
                                title="تصدير التقرير"
                            >
                                <Download size={18} />
                                <span className="hidden sm:inline">تصدير</span>
                            </button>
                            {showExportMenu && (
                                <div className="absolute left-0 top-full mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                    <button
                                        onClick={() => handleExport('excel')}
                                        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-bg text-right text-sm font-bold"
                                    >
                                        <Download size={14} className="text-emerald-500" /> تصدير Excel
                                    </button>
                                    <button
                                        onClick={() => handleExport('pdf')}
                                        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-bg text-right text-sm font-bold"
                                    >
                                        <Download size={14} className="text-red-500" /> تصدير PDF
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                }
            />

            {/* Tabs Navigation */}
            <TabNav
                tabs={TABS.map(tab => ({ id: tab.id, label: tab.label, icon: tab.icon }))}
                active={activeTab}
                onChange={(v) => setActiveTab(v as TabId)}
            />

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {activeTab === 'overview' && dashboardStats && (
                    <OverviewTab stats={dashboardStats as DashboardStats} currency={currency} prefs={prefs} forecast={forecast} isForecasting={isForecasting} handleForecast={handleForecast} />
                )}
                {activeTab === 'sales' && (
                    <SalesReportTab currency={currency} />
                )}
                {activeTab === 'inventory' && (
                    <InventoryReportTab products={products} stockMovements={filterByDate(stockMovements)} currency={currency} />
                )}
                {activeTab === 'customers' && (
                    <CustomersReportTab customers={customers} sales={filterByDate(sales)} currency={currency} />
                )}
                {activeTab === 'staff' && (
                    <StaffReportTab staffList={staffList} sales={filterByDate(sales)} currency={currency} />
                )}
                {activeTab === 'monthly' && (
                    <MonthlyComparisonTab currency={currency} />
                )}
            </div>
        </PageShell>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 Overview Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface OverviewTabProps {
    stats: DashboardStats;
    currency: string;
    prefs?: AppPreferences;
    forecast: string | null;
    isForecasting: boolean;
    handleForecast: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ stats, currency, prefs, forecast, isForecasting, handleForecast }) => {
    // Map backend numbers to UI
    const revenue = stats.totalRevenue || 0;
    const netProfit = stats.netProfit || 0;
    const totalExpenses = stats.totalExpenses || 0;
    const grossProfit = stats.grossProfit || 0;
    const completedCount = stats.totalOrders || 0;

    // Calc margins
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const avgOrderValue = completedCount > 0 ? revenue / completedCount : 0;

    // Expense Ratio
    const expenseRatio = revenue > 0 ? Math.round((totalExpenses / revenue) * 100) : 0;

    const chartData = stats.chartData || [];
    const productPerformance = stats.topSelling || [];
    const topCustomers = stats.topCustomers || [];

    return (
        <div className="h-full overflow-y-auto custom-scrollbar pb-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* KPI Cards - Top Row */}
                <div className="bg-surface border border-border rounded-xl p-5 hover:border-primary/30 transition-all group shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-bg border border-border/60 text-text-muted group-hover:text-primary group-hover:bg-primary/5 group-hover:border-primary/20 flex items-center justify-center transition-all duration-200">
                            <Wallet size={18} />
                        </div>
                        <p className="text-xs font-bold text-text-muted uppercase tracking-wider">إجمالي الإيرادات</p>
                    </div>
                    <div>
                        <p className="text-xl font-black text-text-main font-mono">{formatCurrency(revenue, currency).replace(currency, '')}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-primary w-full" />
                            </div>
                            <p className="text-[10px] text-text-muted">{currency}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-xl p-5 hover:border-primary/30 transition-all group shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-bg border border-border/60 text-text-muted group-hover:text-primary group-hover:bg-primary/5 group-hover:border-primary/20 flex items-center justify-center transition-all duration-200">
                            <Activity size={18} />
                        </div>
                        <p className="text-xs font-bold text-text-muted uppercase tracking-wider">صافي الربح</p>
                    </div>
                    <div>
                        <p className="text-xl font-black text-text-main font-mono">{formatCurrency(netProfit, currency).replace(currency, '')}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <ArrowUpRight size={14} className={profitMargin > 0 ? 'text-emerald-500' : 'text-red-500 rotate-90'} />
                            <p className={`text-xs font-bold ${profitMargin > 0 ? 'text-emerald-500' : 'text-red-500'}`}>هامش {profitMargin.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-xl p-5 hover:border-primary/30 transition-all group shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-bg border border-border/60 text-text-muted group-hover:text-primary group-hover:bg-primary/5 group-hover:border-primary/20 flex items-center justify-center transition-all duration-200">
                            <TrendingDown size={18} />
                        </div>
                        <p className="text-xs font-bold text-text-muted uppercase tracking-wider">المصروفات</p>
                    </div>
                    <div>
                        <p className="text-xl font-black text-text-main font-mono">{formatCurrency(totalExpenses, currency).replace(currency, '')}</p>
                        <p className="text-xs text-text-muted mt-2">{expenseRatio}% من الدخل</p>
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-xl p-5 hover:border-primary/30 transition-all group shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-bg border border-border/60 text-text-muted group-hover:text-primary group-hover:bg-primary/5 group-hover:border-primary/20 flex items-center justify-center transition-all duration-200">
                            <ShoppingBag size={18} />
                        </div>
                        <p className="text-xs font-bold text-text-muted uppercase tracking-wider">متوسط الطلب</p>
                    </div>
                    <div>
                        <p className="text-xl font-black text-text-main font-mono">{formatCurrency(avgOrderValue, currency).replace(currency, '')}</p>
                        <p className="text-xs text-text-muted mt-2">{completedCount} طلب مكتمل</p>
                    </div>
                </div>

                {/* Revenue Chart */}
                <SpotlightCard className="lg:col-span-3 bg-surface p-6 rounded-xl border border-border flex flex-col min-h-[350px]" spotlightColor="var(--color-primary-dim)">
                    <div className="flex justify-between items-start mb-5 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-bg border border-border/60 text-text-muted flex items-center justify-center">
                                <TrendingUp size={22} />
                            </div>
                            <div>
                                <h3 className="text-text-main font-black text-base">تحليل الإيرادات</h3>
                                <p className="text-text-muted text-xs">الأداء خلال الفترة المحددة</p>
                            </div>
                        </div>
                        <div className="text-left px-4 py-2 bg-surface hover:bg-surface-hover rounded-xl border border-border shadow-sm">
                            <p className="text-[10px] text-text-muted font-bold">أعلى قيمة</p>
                            <p className="text-primary font-black font-mono text-base">{formatCurrency(Math.max(0, ...chartData.map((d) => d.value)), currency)}</p>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0"><SalesAreaChart data={chartData} /></div>
                </SpotlightCard>

                {/* AI Forecast */}
                <Card className="lg:col-span-1 p-5 bg-surface border-border flex flex-col h-full hover:border-primary/30 transition-all">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h3 className="text-text-main font-black text-sm flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-bg border border-border/60 flex items-center justify-center">
                                <Sparkles size={14} className="text-text-muted" />
                            </div>
                            التوقعات الذكية
                        </h3>
                        <button onClick={handleForecast} disabled={isForecasting} className="p-1.5 rounded-lg text-text-muted hover:bg-bg transition-all active:scale-95 border border-border bg-surface" title="تحديث التوقعات">
                            <RefreshCw size={12} className={isForecasting ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-bg/40 rounded-lg p-4 border border-border/60 overflow-y-auto no-scrollbar">
                        {forecast ? (
                            <p className="text-text-main text-xs leading-relaxed text-center">{forecast}</p>
                        ) : (
                            <div className="text-center">
                                <Sparkles size={20} className="mx-auto mb-2 text-text-muted/30" />
                                <p className="text-text-muted text-[11px]">اضغط لتحليل البيانات وتوقع المبيعات</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Top Products */}
                <Card className="lg:col-span-2 p-5 bg-surface border-border hover:border-primary/30 transition-all flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-4 shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-bg border border-border/60 text-text-muted flex items-center justify-center">
                            <ShoppingBag size={18} />
                        </div>
                        <h3 className="text-text-main font-black text-sm">المنتجات الأكثر مبيعاً</h3>
                    </div>
                    <div className="space-y-2">
                        {productPerformance.slice(0, 5).map((p, i: number) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-bg/30 hover:bg-bg transition-colors border border-transparent hover:border-border">
                                <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-primary text-primary-fg' : 'bg-surface border border-border text-text-muted'}`}>{i + 1}</span>
                                <span className="text-text-main text-xs font-bold truncate flex-1">{p.label}</span>
                                <span className="text-text-main font-black text-xs font-mono">{p.value}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Top Customers */}
                <Card className="lg:col-span-2 p-6 bg-surface border-border hover:border-primary/30 transition-all flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-5 shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-bg border border-border/60 text-text-muted flex items-center justify-center">
                            <Users size={18} />
                        </div>
                        <h3 className="text-text-main font-black text-sm">أفضل العملاء</h3>
                    </div>
                    <div className="space-y-2">
                        {topCustomers.length === 0 ? (
                            <div className="py-8 text-center text-text-muted">
                                <Users size={24} className="mx-auto mb-2 opacity-30" />
                                <p className="text-xs">لا توجد بيانات كافية</p>
                            </div>
                        ) : (
                            topCustomers.slice(0, 5).map((c, i: number) => (
                                <CustomerRank key={i} rank={i + 1} name={c.name} total={c.total} currency={currency} />
                            ))
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 Sales Report Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface SalesReportTabProps {
    sales: Sale[];
    currency: string;
}

const SalesReportTab: React.FC<{ currency: string }> = ({ currency }) => {
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
    const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'returned'>('all');
    const [dateFilter, setDateFilter] = useState<string>('all');

    const { data, isLoading } = useQuery({
        queryKey: ['reports', 'salesList', pagination.pageIndex, filter, dateFilter],
        queryFn: () => api.sales.list(pagination.pageIndex, pagination.pageSize, '', filter === 'all' ? '' : filter, dateFilter),
        placeholderData: keepPreviousData,
    });

    const sales = data?.data || [];
    const totalPages = data?.totalPages || 1;
    const stats = useMemo(() => {
        if (data?.stats) {
            return {
                total: data.stats.total,
                count: data.stats.count,
                avgValue: data.stats.count > 0 ? data.stats.total / data.stats.count : 0,
            };
        }
        return { total: 0, count: 0, avgValue: 0 };
    }, [data]);

    useEffect(() => {
        if (isLoading === false && data === undefined) {
            console.error('Failed to fetch sales');
        }
    }, [isLoading, data]);

    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            header: 'رقم الفاتورة',
            accessorKey: 'id',
            cell: (info: any) => <span className="font-mono text-text-main font-bold">{info.getValue() as string}</span>,
        },
        {
            header: 'التاريخ',
            accessorKey: 'date',
            cell: (info: any) => <span className="text-text-muted">{new Date(info.getValue() as string).toLocaleDateString('ar-IQ')}</span>,
        },
        {
            header: 'العميل',
            accessorKey: 'customer',
            cell: (info: any) => <span className="text-text-main">{info.getValue() as string || 'زبون عام'}</span>,
        },
        {
            header: 'الطريقة',
            accessorKey: 'paymentMethod',
            cell: (info: any) => {
                const method = info.getValue() as string;
                return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${method === 'cash' ? 'bg-success-dim text-success' : method === 'card' ? 'bg-info-dim text-info' : 'bg-warning-dim text-warning'}`}>{method === 'cash' ? 'نقدي' : method === 'card' ? 'بطاقة' : 'آجل'}</span>;
            },
        },
        {
            header: 'الحالة',
            accessorKey: 'status',
            cell: (info: any) => {
                const status = info.getValue() as string;
                return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${status === 'completed' ? 'bg-success-dim text-success' : status === 'pending' ? 'bg-warning-dim text-warning' : 'bg-danger-dim text-danger'}`}>{status === 'completed' ? 'مكتمل' : status === 'pending' ? 'معلق' : 'مرتجع'}</span>;
            },
        },
        {
            header: 'المبلغ',
            accessorKey: 'total',
            cell: (info: any) => <span className="font-mono font-black text-text-main">{formatCurrency(info.getValue() as number, currency)}</span>,
        },
    ], [currency]);

    return (
        <div className="h-full flex flex-col gap-4 animate-in fade-in duration-300">
            {/* Stats Row - Unified */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
                <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:border-primary/20 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-bg border border-border/60 text-text-muted flex items-center justify-center">
                        <Receipt size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-text-muted font-bold uppercase">إجمالي المبيعات</p>
                        <p className="text-primary font-black text-xl font-mono">{formatCurrency(stats.total, currency).replace(currency, '')}</p>
                    </div>
                </div>
                <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:border-primary/20 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-bg border border-border/60 text-text-muted flex items-center justify-center">
                        <FileText size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-text-muted font-bold uppercase">عدد الفواتير</p>
                        <p className="text-text-main font-black text-xl font-mono">{stats.count}</p>
                    </div>
                </div>
                <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:border-primary/20 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-bg border border-border/60 text-text-muted flex items-center justify-center">
                        <Activity size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-text-muted font-bold uppercase">متوسط الفاتورة</p>
                        <p className="text-text-main font-black text-xl font-mono">{formatCurrency(stats.avgValue, currency).replace(currency, '')}</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 shrink-0 justify-between">
                <div className="flex bg-bg p-1 rounded-xl border border-border">
                    {(['all', 'completed', 'pending', 'returned'] as const).map(f => (
                        <button key={f} onClick={() => { setFilter(f); setPagination(p => ({ ...p, pageIndex: 0 })); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === f ? 'bg-primary text-primary-fg' : 'text-text-muted hover:text-text-main'}`}>
                            {f === 'all' ? 'الكل' : f === 'completed' ? 'مكتمل' : f === 'pending' ? 'معلق' : 'مرتجع'}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <select value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }} className="bg-surface border border-border rounded-xl px-4 py-2 text-sm text-text-main" aria-label="تصفية حسب الفترة الزمنية">
                        <option value="all">كل الفترات</option>
                        <option value="today">اليوم</option>
                        <option value="week">هذا الأسبوع</option>
                    </select>
                </div>
            </div>

            {/* Sales Table */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {isLoading && <div className="absolute inset-0 bg-surface/50 backdrop-blur-sm flex items-center justify-center z-10"><RefreshCw className="animate-spin text-primary" /></div>}
                <DataTable
                    data={sales}
                    columns={columns}
                    emptyStateTitle="لا توجد مبيعات"
                    emptyStateDescription="لم يتم العثور على مبيعات في هذه الفترة."
                    emptyStateIcon={Receipt}
                    manualPagination={true}
                    pageCount={totalPages}
                    pagination={pagination}
                    onPaginationChange={setPagination}
                    getRowColor={(row: any) => row.status === 'completed' ? 'emerald' : row.status === 'pending' ? 'orange' : 'red'}
                />
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 Inventory Report Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface InventoryReportTabProps {
    products: Product[];
    stockMovements: StockMovement[];
    currency: string;
}

const InventoryReportTab: React.FC<InventoryReportTabProps> = ({ products, stockMovements, currency }) => {
    const lowStockProducts = useMemo(() => products.filter(p => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock), [products]);
    const outOfStockProducts = useMemo(() => products.filter(p => p.stock === 0), [products]);

    const stats = useMemo(() => ({
        totalProducts: products.length,
        totalValue: products.reduce((sum, p) => sum + (p.stock * p.cost), 0),
        lowStock: lowStockProducts.length,
        outOfStock: outOfStockProducts.length,
    }), [products, lowStockProducts, outOfStockProducts]);

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 shrink-0">
                <div className="bg-surface border border-border rounded-xl p-4 text-center group hover:border-primary/20 transition-all shadow-sm">
                    <Package size={20} className="mx-auto mb-2 text-text-muted" />
                    <p className="text-[10px] text-text-muted uppercase font-bold">إجمالي المنتجات</p>
                    <p className="text-text-main font-black text-xl font-mono">{stats.totalProducts}</p>
                </div>
                <div className="bg-surface border border-border rounded-xl p-4 text-center group hover:border-primary/20 transition-all shadow-sm">
                    <DollarSign size={20} className="mx-auto mb-2 text-text-muted" />
                    <p className="text-[10px] text-text-muted uppercase font-bold">قيمة المخزون</p>
                    <p className="text-primary font-black text-xl font-mono">{formatCurrency(stats.totalValue, currency).replace(currency, '')}</p>
                </div>
                <div className="bg-surface border border-amber-500/20 rounded-xl p-4 text-center hover:bg-amber-500/[0.02] transition-all shadow-sm">
                    <AlertTriangle size={20} className="mx-auto mb-2 text-amber-500" />
                    <p className="text-[10px] text-text-muted uppercase font-bold">مخزون منخفض</p>
                    <p className="text-amber-600 dark:text-amber-400 font-black text-xl font-mono">{stats.lowStock}</p>
                </div>
                <div className="bg-surface border border-red-500/20 rounded-xl p-4 text-center hover:bg-red-500/[0.02] transition-all shadow-sm">
                    <TrendingDown size={20} className="mx-auto mb-2 text-red-500" />
                    <p className="text-[10px] text-text-muted uppercase font-bold">نفذ من المخزون</p>
                    <p className="text-red-600 dark:text-red-400 font-black text-xl font-mono">{stats.outOfStock}</p>
                </div>
            </div>

            {/* Content Grid */}
            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                {/* Low Stock Alert */}
                <div className="bg-surface border border-border rounded-xl p-4 flex flex-col overflow-hidden">
                    <h3 className="font-bold text-text-main text-xs flex items-center gap-2 mb-3 shrink-0">
                        <AlertTriangle size={16} className="text-amber-500" /> تنبيهات المخزون
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                        {lowStockProducts.length === 0 ? (
                            <div className="py-8 text-center text-text-muted text-sm">
                                <Package size={24} className="mx-auto mb-2 opacity-30" />
                                جميع المنتجات بمخزون كافٍ
                            </div>
                        ) : (
                            lowStockProducts.slice(0, 10).map(p => (
                                <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border ${p.stock === 0 ? 'bg-red-500/5 border-red-500/30' : 'bg-amber-500/5 border-amber-500/30'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{p.image}</span>
                                        <div>
                                            <p className="text-text-main font-bold text-sm">{p.name}</p>
                                            <p className="text-text-muted text-xs">الحد الأدنى: {p.minStock}</p>
                                        </div>
                                    </div>
                                    <span className={`font-black text-lg font-mono ${p.stock === 0 ? 'text-red-500' : 'text-amber-500'}`}>{p.stock}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent Stock Movements */}
                <div className="bg-surface border border-border rounded-xl p-4 flex flex-col overflow-hidden">
                    <h3 className="font-bold text-text-main text-xs flex items-center gap-2 mb-3 shrink-0">
                        <Activity size={16} className="text-blue-500" /> حركة المخزون الأخيرة
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pb-2">
                        {stockMovements.length === 0 ? (
                            <div className="py-8 text-center text-text-muted text-sm">
                                <Activity size={24} className="mx-auto mb-2 opacity-30" />
                                لا توجد حركات
                            </div>
                        ) : (
                            stockMovements.slice(0, 10).map((m, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-bg border border-border">
                                    <div>
                                        <p className="text-text-main text-sm font-bold">{m.productName}</p>
                                        <p className="text-text-muted text-xs">{m.reason}</p>
                                    </div>
                                    <span className={`font-bold font-mono ${m.type === 'in' || m.type === 'restock' ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {m.type === 'in' || m.type === 'restock' ? '+' : '-'}{m.qty}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 👥 Customers Report Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomersReportTabProps {
    customers: Customer[];
    sales: Sale[];
    currency: string;
}

import { DataTable, ColumnDef } from '../../components/shared/DataTable';

const CustomersReportTab: React.FC<CustomersReportTabProps> = ({ customers, sales, currency }) => {
    const customerStats = useMemo(() => {
        const stats = customers.map(c => {
            const customerSales = sales.filter(s => s.customerId === c.id);
            const totalSpent = customerSales.reduce((sum, s) => sum + (s.status === 'completed' ? s.total : 0), 0);
            const pendingDebt = customerSales.filter(s => s.status === 'pending').reduce((sum, s) => sum + s.total, 0);
            return { ...c, totalSpent, pendingDebt, orderCount: customerSales.length };
        });
        return stats.sort((a, b) => b.totalSpent - a.totalSpent);
    }, [customers, sales]);

    const totalDebt = useMemo(() => customerStats.reduce((sum, c) => sum + c.pendingDebt, 0), [customerStats]);
    const totalSpent = useMemo(() => customerStats.reduce((sum, c) => sum + c.totalSpent, 0), [customerStats]);

    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            header: 'العميل',
            accessorKey: 'name',
            cell: (info: any) => <span className="font-bold text-text-main block min-w-[120px]">{info.getValue() as string}</span>,
        },
        {
            header: 'الهاتف',
            accessorKey: 'phone',
            cell: (info: any) => <span className="text-text-muted font-mono">{info.getValue() as string || '-'}</span>,
        },
        {
            header: 'عدد الطلبات',
            accessorKey: 'orderCount',
            cell: (info: any) => <span className="text-text-main font-mono">{info.getValue() as number}</span>,
        },
        {
            header: 'إجمالي المشتريات',
            accessorKey: 'totalSpent',
            cell: (info: any) => <span className="text-success font-mono font-bold">{formatCurrency(info.getValue() as number, currency)}</span>,
        },
        {
            header: 'الديون المستحقة',
            accessorKey: 'pendingDebt',
            cell: (info: any) => {
                const val = info.getValue() as number;
                return (
                    <span className={`font-mono font-bold ${val > 0 ? 'text-danger' : 'text-text-muted'}`}>
                        {val > 0 ? formatCurrency(val, currency) : '-'}
                    </span>
                );
            },
        },
    ], [currency]);

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 shrink-0">
                <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:border-primary/20 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-bg border border-border/60 text-text-muted flex items-center justify-center"><Users size={22} /></div>
                    <div>
                        <p className="text-[10px] text-text-muted font-bold uppercase">إجمالي العملاء</p>
                        <p className="text-text-main font-black text-xl font-mono">{customers.length}</p>
                    </div>
                </div>
                <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:border-primary/20 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-bg border border-border/60 text-text-muted flex items-center justify-center"><Wallet size={22} /></div>
                    <div>
                        <p className="text-[10px] text-text-muted font-bold uppercase">إجمالي المشتريات</p>
                        <p className="text-primary font-black text-xl font-mono">{formatCurrency(totalSpent, currency).replace(currency, '')}</p>
                    </div>
                </div>
                <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:border-primary/20 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-bg border border-border/60 text-text-muted flex items-center justify-center"><CreditCard size={22} /></div>
                    <div>
                        <p className="text-[10px] text-text-muted font-bold uppercase">إجمالي الديون</p>
                        <p className="text-red-600 dark:text-red-400 font-black text-xl font-mono">{formatCurrency(totalDebt, currency).replace(currency, '')}</p>
                    </div>
                </div>
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <DataTable 
                    data={customerStats}
                    columns={columns}
                    emptyStateTitle="لا يوجد عملاء"
                    emptyStateDescription="لم يتم العثور على أي بيانات للعملاء في هذه الفترة."
                />
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 👨‍💼 Staff Report Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface StaffReportTabProps {
    staffList: Staff[];
    sales: Sale[];
    currency: string;
}

const StaffReportTab: React.FC<StaffReportTabProps> = ({ staffList, sales, currency }) => {
    const staffStats = useMemo(() => {
        return staffList.map(s => {
            // Note: staffId is the field name from backend
            const staffSales = sales.filter(sale => sale.staffId === s.id && sale.status === 'completed');
            const totalSales = staffSales.reduce((sum, sale) => sum + sale.total, 0);
            return { ...s, salesCount: staffSales.length, totalSales };
        }).sort((a, b) => b.totalSales - a.totalSales);
    }, [staffList, sales]);

    const totalSalesValue = useMemo(() => staffStats.reduce((sum, s) => sum + s.totalSales, 0), [staffStats]);

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 shrink-0">
                <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:border-primary/20 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-bg border border-border/60 text-text-muted flex items-center justify-center"><UserCheck size={22} /></div>
                    <div>
                        <p className="text-[10px] text-text-muted font-bold uppercase">عدد الموظفين</p>
                        <p className="text-text-main font-black text-xl font-mono">{staffList.length}</p>
                    </div>
                </div>
                <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:border-primary/20 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-bg border border-border/60 text-text-muted flex items-center justify-center"><Receipt size={22} /></div>
                    <div>
                        <p className="text-[10px] text-text-muted font-bold uppercase">إجمالي المبيعات</p>
                        <p className="text-primary font-black text-xl font-mono">{formatCurrency(totalSalesValue, currency).replace(currency, '')}</p>
                    </div>
                </div>
                <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:border-primary/20 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-bg border border-border/60 text-text-muted flex items-center justify-center"><Activity size={22} /></div>
                    <div>
                        <p className="text-[10px] text-text-muted font-bold uppercase">متوسط للموظف</p>
                        <p className="text-text-main font-black text-xl font-mono">{formatCurrency(staffList.length > 0 ? totalSalesValue / staffList.length : 0, currency).replace(currency, '')}</p>
                    </div>
                </div>
            </div>

            {/* Staff Performance */}
            <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-2 lg:grid-cols-3 gap-4">
                {staffStats.map((s, i) => {
                    const percentage = totalSalesValue > 0 ? (s.totalSales / totalSalesValue) * 100 : 0;
                    return (
                        <div key={s.id} className="bg-surface border border-border rounded-xl p-4 hover:border-primary/25 transition-colors shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${i === 0 ? 'bg-primary text-primary-fg' : 'bg-bg border border-border text-text-muted'}`}>
                                    {i + 1}
                                </div>
                                <div>
                                    <p className="text-text-main font-bold text-sm">{s.name}</p>
                                    <p className="text-text-muted text-xs">{s.role === 'admin' ? 'مدير' : s.role === 'manager' ? 'مشرف' : 'كاشير'}</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs">
                                    <span className="text-text-muted">المبيعات</span>
                                    <span className="text-primary font-bold font-mono">{formatCurrency(s.totalSales, currency).replace(currency, '')}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-text-muted">عدد الفواتير</span>
                                    <span className="text-text-main font-bold font-mono">{s.salesCount}</span>
                                </div>
                                <div className="w-full h-1.5 bg-bg rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full transition-all duration-500"
                                        style={{ width: `${percentage}%` }} />
                                </div>
                                <p className="text-[10px] text-text-muted text-center">{percentage.toFixed(1)}% من الإجمالي</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📅 Monthly Comparison Tab
// ═══════════════════════════════════════════════════════════════════════════════

const MonthlyComparisonTab: React.FC<{ currency: string }> = ({ currency }) => {
    const { comparison: data, isLoading, isError, refetch } = useMonthlyComparison();

    useEffect(() => {
        if (isError) console.error('Failed to load monthly comparison');
    }, [isError]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <RefreshCw size={32} className="text-primary animate-spin" />
            </div>
        );
    }

    const ChangeIndicator = ({ value, label }: { value: number; label: string }) => (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${value >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
            {value >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            <span className="font-bold">{Math.abs(value).toFixed(1)}%</span>
            <span className="text-xs opacity-70">{label}</span>
        </div>
    );

    const MonthCard = ({ month, isCurrent }: { month: MonthData; isCurrent: boolean }) => (
        <div className={`bg-surface border rounded-lg p-6 ${isCurrent ? 'border-primary/50 shadow-lg shadow-primary/10' : 'border-border'}`}>
            <div className="flex items-center gap-3 mb-6">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isCurrent ? 'bg-gradient-to-br from-primary to-emerald-400' : 'bg-bg'}`}>
                    <Calendar size={24} className={isCurrent ? 'text-white' : 'text-text-muted'} />
                </div>
                <div>
                    <h3 className="text-text-main font-black text-lg">{month.label}</h3>
                    <p className="text-text-muted text-xs">{isCurrent ? 'الشهر الحالي' : 'الشهر السابق'}</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-bg rounded-lg">
                    <div className="flex items-center gap-2">
                        <Wallet size={18} className="text-blue-500" />
                        <span className="text-text-muted text-sm">الإيرادات</span>
                    </div>
                    <span className="text-blue-500 font-black text-lg font-mono">{formatCurrency(month.revenue, currency).replace(currency, '')}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-bg rounded-lg">
                    <div className="flex items-center gap-2">
                        <Activity size={18} className="text-emerald-500" />
                        <span className="text-text-muted text-sm">صافي الربح</span>
                    </div>
                    <span className={`font-black text-lg font-mono ${month.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {formatCurrency(month.netProfit, currency).replace(currency, '')}
                    </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-bg rounded-lg">
                    <div className="flex items-center gap-2">
                        <Receipt size={18} className="text-purple-500" />
                        <span className="text-text-muted text-sm">عدد الطلبات</span>
                    </div>
                    <span className="text-purple-500 font-black text-lg font-mono">{month.orders}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-bg rounded-lg">
                    <div className="flex items-center gap-2">
                        <ShoppingBag size={18} className="text-amber-500" />
                        <span className="text-text-muted text-sm">متوسط الطلب</span>
                    </div>
                    <span className="text-amber-500 font-black text-lg font-mono">{formatCurrency(month.avgOrder, currency).replace(currency, '')}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-bg rounded-lg">
                    <div className="flex items-center gap-2">
                        <TrendingDown size={18} className="text-red-500" />
                        <span className="text-text-muted text-sm">المصروفات</span>
                    </div>
                    <span className="text-red-500 font-black text-lg font-mono">{formatCurrency(month.expenses, currency).replace(currency, '')}</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full overflow-y-auto custom-scrollbar pb-4 animate-in fade-in duration-300">
            {/* Change Indicators */}
            <div className="flex gap-4 mb-6 justify-center flex-wrap">
                <ChangeIndicator value={data.revenueChange} label="الإيرادات" />
                <ChangeIndicator value={data.profitChange} label="الأرباح" />
                <ChangeIndicator value={data.ordersChange} label="الطلبات" />
            </div>

            {/* Month Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MonthCard month={data.currentMonth} isCurrent={true} />
                <MonthCard month={data.previousMonth} isCurrent={false} />
            </div>

            {/* Visual Comparison Bar */}
            <div className="mt-6 bg-surface border border-border rounded-lg p-6">
                <h3 className="text-text-main font-black mb-4 flex items-center gap-2">
                    <BarChart3 size={20} className="text-primary" />
                    مقارنة الإيرادات
                </h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-text-muted">{data.currentMonth.label}</span>
                            <span className="text-blue-500 font-mono font-bold">{formatCurrency(data.currentMonth.revenue, currency)}</span>
                        </div>
                        <div className="h-8 bg-bg rounded-lg overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-lg transition-all duration-700"
                                style={{ width: `${Math.min(100, (data.currentMonth.revenue / Math.max(data.currentMonth.revenue, data.previousMonth.revenue)) * 100)}%` }}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-text-muted">{data.previousMonth.label}</span>
                            <span className="text-text-main font-mono font-bold">{formatCurrency(data.previousMonth.revenue, currency)}</span>
                        </div>
                        <div className="h-8 bg-bg rounded-xl overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-gray-400 to-gray-500 rounded-xl transition-all duration-700"
                                style={{ width: `${Math.min(100, (data.previousMonth.revenue / Math.max(data.currentMonth.revenue, data.previousMonth.revenue)) * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

