import React, { useState, useMemo, useDeferredValue } from 'react';
import { Landmark, TrendingDown, TrendingUp, Users, Trash2, Sparkles, Building2, Wallet, PieChart, Minus, FileText, ShoppingCart, LayoutDashboard, ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { formatCurrency, getLocalDateString } from '../../core/utils';
import { Badge, Modal, PageHeader, EmptyState } from '../../components/ui';
import { DataTable } from '../../components/shared/DataTable';
import { ConfirmModal } from '../../components/ConfirmModal';
import { DonutChart, SalesAreaChart } from '../../components/charts';
import { categorizeExpense, writeRestockEmail } from '../../core/ai';
import { api, Expense, Supplier } from '../../core/api';
import { invalidateAllData } from '../../core/queryClient';
import { PurchaseOrdersTab } from './components/PurchaseOrdersTab';
import { PageShell, StatsGrid, StatCard, TabNav, SearchInput } from '../../components/blocks';
import { usePreferences } from '../../components/PreferencesContext';
import { useFinanceData, useSuppliersPaged } from '../../hooks/useFinance';
import { Button } from '../../components/ds/Button';

export const FinancePage: React.FC = () => {
    const { notify, prefs } = usePreferences();
    const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'suppliers' | 'purchases'>('overview');
    const [showStats, setShowStats] = useState(false);
    const [search, setSearch] = useState('');
    const [supplierPage, setSupplierPage] = useState(1);
    const [supplierPageSize] = useState(50);
    const deferredSupplierSearch = useDeferredValue(search);

    // Suppliers Paged Query
    const { data: pagedSuppliersData } = useSuppliersPaged(
        supplierPage,
        supplierPageSize,
        activeTab === 'suppliers' ? deferredSupplierSearch : ''
    );

    // Expenses State
    const [expenseModal, setExpenseModal] = useState(false);
    const [expenseForm, setExpenseForm] = useState<Partial<Expense>>({});
    const [isCategorizing, setIsCategorizing] = useState(false);

    // Suppliers State
    const [supplierModal, setSupplierModal] = useState(false);
    const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({});
    const [emailModal, setEmailModal] = useState<string | null>(null);
    const [generatedEmail, setGeneratedEmail] = useState('');
    const [generatingEmail, setGeneratingEmail] = useState(false);

    // Generic Confirm Modal
    const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; type?: 'confirm' | 'warning' | 'error' | 'info'; confirmText?: string; onConfirm: () => void }>({
        open: false, title: '', message: '', onConfirm: () => { }
    });

    // React Query Cached Data
    const { data: financeData, isLoading: loading, refetch: loadData } = useFinanceData();
    const expenses = useMemo(() => financeData?.expenses || [], [financeData?.expenses]);
    const suppliers = useMemo(() => financeData?.suppliers || [], [financeData?.suppliers]);
    const sales = useMemo(() => financeData?.sales || [], [financeData?.sales]);
    const purchaseOrders = useMemo(() => financeData?.purchaseOrders || [], [financeData?.purchaseOrders]);

    // --- Analytics Engine ---
    const stats = useMemo(() => {
        // Financials
        const totalRevenue = Math.round(sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.total, 0));
        const totalExpenses = Math.round(expenses.reduce((sum, e) => sum + e.amount, 0));
        const totalPurchasesCost = Math.round(sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + Math.round((s.items || []).reduce((pSum, p) => pSum + (p.cost * p.qty), 0)), 0));

        const netProfit = totalRevenue - totalPurchasesCost - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // Debt - Calculate from Purchase Orders (not supplier.balance) for accuracy
        const totalSupplierDebt = Math.round(purchaseOrders.reduce((sum, po) => sum + ((po.totalAmount || 0) - (po.paidAmount || 0)), 0));
        const totalReceivables = Math.round(sales.filter(s => s.paymentMethod === 'credit' && s.status === 'pending').reduce((sum, s) => sum + s.total, 0));

        return { totalRevenue, totalExpenses, netProfit, profitMargin, totalSupplierDebt, totalReceivables };
    }, [sales, expenses, purchaseOrders]);

    // Charts Data
    const charts = useMemo(() => {
        // Expense Breakdown
        const catMap: Record<string, number> = {};
        expenses.forEach(e => catMap[e.category] = (catMap[e.category] || 0) + e.amount);
        const expenseBreakdown = Object.entries(catMap).map(([k, v]) => ({
            label: k === 'rent' ? 'إيجار' : k === 'salary' ? 'رواتب' : k === 'bills' ? 'فواتير' : k === 'maintenance' ? 'صيانة' : 'أخرى',
            value: v,
            color: k === 'rent' ? 'bg-primary' : k === 'salary' ? 'bg-primary' : k === 'bills' ? 'bg-warning' : 'bg-gray-500'
        }));

        // Monthly Trend (Last 6 Months)
        const trendData = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthKey = d.toISOString().slice(0, 7); // YYYY-MM

            const monthRevenue = Math.round(sales
                .filter(s => s.date.startsWith(monthKey) && s.status === 'completed')
                .reduce((sum, s) => sum + s.total, 0));

            return {
                label: d.toLocaleDateString('ar-IQ', { month: 'short' }),
                value: monthRevenue,
                formattedValue: formatCurrency(monthRevenue, prefs?.currency)
            };
        }).reverse();

        return { expenseBreakdown, trendData };
    }, [expenses, sales, prefs?.currency]);

    // Revenue Growth Percentage (Current Month vs Previous Month)
    const revenueGrowthPct = useMemo(() => {
        const now = new Date();
        const currentMonthKey = now.toISOString().slice(0, 7); // YYYY-MM
        
        const prev = new Date();
        prev.setMonth(prev.getMonth() - 1);
        const prevMonthKey = prev.toISOString().slice(0, 7);

        const currentMonthRev = Math.round(sales
            .filter(s => s.date.startsWith(currentMonthKey) && s.status === 'completed')
            .reduce((sum, s) => sum + s.total, 0));

        const prevMonthRev = Math.round(sales
            .filter(s => s.date.startsWith(prevMonthKey) && s.status === 'completed')
            .reduce((sum, s) => sum + s.total, 0));

        if (prevMonthRev === 0) return currentMonthRev > 0 ? 100 : 0;
        return ((currentMonthRev - prevMonthRev) / prevMonthRev) * 100;
    }, [sales]);

    // Top 4 Recent Expenses
    const recentExpenses = useMemo(() => {
        return [...expenses]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 4);
    }, [expenses]);

    // Debt Ratio and Label (Receivables vs Payables)
    const debtInfo = useMemo(() => {
        const total = stats.totalReceivables + stats.totalSupplierDebt;
        if (total === 0) {
            return { receivablesPct: 0, payablesPct: 0, label: 'لا توجد ديون' };
        }
        const recPct = Math.round((stats.totalReceivables / total) * 100);
        const payPct = 100 - recPct;
        let label = 'متزن';
        if (stats.totalReceivables > stats.totalSupplierDebt * 1.5) {
            label = 'ممتاز (مستحقاتنا أعلى)';
        } else if (stats.totalSupplierDebt > stats.totalReceivables * 1.5) {
            label = 'حذر (ديون الموردين أعلى)';
        }
        return { receivablesPct: recPct, payablesPct: payPct, label };
    }, [stats]);

    const getCategoryInfo = (category: string) => {
        switch (category) {
            case 'rent':
                return { label: 'إيجار', icon: Building2, bg: 'bg-primary/10', border: 'border-primary/20', text: 'text-primary' };
            case 'salary':
                return { label: 'رواتب', icon: Users, bg: 'bg-primary/10', border: 'border-primary/20', text: 'text-primary' };
            case 'bills':
                return { label: 'فواتير', icon: FileText, bg: 'bg-warning/10', border: 'border-warning/20', text: 'text-warning' };
            case 'maintenance':
                return { label: 'صيانة', icon: Minus, bg: 'bg-danger/10', border: 'border-danger/20', text: 'text-danger' };
            default:
                return { label: 'أخرى', icon: Landmark, bg: 'bg-gray-500/10', border: 'border-gray-500/20', text: 'text-gray-500' };
        }
    };

    // --- Actions ---

    const handleSaveExpense = async () => {
        if (!expenseForm.title || !expenseForm.amount) { notify('يرجى إدخال العنوان والمبلغ', 'error'); return; }
        try {
            const e = {
                id: expenseForm.id || '', // Empty ID = new
                title: expenseForm.title,
                amount: Number(expenseForm.amount),
                category: expenseForm.category || 'other',
                date: expenseForm.date || getLocalDateString(),
                notes: expenseForm.notes || ''
            } as Expense;
            await api.expenses.save(e);
            notify(expenseForm.id ? 'تم تحديث المصروف' : 'تم إضافة المصروف', 'success');
            setExpenseModal(false);
            invalidateAllData();
            loadData();
        } catch { notify('خطأ في الحفظ', 'error'); }
    };

    const handleAutoCategorize = async () => {
        if (!expenseForm.title) return;
        setIsCategorizing(true);
        try {
            const cat = await categorizeExpense(expenseForm.title);
            setExpenseForm(prev => ({ ...prev, category: cat }));
        } catch (e) {
            console.warn('AI categorization failed:', e);
        }
        setIsCategorizing(false);
    };

    const handleDeleteExpense = (id: string) => {
        setConfirmModal({
            open: true,
            title: 'حذف المصروف',
            message: 'هل أنت متأكد من حذف هذا المصروف؟',
            type: 'warning',
            confirmText: 'حذف',
            onConfirm: async () => {
                try {
                    await api.expenses.delete(id);
                    notify('تم الحذف', 'success');
                    invalidateAllData();
                    loadData();
                } catch { notify('خطأ في الحذف', 'error'); }
                setConfirmModal(prev => ({ ...prev, open: false }));
            }
        });
    };

    const handleDeleteSupplier = (id: string) => {
        const performDelete = async (force: boolean) => {
            try {
                await api.suppliers.delete(id, force);
                notify('تم حذف المورد', 'success');
                invalidateAllData();
                loadData();
                setConfirmModal(prev => ({ ...prev, open: false }));
            } catch (err: unknown) {
                // Try to parse the error as JSON (AppError)
                let appError: unknown = null;
                const errStr = String(err);
                try {
                    const jsonPart = errStr.includes('{') ? errStr.substring(errStr.indexOf('{')) : errStr;
                    appError = JSON.parse(jsonPart);
                } catch { /* Not JSON */ }

                // Check for allowForce option
                const appErr = appError as AppError | null;
                if (appErr?.options?.allowForce) {
                    setConfirmModal({
                        open: true,
                        title: 'تعذر الحذف - مطلوب تأكيد إضافي',
                        message: `${appErr.message}\n\n${appErr.hint || ''}`,
                        type: 'warning',
                        confirmText: 'حذف قسري (Force Delete)',
                        onConfirm: () => performDelete(true)
                    });
                    return;
                }

                const errorMsg = appErr?.message || errStr || 'خطأ في الحذف';
                notify(errorMsg, 'error');
                setConfirmModal(prev => ({ ...prev, open: false }));
            }
        };

        setConfirmModal({
            open: true,
            title: 'حذف المورد',
            message: 'هل أنت متأكد من حذف هذا المورد؟ سيتم حذف جميع البيانات المرتبطة به.',
            type: 'error',
            confirmText: 'حذف',
            onConfirm: () => performDelete(false)
        });
    };

    const handleSaveSupplier = async () => {
        if (!supplierForm.name) { notify('الاسم مطلوب', 'error'); return; }
        try {
            const s = {
                id: supplierForm.id || '',
                name: supplierForm.name,
                companyName: supplierForm.companyName || '',
                phone: supplierForm.phone || '',
                balance: Number(supplierForm.balance || 0),
                notes: supplierForm.notes || '',
                email: supplierForm.email || ''
            } as Supplier;
            await api.suppliers.save(s);
            notify(supplierForm.id ? 'تم التحديث' : 'تمت الإضافة', 'success');
            setSupplierModal(false);
            invalidateAllData();
            loadData();
        } catch { notify('خطأ في الحفظ', 'error'); }
    };

    const handleGenerateEmail = async (supplier: Supplier) => {
        setGeneratingEmail(true);
        setEmailModal(supplier.id);
        const text = await writeRestockEmail(supplier.name, prefs?.storeName || 'المتجر');
        setGeneratedEmail(text);
        setGeneratingEmail(false);
    };

    const filteredExpenses = expenses.filter(e => e.title.includes(search));
    const filteredSuppliers = suppliers.filter(s => s.name.includes(search) || s.companyName.includes(search));
    const suppliersList = pagedSuppliersData?.data || filteredSuppliers;
    const totalSuppliers = pagedSuppliersData?.total ?? filteredSuppliers.length;
    const totalSupplierPages = pagedSuppliersData?.totalPages ?? 1;

    const expenseColumns: ColumnDef<Expense, string | number>[] = [
        { accessorKey: 'title', header: 'العنوان', size: 250, cell: (info) => <div className="font-bold text-text-main text-sm">{info.getValue() as string}</div> },
        { accessorKey: 'date', header: 'التاريخ', size: 100, cell: (info) => <div className="text-text-muted font-mono text-xs">{info.getValue() as string}</div> },
        {
            accessorKey: 'category', header: 'الفئة', size: 100, cell: (info) => {
                const c = info.getValue() as string;
                return <Badge type="info" text={c === 'rent' ? 'إيجار' : c === 'salary' ? 'رواتب' : c === 'bills' ? 'فواتير' : 'أخرى'} />;
            }
        },
        {
            accessorKey: 'amount', header: 'المبلغ', size: 120, cell: (info) => (
                <div className="font-mono font-bold text-danger text-left">
                    {formatCurrency(info.getValue() as number, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                </div>
            )
        },
        {
            id: 'actions', header: 'إجراء', size: 60, cell: (info) => (
                <div className="flex justify-end">
                    <button title="حذف المصروف" onClick={(e) => { e.stopPropagation(); handleDeleteExpense(info.row.original.id); }} className="text-text-muted hover:text-danger p-2 rounded-lg bg-surface hover:bg-danger/10 transition-colors">
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <PageShell>
            <PageHeader title="الإدارة المالية" icon={Landmark} description="متابعة المصروفات، الأرباح، وديون الموردين." actions={
                <div className="flex gap-2 items-center">
                    <Button variant="danger" className="h-10 text-xs px-4" onClick={() => { setExpenseForm({}); setExpenseModal(true); }}>
                        <Minus size={14} strokeWidth={3} /> تسجيل مصروف
                    </Button>
                    <Button variant="soft" className="h-10 text-xs px-4" onClick={() => { setSupplierForm({}); setSupplierModal(true); }}>
                        <Users size={14} strokeWidth={3} /> إدارة الموردين
                    </Button>
                    <Button
                        onClick={() => setShowStats(!showStats)}
                        variant={showStats ? 'secondary' : 'primary'}
                        className={`h-10 w-10 p-0 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                            showStats ? 'bg-success/10 border-success/30 text-success' : 'bg-surface border-border/80 text-text-muted hover:text-text-main'
                        }`}
                        title={showStats ? 'إخفاء الإحصائيات' : 'عرض التحليل المالي'}
                    >
                        <LayoutDashboard size={18} />
                    </Button>
                </div>
            } />

            {/* Stats Row */}
            <StatsGrid columns={4} visible={showStats}>
                <StatCard icon={Wallet} label="صافي الأرباح" value={formatCurrency(stats.netProfit, prefs?.currency).replace(prefs?.currency || 'IQD', '')} color={stats.netProfit >= 0 ? 'emerald' : 'red'} subtitle={`هامش: ${stats.profitMargin.toFixed(1)}%`} />
                <StatCard icon={TrendingDown} label="المصروفات" value={formatCurrency(stats.totalExpenses, prefs?.currency).replace(prefs?.currency || 'IQD', '')} color="red" subtitle="إجمالي المصاريف" />
                <StatCard icon={Building2} label="ديون الموردين" value={formatCurrency(stats.totalSupplierDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')} color="orange" subtitle="مستحقات للدفع" />
                <StatCard icon={Users} label="ديون العملاء (لنا)" value={formatCurrency(stats.totalReceivables, prefs?.currency).replace(prefs?.currency || 'IQD', '')} color="blue" subtitle="مستحقات للتحصيل" />
            </StatsGrid>

            {/* Main Content */}
            <div className="flex-1 min-h-0 bg-surface border border-border/80 rounded-2xl flex flex-col overflow-hidden">
                {/* Tab Navigation */}
                <TabNav
                    tabs={[
                        { id: 'overview' as const, label: 'نظرة عامة', icon: PieChart },
                        { id: 'expenses' as const, label: 'سجل المصروفات', icon: FileText },
                        { id: 'suppliers' as const, label: 'قائمة الموردين', icon: Users },
                        { id: 'purchases' as const, label: 'أوامر الشراء', icon: ShoppingCart },
                    ]}
                    active={activeTab}
                    onChange={(tab) => setActiveTab(tab as 'overview' | 'expenses' | 'suppliers' | 'purchases')}
                />

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 select-none">
                    {activeTab === 'overview' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            {/* 1. Top KPI Summary Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {/* Total Revenue */}
                                <div className="bg-bg/80 dark:bg-black/30 border border-border/80 rounded-xl p-3.5 flex items-center justify-between shadow-3xs">
                                    <div>
                                        <p className="text-[10px] font-bold text-text-muted uppercase">إجمالي الإيرادات</p>
                                        <p className="text-base sm:text-lg font-black font-mono text-text-main mt-0.5">
                                            {formatCurrency(stats.totalRevenue, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                                        </p>
                                    </div>
                                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                                        <TrendingUp size={18} />
                                    </div>
                                </div>

                                {/* Net Profit */}
                                <div className="bg-bg/80 dark:bg-black/30 border border-border/80 rounded-xl p-3.5 flex items-center justify-between shadow-3xs">
                                    <div>
                                        <p className="text-[10px] font-bold text-text-muted uppercase">صافي الأرباح</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className={`text-base sm:text-lg font-black font-mono ${stats.netProfit >= 0 ? 'text-primary' : 'text-danger'}`}>
                                                {formatCurrency(stats.netProfit, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                                            </p>
                                            <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-surface border border-border/70 text-text-muted">
                                                {stats.profitMargin.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${stats.netProfit >= 0 ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-danger/10 border-danger/20 text-danger'}`}>
                                        <Wallet size={18} />
                                    </div>
                                </div>

                                {/* Total Expenses */}
                                <div className="bg-bg/80 dark:bg-black/30 border border-border/80 rounded-xl p-3.5 flex items-center justify-between shadow-3xs">
                                    <div>
                                        <p className="text-[10px] font-bold text-text-muted uppercase">المصروفات</p>
                                        <p className="text-base sm:text-lg font-black font-mono text-danger mt-0.5">
                                            {formatCurrency(stats.totalExpenses, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                                        </p>
                                    </div>
                                    <div className="w-9 h-9 rounded-lg bg-danger/10 border border-danger/20 flex items-center justify-center text-danger shrink-0">
                                        <TrendingDown size={18} />
                                    </div>
                                </div>

                                {/* Supplier Debt */}
                                <div className="bg-bg/80 dark:bg-black/30 border border-border/80 rounded-xl p-3.5 flex items-center justify-between shadow-3xs">
                                    <div>
                                        <p className="text-[10px] font-bold text-text-muted uppercase">ديون الموردين</p>
                                        <p className="text-base sm:text-lg font-black font-mono text-warning mt-0.5">
                                            {formatCurrency(stats.totalSupplierDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                                        </p>
                                    </div>
                                    <div className="w-9 h-9 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center text-warning shrink-0">
                                        <Building2 size={18} />
                                    </div>
                                </div>
                            </div>

                            {/* 2. Charts Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* Revenue Growth Chart */}
                                <div className="lg:col-span-2 bg-surface border border-border/80 rounded-xl p-4 min-h-[230px] relative shadow-3xs flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp size={16} className="text-primary" />
                                            <h3 className="text-text-main font-black text-xs">نمو الإيرادات (6 أشهر)</h3>
                                        </div>

                                        {/* Dynamic Growth Badge */}
                                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${
                                            revenueGrowthPct >= 0 
                                                ? 'bg-primary/10 text-primary border-primary/20' 
                                                : 'bg-danger/10 text-danger border-danger/20'
                                        }`}>
                                            {revenueGrowthPct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                            <span>{Math.abs(revenueGrowthPct).toFixed(1)}%</span>
                                        </div>
                                    </div>

                                    <div className="h-[160px] w-full">
                                        <SalesAreaChart data={charts.trendData} />
                                    </div>
                                </div>

                                {/* Expense Breakdown Donut */}
                                <div className="bg-surface border border-border/80 rounded-xl p-4 min-h-[230px] flex flex-col shadow-3xs justify-between">
                                    <div className="flex items-center gap-2 mb-2">
                                        <PieChart size={16} className="text-primary" />
                                        <h3 className="text-text-main font-black text-xs">توزيع المصروفات</h3>
                                    </div>

                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="w-full h-full max-h-[160px]">
                                            <DonutChart data={charts.expenseBreakdown} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Bottom Row: Recent Expenses & Financial Ratios */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* Recent Expenses List */}
                                <div className="lg:col-span-2 bg-surface border border-border/80 rounded-xl p-4 shadow-3xs flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-primary" />
                                            <h3 className="text-xs font-black text-text-main">أحدث المصروفات</h3>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setActiveTab('expenses')}
                                            className="text-xs font-bold text-primary hover:underline cursor-pointer"
                                        >
                                            عرض الكل
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {recentExpenses.length === 0 ? (
                                            <div className="py-6 text-center text-xs text-text-muted">
                                                لا توجد مصروفات مسجلة
                                            </div>
                                        ) : (
                                            recentExpenses.map(e => {
                                                const catInfo = getCategoryInfo(e.category);
                                                const CatIcon = catInfo.icon;
                                                return (
                                                    <div 
                                                        key={e.id}
                                                        className="flex items-center justify-between p-2.5 rounded-lg bg-bg/80 dark:bg-black/30 border border-border/60"
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`w-8 h-8 rounded-lg ${catInfo.bg} ${catInfo.border} border flex items-center justify-center shrink-0`}>
                                                                <CatIcon size={14} className={catInfo.text} />
                                                            </div>
                                                            <div>
                                                                <h4 className="text-xs font-bold text-text-main">{e.title}</h4>
                                                                <p className="text-[10px] text-text-muted font-mono">{e.date}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface border border-border/70 text-text-muted">
                                                                {catInfo.label}
                                                            </span>
                                                            <span className="font-mono font-black text-danger text-xs">
                                                                -{formatCurrency(e.amount, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Financial Indicators */}
                                <div className="bg-surface border border-border/80 rounded-xl p-4 shadow-3xs flex flex-col justify-between space-y-3">
                                    <h3 className="text-xs font-black text-text-main pb-2 border-b border-border/60">المؤشرات المباشرة</h3>
                                    
                                    {/* Profit Margin Widget */}
                                    <div className="bg-bg/80 dark:bg-black/30 border border-border/70 rounded-lg p-3 space-y-2">
                                        <div className="flex justify-between items-center text-xs font-bold">
                                            <span className="text-text-muted">هامش الربح التشغيلي</span>
                                            <span className={`font-mono ${stats.profitMargin >= 20 ? 'text-primary' : 'text-warning'}`}>
                                                {stats.profitMargin.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-border/60 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-300 ${
                                                    stats.profitMargin >= 20 ? 'bg-primary' : 'bg-warning'
                                                }`}
                                                style={{ width: `${Math.max(0, Math.min(100, stats.profitMargin))}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Receivables vs Payables Ratio */}
                                    <div className="bg-bg/80 dark:bg-black/30 border border-border/70 rounded-lg p-3 space-y-2">
                                        <div className="flex justify-between items-center text-xs font-bold">
                                            <span className="text-text-muted">ميزان الديون</span>
                                            <span className="text-[11px] text-text-main font-mono">{debtInfo.label}</span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                                            <span className="text-primary">لنا: {formatCurrency(stats.totalReceivables, prefs?.currency).replace(prefs?.currency || 'IQD', '')}</span>
                                            <span className="text-warning">علينا: {formatCurrency(stats.totalSupplierDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')}</span>
                                        </div>

                                        <div className="w-full h-1.5 bg-border/60 rounded-full overflow-hidden flex">
                                            <div 
                                                className="h-full bg-primary transition-all duration-300"
                                                style={{ width: `${debtInfo.receivablesPct}%` }}
                                            />
                                            <div 
                                                className="h-full bg-warning transition-all duration-300"
                                                style={{ width: `${debtInfo.payablesPct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'expenses' && (
                        <div className="space-y-4">
                            <SearchInput value={search} onChange={setSearch} placeholder="بحث في المصروفات..." />
                            {filteredExpenses.length === 0 ? <EmptyState icon={FileText} title="لا توجد مصروفات" /> : (
                                <DataTable 
                                    columns={expenseColumns} 
                                    data={filteredExpenses} 
                                    searchQuery={search} 
                                    getRowColor={() => 'red'}
                                    onRowClick={(row) => {
                                        setExpenseForm(row);
                                        setExpenseModal(true);
                                    }}
                                />
                            )}
                        </div>
                    )}

                    {activeTab === 'suppliers' && (
                        <div className="space-y-4">
                            <SearchInput value={search} onChange={(val) => { setSearch(val); setSupplierPage(1); }} placeholder="بحث عن مورد..." />
                            {suppliersList.length === 0 ? <EmptyState icon={Users} title="لا يوجد موردين" /> : (
                                <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-[var(--shadow-card)] flex-1 flex flex-col min-h-0">
                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-right text-sm border-collapse">
                                            <thead className="sticky top-0 z-10 bg-surface-hover border-b border-border text-text-muted text-xs">
                                                <tr>
                                                    <th className="px-4 py-3 text-right">المورد</th>
                                                    <th className="px-4 py-3 text-right w-[200px]">الرصيد (له)</th>
                                                    <th className="px-4 py-3 text-left w-[300px] pl-8">الإجراءات</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {suppliersList.map((s) => (
                                                    <tr
                                                        key={s.id}
                                                        className="border-b border-border/30 hover:bg-surface-hover transition-colors group"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center text-text-muted group-hover:text-primary transition-colors shrink-0 shadow-inner">
                                                                    <Building2 size={18} />
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-text-main text-xs group-hover:text-primary transition-colors">{s.name}</p>
                                                                    <p className="text-[10px] text-text-muted">{s.companyName}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold text-text-main text-base">
                                                            {formatCurrency(s.balance, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                                                        </td>
                                                        <td className="px-4 py-3 text-left pl-8" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <button onClick={() => { setSupplierForm(s); setSupplierModal(true); }} className="px-2.5 py-1.5 hover:bg-surface-hover hover:text-text-main text-text-muted rounded-xl text-[10px] font-bold border border-border/40 transition-colors">تعديل</button>
                                                                <button onClick={() => handleGenerateEmail(s)} className="px-2.5 py-1.5 hover:bg-primary/10 text-primary hover:text-primary rounded-xl text-[10px] font-bold border border-primary/20 transition-colors flex items-center gap-1"><Sparkles size={10} className="inline mr-1" /> ايميل طلبية</button>
                                                                <div className="w-px h-5 bg-border/60 mx-0.5"></div>
                                                                <button onClick={() => handleDeleteSupplier(s.id)} className="p-1.5 hover:bg-danger/10 rounded-xl text-text-muted hover:text-danger border border-border/40 transition-colors" title="حذف المورد"><Trash2 size={13} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Suppliers Pagination Controls */}
                                    <div className="shrink-0 py-3 flex items-center justify-between border-t border-border px-4 bg-surface rounded-b-xl">
                                        <span className="text-[10px] text-text-muted font-mono flex items-center gap-2 font-bold">
                                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]"></div>
                                            عرض {suppliersList.length} من {totalSuppliers} مورد
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={supplierPage <= 1}
                                                onClick={() => setSupplierPage(p => Math.max(1, p - 1))}
                                                className="p-2 bg-bg border border-border rounded-xl text-text-main hover:bg-surface-hover disabled:opacity-30 transition-colors"
                                                title="الصفحة السابقة"
                                            >
                                                <ArrowRight size={16} className="rotate-180" />
                                            </button>
                                            <span className="text-xs font-bold text-text-main min-w-[32px] text-center bg-bg py-2 px-3 rounded-xl border border-border">
                                                {supplierPage} / {totalSupplierPages}
                                            </span>
                                            <button
                                                disabled={supplierPage >= totalSupplierPages}
                                                onClick={() => setSupplierPage(p => p + 1)}
                                                className="p-2 bg-bg border border-border rounded-xl text-text-main hover:bg-surface-hover disabled:opacity-30 transition-colors"
                                                title="الصفحة التالية"
                                            >
                                                <ArrowRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'purchases' && (
                        <PurchaseOrdersTab
                            notify={notify}
                            currency={prefs?.currency}
                            suppliers={suppliers}
                            onRefresh={loadData}
                        />
                    )}
                </div>
            </div>

            {/* Modals */}
            {expenseModal && <Modal title="تسجيل مصروف جديد" onClose={() => setExpenseModal(false)}>
                <div className="space-y-4 pt-2">
                    <div className="bg-bg p-4 rounded-2xl border border-border space-y-4">
                        <div>
                            <label className="text-xs font-bold text-text-muted mb-1 block">عنوان المصروف</label>
                            <div className="flex gap-2">
                                <input className="flex-1 bg-input-bg border border-border rounded-xl px-4 py-2.5 text-sm" value={expenseForm.title || ''} onChange={e => setExpenseForm({ ...expenseForm, title: e.target.value })} placeholder="مثال: فاتورة مولدة" />
                                <button title="تصنيف تلقائي بالذكاء الاصطناعي" onClick={handleAutoCategorize} disabled={isCategorizing} className="bg-primary/10 text-primary p-2 rounded-xl border border-primary/20 hover:bg-primary hover:text-white transition-all"><Sparkles size={18} className={isCategorizing ? 'animate-spin' : ''} /></button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-muted mb-1 block">المبلغ</label>
                            <input title="المبلغ" type="number" className="w-full bg-input-bg border border-border rounded-xl px-4 py-2.5 text-sm font-mono" value={expenseForm.amount || ''} onChange={e => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })} placeholder="0" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-text-muted mb-1 block">التاريخ</label>
                                <input type="date" className="w-full bg-input-bg border border-border rounded-xl px-4 py-2.5 text-sm" value={expenseForm.date || getLocalDateString()} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} aria-label="تاريخ المصروف" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-text-muted mb-1 block">الفئة</label>
                                <select title="اختر الفئة" className="w-full bg-input-bg border border-border rounded-xl px-4 py-2.5 text-sm" value={expenseForm.category || 'other'} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                                    <option value="rent">إيجار</option>
                                    <option value="salary">رواتب</option>
                                    <option value="bills">فواتير</option>
                                    <option value="maintenance">صيانة</option>
                                    <option value="other">أخرى</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleSaveExpense} className="w-full bg-primary text-primary-fg font-black py-4 rounded-xl hover:brightness-110 shadow-lg active:scale-95 transition-all text-sm">حفظ</button>
                </div>
            </Modal>}

            {supplierModal && <Modal title="بيانات المورد" onClose={() => setSupplierModal(false)}>
                <div className="space-y-4 pt-2">
                    <div className="bg-bg p-4 rounded-2xl border border-border space-y-4">
                        <input className="w-full bg-input-bg border border-border rounded-xl px-4 py-2.5 text-sm font-bold" value={supplierForm.name || ''} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} placeholder="اسم المندوب / الشخص" />
                        <input className="w-full bg-input-bg border border-border rounded-xl px-4 py-2.5 text-sm" value={supplierForm.companyName || ''} onChange={e => setSupplierForm({ ...supplierForm, companyName: e.target.value })} placeholder="اسم الشركة" />
                        <input className="w-full bg-input-bg border border-border rounded-xl px-4 py-2.5 text-sm" value={supplierForm.phone || ''} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} placeholder="رقم الهاتف" />
                    </div>
                    <button onClick={handleSaveSupplier} className="w-full bg-primary text-primary-fg font-black py-4 rounded-xl hover:brightness-110 shadow-lg active:scale-95 transition-all text-sm">حفظ</button>
                </div>
            </Modal>}

            {emailModal && <Modal title="إنشاء ايميل طلبية (AI)" onClose={() => setEmailModal(null)}>
                <div className="space-y-4 pt-2">
                    <div className="bg-bg p-4 rounded-2xl border border-border min-h-[150px] relative">
                        {generatingEmail ? <div className="absolute inset-0 flex items-center justify-center text-primary gap-2"><Sparkles className="animate-spin" /> جاري الكتابة...</div> : (
                            <textarea className="w-full h-40 bg-transparent outline-none text-sm leading-relaxed resize-none" value={generatedEmail} onChange={e => setGeneratedEmail(e.target.value)} aria-label="محتوى الإيميل"></textarea>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { navigator.clipboard.writeText(generatedEmail); notify('تم النسخ', 'success'); }} className="flex-1 bg-surface border border-border rounded-xl py-3 font-bold text-xs hover:bg-surface-hover">نسخ النص</button>
                        <a href={`mailto:?subject=Order&body=${encodeURIComponent(generatedEmail)}`} className="flex-1 bg-primary text-primary-fg rounded-xl py-3 font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110">فتح الإيميل</a>
                    </div>
                </div>
            </Modal>}

            <ConfirmModal
                isOpen={confirmModal.open}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText}
                cancelText="إلغاء"
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, open: false }))}
            />
        </PageShell>
    );
};
