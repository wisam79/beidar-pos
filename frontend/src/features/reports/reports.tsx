import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
    TrendingUp, DollarSign, ShoppingBag, TrendingDown, Download,
    Sparkles, RefreshCw, Activity, Wallet, CreditCard, Users,
    BarChart3, ArrowUpRight, ArrowDownRight, Package, AlertTriangle,
    Calendar, FileText, UserCheck, Receipt, LucideIcon
} from 'lucide-react';
import { formatCurrency, getLocalDateString } from '../../core/utils';
import { PageHeader } from '../../components/ui';
import { PageShell, LoadingState, TabNav, SegmentedControl, StatsGrid, StatCard, FilterBar } from '../../components/blocks';
import { DataTable, ColumnDef } from '../../components/shared/DataTable';
import { SalesAreaChart } from '../../components/charts';
import { CustomerRank } from './components/ReportsComponents';
import { forecastSales } from '../../core/ai';
import { api, Sale, Product, Customer, Staff, StockMovement, DashboardStats } from '../../core/api';
import { AppPreferences } from '../../core/types';
import { logger } from '../../core/logger';
import { usePreferences } from '../../components/PreferencesContext';
import { queryKeys } from '../../core/queryClient';
import { exportSalesReport, exportFinancialSummary, exportInventoryReport, exportCustomersReport } from '../../core/export';
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
    { id: 'overview', label: 'نظرة عامة', icon: BarChart3, color: 'from-primary to-primary' },
    { id: 'sales', label: 'المبيعات', icon: Receipt, color: 'from-success to-success' },
    { id: 'inventory', label: 'المخزون', icon: Package, color: 'from-warning to-warning' },
    { id: 'customers', label: 'العملاء', icon: Users, color: 'from-primary to-danger' },
    { id: 'staff', label: 'الموظفين', icon: UserCheck, color: 'from-danger to-danger' },
    { id: 'monthly', label: 'المقارنة الشهرية', icon: Calendar, color: 'from-primary to-primary' },
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
        queryKey: queryKeys.sales.list(0, 100, '', '', ''),
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

        const totalExpenses = Math.round(filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0));
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
                val = Math.round(completedSales
                    .filter((s) => new Date(s.date).getMonth() === d.getMonth() && new Date(s.date).getFullYear() === d.getFullYear())
                    .reduce((sum, s) => sum + s.total, 0));
            } else {
                const str = getLocalDateString(d);
                val = Math.round(completedSales.filter((s) => s.date.startsWith(str)).reduce((sum, s) => sum + s.total, 0));
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
        const categoryColors: Record<string, string> = { rent: 'bg-primary', salary: 'bg-primary', bills: 'bg-warning', maintenance: 'bg-primary', other: 'bg-gray-500' };
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
    if (loading && !dashboardStats) return <LoadingState icon={BarChart3} title="جاري تحميل التقارير..." subtitle="تحليل البيانات" />;

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
                                className="bg-surface hover:bg-surface-hover text-text-main px-4 py-2.5 min-h-[44px] rounded-xl border border-border/80 text-sm font-extrabold flex items-center gap-2 transition-colors active:scale-[0.98] cursor-pointer select-none"
                                title="تصدير التقرير"
                            >
                                <Download size={18} className="text-success" />
                                <span className="hidden sm:inline">تصدير</span>
                            </button>
                            {showExportMenu && (
                                <div className="absolute left-0 top-full mt-2 w-48 bg-surface border border-border/80 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 p-1">
                                    <button
                                        onClick={() => handleExport('excel')}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 min-h-[40px] hover:bg-surface-hover text-right text-xs font-extrabold rounded-lg text-text-main cursor-pointer"
                                    >
                                        <Download size={15} className="text-success" /> تصدير Excel
                                    </button>
                                    <button
                                        onClick={() => handleExport('pdf')}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 min-h-[40px] hover:bg-surface-hover text-right text-xs font-extrabold rounded-lg text-text-main cursor-pointer"
                                    >
                                        <Download size={15} className="text-danger" /> تصدير PDF
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
            <div className="flex-1 min-h-0 overflow-hidden pt-2">
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
    const completedCount = stats.totalOrders || 0;

    // Calc margins
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const avgOrderValue = completedCount > 0 ? revenue / completedCount : 0;

    const chartData = stats.chartData || [];
    const productPerformance = stats.topSelling || [];
    const topCustomers = stats.topCustomers || [];

    return (
        <div className="h-full overflow-y-auto custom-scrollbar pb-4 space-y-4 animate-in fade-in duration-200 select-none">
            {/* KPI Cards - Top Row */}
            <StatsGrid columns={4}>
                <StatCard
                    label="إجمالي الإيرادات"
                    value={formatCurrency(revenue, currency).replace(currency, '')}
                    icon={Wallet}
                    color="emerald"
                    subtitle={currency}
                />
                <StatCard
                    label="صافي الربح"
                    value={formatCurrency(netProfit, currency).replace(currency, '')}
                    icon={Activity}
                    color={netProfit >= 0 ? "emerald" : "red"}
                    subtitle={`هامش ${profitMargin.toFixed(1)}%`}
                />
                <StatCard
                    label="المصروفات"
                    value={formatCurrency(totalExpenses, currency).replace(currency, '')}
                    icon={TrendingDown}
                    color="red"
                    subtitle={currency}
                />
                <StatCard
                    label="متوسط الطلب"
                    value={formatCurrency(avgOrderValue, currency).replace(currency, '')}
                    icon={ShoppingBag}
                    color="purple"
                    subtitle={`${completedCount} طلب مكتمل`}
                />
            </StatsGrid>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Revenue Chart */}
                <div className="lg:col-span-3 bg-surface border border-border/80 p-5 rounded-2xl flex flex-col min-h-[280px]">
                    <div className="flex justify-between items-start mb-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 text-success flex items-center justify-center">
                                <TrendingUp size={20} />
                            </div>
                            <div>
                                <h3 className="text-text-main font-black text-base">تحليل الإيرادات</h3>
                                <p className="text-text-muted text-xs font-medium">الأداء خلال الفترة المحددة</p>
                            </div>
                        </div>
                        <div className="text-left px-4 py-2 bg-surface-hover/80 rounded-xl border border-border/60">
                            <p className="text-[10px] text-text-muted font-extrabold">أعلى قيمة</p>
                            <p className="text-success font-black font-mono text-base">{formatCurrency(Math.max(0, ...chartData.map((d) => d.value)), currency)}</p>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0"><SalesAreaChart data={chartData} /></div>
                </div>

                {/* AI Forecast */}
                <div className="lg:col-span-1 p-5 bg-surface border border-border/80 rounded-2xl flex flex-col h-full justify-between">
                    <div className="flex justify-between items-center mb-3 shrink-0">
                        <h3 className="text-text-main font-black text-sm flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                                <Sparkles size={16} />
                            </div>
                            التوقعات الذكية
                        </h3>
                        <button onClick={handleForecast} disabled={isForecasting} className="w-8 h-8 rounded-xl text-text-muted hover:text-success bg-surface-hover border border-border/60 flex items-center justify-center transition-colors touch-target cursor-pointer" title="تحديث التوقعات">
                            <RefreshCw size={15} className={isForecasting ? 'animate-spin text-success' : ''} />
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-surface-hover/40 rounded-xl p-4 border border-border/40 overflow-y-auto no-scrollbar min-h-[120px]">
                        {forecast ? (
                            <p className="text-text-main text-xs font-bold leading-relaxed text-center">{forecast}</p>
                        ) : (
                            <div className="text-center">
                                <Sparkles size={24} className="mx-auto mb-2 text-success/40" />
                                <p className="text-text-muted text-xs font-extrabold">اضغط لتحليل البيانات وتوقع المبيعات</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Products */}
                <div className="lg:col-span-2 p-5 bg-surface border border-border/80 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-4 shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 text-success flex items-center justify-center">
                            <ShoppingBag size={20} />
                        </div>
                        <div>
                            <h3 className="text-text-main font-black text-sm">المنتجات الأكثر مبيعاً</h3>
                            <p className="text-text-muted text-xs font-medium">أعلى 5 منتجات طلباً</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {productPerformance.slice(0, 5).map((p, i: number) => (
                            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-hover/60 border border-border/40">
                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-success text-primary-fg' : 'bg-surface border border-border/60 text-text-muted'}`}>{i + 1}</span>
                                <span className="text-text-main text-xs font-extrabold truncate flex-1">{p.label}</span>
                                <span className="text-success font-black text-xs font-mono">{p.value} قطعة</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Customers */}
                <div className="lg:col-span-2 p-5 bg-surface border border-border/80 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-4 shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                            <Users size={20} />
                        </div>
                        <div>
                            <h3 className="text-text-main font-black text-sm">أفضل العملاء</h3>
                            <p className="text-text-muted text-xs font-medium">أعلى العملاء إراداً</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {topCustomers.length === 0 ? (
                            <div className="py-6 text-center text-text-muted">
                                <Users size={24} className="mx-auto mb-2 opacity-30" />
                                <p className="text-xs font-bold">لا توجد بيانات كافية</p>
                            </div>
                        ) : (
                            topCustomers.slice(0, 5).map((c, i: number) => (
                                <CustomerRank key={i} rank={i + 1} name={c.name} total={c.total} currency={currency} />
                            ))
                        )}
                    </div>
                </div>
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

    const columns: ColumnDef<Sale>[] = useMemo(() => [
        {
            header: 'رقم الفاتورة',
            accessorKey: 'id',
            cell: ({ getValue }) => <span className="font-mono text-text-main font-bold">{String(getValue())}</span>,
        },
        {
            header: 'التاريخ',
            accessorKey: 'date',
            cell: ({ getValue }) => <span className="text-text-muted">{new Date(String(getValue())).toLocaleDateString('ar-IQ')}</span>,
        },
        {
            header: 'العميل',
            accessorKey: 'customer',
            cell: ({ getValue }) => <span className="text-text-main">{(getValue() as string) || 'زبون عام'}</span>,
        },
        {
            header: 'الطريقة',
            accessorKey: 'paymentMethod',
            cell: ({ getValue }) => {
                const method = getValue() as string;
                return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${method === 'cash' ? 'bg-success-dim text-success' : method === 'card' ? 'bg-info-dim text-info' : 'bg-warning-dim text-warning'}`}>{method === 'cash' ? 'نقدي' : method === 'card' ? 'بطاقة' : 'آجل'}</span>;
            },
        },
        {
            header: 'الحالة',
            accessorKey: 'status',
            cell: ({ getValue }) => {
                const status = getValue() as string;
                return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${status === 'completed' ? 'bg-success-dim text-success' : status === 'pending' ? 'bg-warning-dim text-warning' : 'bg-danger-dim text-danger'}`}>{status === 'completed' ? 'مكتمل' : status === 'pending' ? 'معلق' : 'مرتجع'}</span>;
            },
        },
        {
            header: 'المبلغ',
            accessorKey: 'total',
            cell: ({ getValue }) => <span className="font-mono font-black text-text-main">{formatCurrency(Number(getValue()), currency)}</span>,
        },
    ], [currency]);

    return (
        <div className="h-full flex flex-col gap-4 animate-in fade-in duration-300 select-none">
            {/* Stats Row - Unified 3D Tactile */}
            <StatsGrid columns={3}>
                <StatCard
                    label="إجمالي المبيعات"
                    value={formatCurrency(stats.total, currency).replace(currency, '')}
                    icon={Receipt}
                    color="emerald"
                    subtitle={currency}
                />
                <StatCard
                    label="عدد الفواتير"
                    value={stats.count}
                    icon={FileText}
                    color="blue"
                    subtitle="فاتورة مكتملة"
                />
                <StatCard
                    label="متوسط الفاتورة"
                    value={formatCurrency(stats.avgValue, currency).replace(currency, '')}
                    icon={Activity}
                    color="purple"
                    subtitle={currency}
                />
            </StatsGrid>

            {/* Filters */}
            <FilterBar className="justify-between">
                <SegmentedControl
                    options={[
                        { id: 'all', label: 'الكل' },
                        { id: 'completed', label: 'مكتمل' },
                        { id: 'pending', label: 'معلق' },
                        { id: 'returned', label: 'مرتجع' },
                    ]}
                    value={filter}
                    onChange={(v) => { setFilter(v as 'all' | 'completed' | 'pending' | 'returned'); setPagination(p => ({ ...p, pageIndex: 0 })); }}
                />
                <div className="flex gap-2 w-full sm:w-auto">
                    <select
                        value={dateFilter}
                        onChange={e => { setDateFilter(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }}
                        className="bg-input-bg border border-border/80 rounded-2xl px-5 py-2.5 min-h-[44px] text-sm font-extrabold text-text-main outline-none focus:border-success shadow-inner touch-target cursor-pointer w-full sm:w-auto"
                        aria-label="تصفية حسب الفترة الزمنية"
                    >
                        <option value="all">كل الفترات</option>
                        <option value="today">اليوم</option>
                        <option value="week">هذا الأسبوع</option>
                    </select>
                </div>
            </FilterBar>

            {/* Sales Table */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {isLoading && <div className="absolute inset-0 bg-surface/80 backdrop-blur-xs flex items-center justify-center z-10"><RefreshCw className="animate-spin text-success" size={32} /></div>}
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
                    getRowColor={(row: Sale) => row.status === 'completed' ? 'emerald' : row.status === 'pending' ? 'orange' : 'red'}
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
        totalValue: Math.round(products.reduce((sum, p) => sum + (p.stock * p.cost), 0)),
        lowStock: lowStockProducts.length,
        outOfStock: outOfStockProducts.length,
    }), [products, lowStockProducts, outOfStockProducts]);

    return (
        <div className="h-full flex flex-col gap-4 select-none">
            {/* Stats */}
            <StatsGrid columns={4}>
                <StatCard
                    label="إجمالي المنتجات"
                    value={stats.totalProducts}
                    icon={Package}
                    color="blue"
                    subtitle="مادة بالمخزن"
                />
                <StatCard
                    label="قيمة المخزون"
                    value={formatCurrency(stats.totalValue, currency).replace(currency, '')}
                    icon={DollarSign}
                    color="emerald"
                    subtitle={currency}
                />
                <StatCard
                    label="مخزون منخفض"
                    value={stats.lowStock}
                    icon={AlertTriangle}
                    color="amber"
                    subtitle="بحاجة لإعادة التزويد"
                />
                <StatCard
                    label="نفذ من المخزون"
                    value={stats.outOfStock}
                    icon={TrendingDown}
                    color="red"
                    subtitle="رصيد 0"
                />
            </StatsGrid>

            {/* Content Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
                {/* Low Stock Alert */}
                <div className="bg-surface border border-border/80 rounded-2xl p-5 flex flex-col overflow-hidden">
                    <h3 className="font-black text-text-main text-sm flex items-center gap-2.5 mb-3 shrink-0">
                        <div className="p-1.5 rounded-lg bg-warning/10 text-warning border border-warning/20">
                            <AlertTriangle size={18} />
                        </div>
                        تنبيهات المخزون المنخفض
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                        {lowStockProducts.length === 0 ? (
                            <div className="py-10 text-center text-text-muted text-xs font-bold">
                                <Package size={28} className="mx-auto mb-2 opacity-30 text-success" />
                                جميع المنتجات بمخزون كافٍ وممتاز
                            </div>
                        ) : (
                            lowStockProducts.slice(0, 10).map(p => (
                                <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border ${p.stock === 0 ? 'bg-danger/10 border-danger/30' : 'bg-warning/10 border-warning/30'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{p.image}</span>
                                        <div>
                                            <p className="text-text-main font-extrabold text-xs">{p.name}</p>
                                            <p className="text-text-muted text-[11px] font-medium">الحد الأدنى: {p.minStock}</p>
                                        </div>
                                    </div>
                                    <span className={`font-black text-lg font-mono ${p.stock === 0 ? 'text-danger' : 'text-warning'}`}>{p.stock}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent Stock Movements */}
                <div className="bg-surface border border-border/80 rounded-2xl p-5 flex flex-col overflow-hidden">
                    <h3 className="font-black text-text-main text-sm flex items-center gap-2.5 mb-3 shrink-0">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                            <Activity size={18} />
                        </div>
                        حركة المخزون الأخيرة
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pb-1">
                        {stockMovements.length === 0 ? (
                            <div className="py-10 text-center text-text-muted text-xs font-bold">
                                <Activity size={28} className="mx-auto mb-2 opacity-30" />
                                لا توجد حركات مسجلة
                            </div>
                        ) : (
                            stockMovements.slice(0, 10).map((m, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-surface-hover/80 border border-border/40">
                                    <div>
                                        <p className="text-text-main text-sm font-extrabold">{m.productName}</p>
                                        <p className="text-text-muted text-xs font-medium">{m.reason}</p>
                                    </div>
                                    <span className={`font-black font-mono text-base ${m.type === 'in' || m.type === 'restock' ? 'text-success' : 'text-danger'}`}>
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

const CustomersReportTab: React.FC<CustomersReportTabProps> = ({ customers, sales, currency }) => {
    const customerStats = useMemo(() => {
        const stats = customers.map(c => {
            const customerSales = sales.filter(s => s.customerId === c.id);
            const totalSpent = Math.round(customerSales.reduce((sum, s) => sum + (s.status === 'completed' ? s.total : 0), 0));
            const pendingDebt = Math.round(customerSales.filter(s => s.status === 'pending').reduce((sum, s) => sum + s.total, 0));
            return { ...c, totalSpent, pendingDebt, orderCount: customerSales.length };
        });
        return stats.sort((a, b) => b.totalSpent - a.totalSpent);
    }, [customers, sales]);

    const totalDebt = useMemo(() => Math.round(customerStats.reduce((sum, c) => sum + c.pendingDebt, 0)), [customerStats]);
    const totalSpent = useMemo(() => Math.round(customerStats.reduce((sum, c) => sum + c.totalSpent, 0)), [customerStats]);

    interface CustomerStat extends Customer {
        totalSpent: number;
        pendingDebt: number;
        orderCount: number;
    }

    const columns: ColumnDef<CustomerStat>[] = useMemo(() => [
        {
            header: 'العميل',
            accessorKey: 'name',
            cell: ({ getValue }) => <span className="font-extrabold text-text-main block min-w-[140px]">{String(getValue())}</span>,
        },
        {
            header: 'الهاتف',
            accessorKey: 'phone',
            cell: ({ getValue }) => <span className="text-text-muted font-mono font-bold">{(getValue() as string) || '-'}</span>,
        },
        {
            header: 'عدد الطلبات',
            accessorKey: 'orderCount',
            cell: ({ getValue }) => <span className="text-text-main font-mono font-black">{Number(getValue())}</span>,
        },
        {
            header: 'إجمالي المشتريات',
            accessorKey: 'totalSpent',
            cell: ({ getValue }) => <span className="text-success font-mono font-black">{formatCurrency(Number(getValue()), currency)}</span>,
        },
        {
            header: 'الديون المستحقة',
            accessorKey: 'pendingDebt',
            cell: ({ getValue }) => {
                const val = Number(getValue());
                return (
                    <span className={`font-mono font-black ${val > 0 ? 'text-danger' : 'text-text-muted'}`}>
                        {val > 0 ? formatCurrency(val, currency) : '-'}
                    </span>
                );
            },
        },
    ], [currency]);

    return (
        <div className="h-full flex flex-col gap-4 select-none">
            {/* Stats */}
            <StatsGrid columns={3}>
                <StatCard
                    label="إجمالي العملاء"
                    value={customers.length}
                    icon={Users}
                    color="purple"
                    subtitle="عميل مسجل"
                />
                <StatCard
                    label="إجمالي المشتريات"
                    value={formatCurrency(totalSpent, currency).replace(currency, '')}
                    icon={Wallet}
                    color="emerald"
                    subtitle={currency}
                />
                <StatCard
                    label="إجمالي الديون"
                    value={formatCurrency(totalDebt, currency).replace(currency, '')}
                    icon={CreditCard}
                    color="red"
                    subtitle={currency}
                />
            </StatsGrid>

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
            const totalSales = Math.round(staffSales.reduce((sum, sale) => sum + sale.total, 0));
            return { ...s, salesCount: staffSales.length, totalSales };
        }).sort((a, b) => b.totalSales - a.totalSales);
    }, [staffList, sales]);

    const totalSalesValue = useMemo(() => Math.round(staffStats.reduce((sum, s) => sum + s.totalSales, 0)), [staffStats]);

    return (
        <div className="h-full flex flex-col gap-4 select-none">
            {/* Stats */}
            <StatsGrid columns={3}>
                <StatCard
                    label="عدد الموظفين"
                    value={staffList.length}
                    icon={UserCheck}
                    color="blue"
                    subtitle="موظف مسجل"
                />
                <StatCard
                    label="إجمالي المبيعات"
                    value={formatCurrency(totalSalesValue, currency).replace(currency, '')}
                    icon={Receipt}
                    color="emerald"
                    subtitle={currency}
                />
                <StatCard
                    label="متوسط للموظف"
                    value={formatCurrency(staffList.length > 0 ? totalSalesValue / staffList.length : 0, currency).replace(currency, '')}
                    icon={Activity}
                    color="purple"
                    subtitle={currency}
                />
            </StatsGrid>

            {/* Staff Performance */}
            <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staffStats.map((s, i) => {
                    const percentage = totalSalesValue > 0 ? (s.totalSales / totalSalesValue) * 100 : 0;
                    return (
                        <div key={s.id} className="bg-surface border border-border/80 rounded-2xl p-5 flex flex-col justify-between">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${i === 0 ? 'bg-success text-primary-fg' : 'bg-surface-hover border border-border/60 text-text-muted'}`}>
                                    {i + 1}
                                </div>
                                <div>
                                    <p className="text-text-main font-extrabold text-sm">{s.name}</p>
                                    <p className="text-text-muted text-[11px] font-semibold">{s.role === 'admin' ? 'مدير' : s.role === 'manager' ? 'مشرف' : 'كاشير'}</p>
                                </div>
                            </div>
                            <div className="space-y-2 pt-1">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-text-muted font-extrabold">المبيعات</span>
                                    <span className="text-success font-black text-xs font-mono">{formatCurrency(s.totalSales, currency).replace(currency, '')}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-text-muted font-extrabold">عدد الفواتير</span>
                                    <span className="text-text-main font-black text-xs font-mono">{s.salesCount}</span>
                                </div>
                                <div className="w-full h-1.5 bg-surface-hover rounded-full overflow-hidden border border-border/40">
                                    <div className="h-full bg-success rounded-full transition-all duration-300"
                                        style={{ width: `${percentage}%` }} />
                                </div>
                                <p className="text-[10px] text-text-muted text-center font-extrabold">{percentage.toFixed(1)}% من الإجمالي</p>
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
    const { comparison: data, isLoading, isError } = useMonthlyComparison();

    useEffect(() => {
        if (isError) console.error('Failed to load monthly comparison');
    }, [isError]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <RefreshCw size={32} className="text-success animate-spin" />
            </div>
        );
    }

    const ChangeIndicator = ({ value, label }: { value: number; label: string }) => (
        <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border ${value >= 0 ? 'bg-success/10 border-success/20 text-success' : 'bg-danger/10 border-danger/20 text-danger'}`}>
            {value >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            <span className="font-black text-sm">{Math.abs(value).toFixed(1)}%</span>
            <span className="text-xs font-extrabold opacity-80">{label}</span>
        </div>
    );

    const MonthCard = ({ month, isCurrent }: { month: MonthData; isCurrent: boolean }) => (
        <div className={`bg-surface border rounded-2xl p-5 ${isCurrent ? 'border-success/40' : 'border-border/80'}`}>
            <div className="flex items-center gap-3 mb-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCurrent ? 'bg-success text-primary-fg' : 'bg-surface-hover text-text-muted border border-border/60'}`}>
                    <Calendar size={24} />
                </div>
                <div>
                    <h3 className="text-text-main font-black text-lg">{month.label}</h3>
                    <p className="text-text-muted text-xs font-extrabold">{isCurrent ? 'الشهر الحالي' : 'الشهر السابق'}</p>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-surface-hover/50 rounded-xl border border-border/40">
                    <div className="flex items-center gap-2">
                        <Wallet size={18} className="text-primary" />
                        <span className="text-text-muted text-xs font-extrabold">الإيرادات</span>
                    </div>
                    <span className="text-primary font-black text-base font-mono">{formatCurrency(month.revenue, currency).replace(currency, '')}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-surface-hover/50 rounded-xl border border-border/40">
                    <div className="flex items-center gap-2">
                        <Activity size={18} className="text-success" />
                        <span className="text-text-muted text-xs font-extrabold">صافي الربح</span>
                    </div>
                    <span className={`font-black text-base font-mono ${month.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(month.netProfit, currency).replace(currency, '')}
                    </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-surface-hover/50 rounded-xl border border-border/40">
                    <div className="flex items-center gap-2">
                        <Receipt size={18} className="text-primary" />
                        <span className="text-text-muted text-xs font-extrabold">عدد الطلبات</span>
                    </div>
                    <span className="text-primary font-black text-base font-mono">{month.orders}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-surface-hover/50 rounded-xl border border-border/40">
                    <div className="flex items-center gap-2">
                        <ShoppingBag size={18} className="text-warning" />
                        <span className="text-text-muted text-xs font-extrabold">متوسط الطلب</span>
                    </div>
                    <span className="text-warning font-black text-base font-mono">{formatCurrency(month.avgOrder, currency).replace(currency, '')}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-surface-hover/50 rounded-xl border border-border/40">
                    <div className="flex items-center gap-2">
                        <TrendingDown size={18} className="text-danger" />
                        <span className="text-text-muted text-xs font-extrabold">المصروفات</span>
                    </div>
                    <span className="text-danger font-black text-base font-mono">{formatCurrency(month.expenses, currency).replace(currency, '')}</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full overflow-y-auto custom-scrollbar pb-4 space-y-4 animate-in fade-in duration-200 select-none">
            {/* Change Indicators */}
            <div className="flex gap-3 justify-center flex-wrap">
                <ChangeIndicator value={data.revenueChange} label="الإيرادات" />
                <ChangeIndicator value={data.profitChange} label="الأرباح" />
                <ChangeIndicator value={data.ordersChange} label="الطلبات" />
            </div>

            {/* Month Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <MonthCard month={data.currentMonth} isCurrent={true} />
                <MonthCard month={data.previousMonth} isCurrent={false} />
            </div>

            {/* Visual Comparison Bar */}
            <div className="bg-surface border border-border/80 rounded-2xl p-5">
                <h3 className="text-text-main font-black text-base mb-4 flex items-center gap-2">
                    <BarChart3 size={20} className="text-success" />
                    مقارنة الإيرادات
                </h3>
                <div className="space-y-3">
                    <div>
                        <div className="flex justify-between text-xs mb-1.5 font-extrabold">
                            <span className="text-text-muted">{data.currentMonth.label}</span>
                            <span className="text-success font-mono font-black text-sm">{formatCurrency(data.currentMonth.revenue, currency)}</span>
                        </div>
                        <div className="h-7 bg-surface-hover rounded-xl overflow-hidden border border-border/40">
                            <div
                                className="h-full bg-success rounded-xl transition-all duration-500"
                                style={{ width: `${Math.min(100, (data.currentMonth.revenue / Math.max(data.currentMonth.revenue, data.previousMonth.revenue)) * 100)}%` }}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1.5 font-extrabold">
                            <span className="text-text-muted">{data.previousMonth.label}</span>
                            <span className="text-text-main font-mono font-black text-sm">{formatCurrency(data.previousMonth.revenue, currency)}</span>
                        </div>
                        <div className="h-7 bg-surface-hover rounded-xl overflow-hidden border border-border/40">
                            <div
                                className="h-full bg-gray-500/40 rounded-xl transition-all duration-500"
                                style={{ width: `${Math.min(100, (data.previousMonth.revenue / Math.max(data.currentMonth.revenue, data.previousMonth.revenue)) * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

