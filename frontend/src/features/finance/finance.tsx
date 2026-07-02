import React, { useState, useMemo, useEffect } from 'react';
import { Landmark, TrendingDown, TrendingUp, Users, Plus, Search, Trash2, Sparkles, Building2, Wallet, PieChart, Minus, FileText, ShoppingCart, LayoutDashboard, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { formatCurrency, getLocalDateString } from '../../core/utils';
import { Badge, Modal, PageHeader, SpotlightCard, EmptyState } from '../../components/ui';
import { DataTable } from '../../components/shared/DataTable';
import { ConfirmModal } from '../../components/ConfirmModal';
import { DonutChart, SalesAreaChart } from '../../components/charts';
import { categorizeExpense, writeRestockEmail } from '../../core/ai';
import { api, Expense, Supplier, Sale, PurchaseOrder } from '../../core/api';
import { PurchaseOrdersTab } from './components/PurchaseOrdersTab';
import { PageShell, StatsGrid, StatCard, LoadingState, TabNav, SearchInput } from '../../components/blocks';
import { usePreferences } from '../../components/PreferencesContext';

export const FinancePage: React.FC = () => {
    const { notify, prefs } = usePreferences();
    const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'suppliers' | 'purchases'>('overview');
    const [showStats, setShowStats] = useState(false);
    const [search, setSearch] = useState('');

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

    // Local Data
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            setLoading(true);
            const [e, s, saData, poData] = await Promise.all([
                api.expenses.list(),
                api.suppliers.list(),
                api.sales.list(0, 5000, '', '', ''),
                api.purchaseOrders.list('')
            ]);
            setExpenses(e);
            setSuppliers(s);
            setSales(saData.data);
            setPurchaseOrders(poData || []);
        } catch (err) {
            console.error(err);
            notify('خطأ في تحميل البيانات المالية', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // --- Analytics Engine ---
    const stats = useMemo(() => {
        // Financials
        const totalRevenue = sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.total, 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalPurchasesCost = sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + (s.items || []).reduce((pSum, p) => pSum + (p.cost * p.qty), 0), 0);

        const netProfit = totalRevenue - totalPurchasesCost - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // Debt - Calculate from Purchase Orders (not supplier.balance) for accuracy
        const totalSupplierDebt = purchaseOrders.reduce((sum, po) => sum + ((po.totalAmount || 0) - (po.paidAmount || 0)), 0);
        const totalReceivables = sales.filter(s => s.paymentMethod === 'credit' && s.status === 'pending').reduce((sum, s) => sum + s.total, 0);

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
            color: k === 'rent' ? 'bg-blue-500' : k === 'salary' ? 'bg-purple-500' : k === 'bills' ? 'bg-orange-500' : 'bg-gray-500'
        }));

        // Monthly Trend (Last 6 Months)
        const trendData = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthKey = d.toISOString().slice(0, 7); // YYYY-MM

            const monthRevenue = sales
                .filter(s => s.date.startsWith(monthKey) && s.status === 'completed')
                .reduce((sum, s) => sum + s.total, 0);

            return {
                label: d.toLocaleDateString('ar-IQ', { month: 'short' }),
                value: monthRevenue,
                formattedValue: formatCurrency(monthRevenue, prefs?.currency)
            };
        }).reverse();

        return { expenseBreakdown, trendData };
    }, [expenses, sales]);

    // Revenue Growth Percentage (Current Month vs Previous Month)
    const revenueGrowthPct = useMemo(() => {
        const now = new Date();
        const currentMonthKey = now.toISOString().slice(0, 7); // YYYY-MM
        
        const prev = new Date();
        prev.setMonth(prev.getMonth() - 1);
        const prevMonthKey = prev.toISOString().slice(0, 7);

        const currentMonthRev = sales
            .filter(s => s.date.startsWith(currentMonthKey) && s.status === 'completed')
            .reduce((sum, s) => sum + s.total, 0);

        const prevMonthRev = sales
            .filter(s => s.date.startsWith(prevMonthKey) && s.status === 'completed')
            .reduce((sum, s) => sum + s.total, 0);

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
            return { receivablesPct: 50, payablesPct: 50, label: 'متزن' };
        }
        const recPct = (stats.totalReceivables / total) * 100;
        const payPct = (stats.totalSupplierDebt / total) * 100;
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
                return { label: 'إيجار', icon: Building2, bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-500' };
            case 'salary':
                return { label: 'رواتب', icon: Users, bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-500' };
            case 'bills':
                return { label: 'فواتير', icon: FileText, bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-500' };
            case 'maintenance':
                return { label: 'صيانة', icon: Minus, bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-500' };
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
            loadData();
        } catch (_e) { notify('خطأ في الحفظ', 'error'); }
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
                    loadData();
                } catch (_e) { notify('خطأ في الحذف', 'error'); }
                setConfirmModal(prev => ({ ...prev, open: false }));
            }
        });
    };

    const handleDeleteSupplier = (id: string) => {
        const performDelete = async (force: boolean) => {
            try {
                await api.suppliers.delete(id, force);
                notify('تم حذف المورد', 'success');
                loadData();
                setConfirmModal(prev => ({ ...prev, open: false }));
            } catch (err: unknown) {
                // Try to parse the error as JSON (AppError)
                let appError: unknown = null;
                const errStr = String(err);
                try {
                    const jsonPart = errStr.includes('{') ? errStr.substring(errStr.indexOf('{')) : errStr;
                    appError = JSON.parse(jsonPart);
                } catch (e) { /* Not JSON */ }

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
            loadData();
        } catch (_e) { notify('خطأ في الحفظ', 'error'); }
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

    const expenseColumns: ColumnDef<Expense, any>[] = [
        { accessorKey: 'title', header: 'العنوان', size: 250, cell: (info) => <div className="font-bold text-text-main text-sm">{info.getValue()}</div> },
        { accessorKey: 'date', header: 'التاريخ', size: 100, cell: (info) => <div className="text-text-muted font-mono text-xs">{info.getValue()}</div> },
        {
            accessorKey: 'category', header: 'الفئة', size: 100, cell: (info) => {
                const c = info.getValue();
                return <Badge type="info" text={c === 'rent' ? 'إيجار' : c === 'salary' ? 'رواتب' : c === 'bills' ? 'فواتير' : 'أخرى'} />;
            }
        },
        {
            accessorKey: 'amount', header: 'المبلغ', size: 120, cell: (info) => (
                <div className="font-mono font-bold text-red-500 text-left">
                    {formatCurrency(info.getValue(), prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                </div>
            )
        },
        {
            id: 'actions', header: 'إجراء', size: 60, cell: (info) => (
                <div className="flex justify-end">
                    <button title="حذف المصروف" onClick={(e) => { e.stopPropagation(); handleDeleteExpense(info.row.original.id); }} className="text-text-muted hover:text-red-500 p-2 rounded-lg bg-surface hover:bg-red-500/10 transition-colors">
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    if (loading) return <LoadingState icon={Landmark} title="جاري تحميل البيانات المالية..." subtitle="يرجى الانتظار" />;

    return (
        <PageShell>
            <PageHeader title="الإدارة المالية" icon={Landmark} description="متابعة المصروفات، الأرباح، وديون الموردين." actions={
                <div className="flex gap-2">
                    <button onClick={() => { setExpenseForm({}); setExpenseModal(true); }} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 h-10 px-4 rounded-xl font-bold flex items-center gap-2 transition-all text-xs touch-target active:scale-95"><Minus size={16} /> تسجيل مصروف</button>
                    <button onClick={() => { setSupplierForm({}); setSupplierModal(true); }} className="bg-primary/10 text-primary hover:bg-primary hover:text-black border border-primary/20 h-10 px-4 rounded-xl font-bold flex items-center gap-2 transition-all text-xs touch-target active:scale-95"><Users size={16} /> إدارة الموردين</button>
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${showStats
                            ? 'bg-surface border border-border text-text-muted hover:text-text-main'
                            : 'bg-gradient-to-br from-primary to-emerald-500 text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105'
                            }`}
                        title={showStats ? 'إخفاء الإحصائيات' : 'عرض التحليل المالي'}
                    >
                        <LayoutDashboard size={showStats ? 18 : 20} />
                    </button>
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
            <div className="flex-1 min-h-0 bg-surface border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm">
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

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            {/* Charts Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Revenue Growth Chart */}
                                <div className="lg:col-span-2 bg-gradient-to-b from-surface to-surface-hover/20 border border-border rounded-3xl p-6 h-[400px] relative overflow-hidden group hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                                    {/* Decorative subtle background glows */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/8 transition-all duration-500" />
                                    
                                    <div className="flex items-center justify-between mb-6 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <TrendingUp size={22} className="text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="text-text-main font-black text-base">نمو الإيرادات</h3>
                                                <p className="text-xs text-text-muted">مقارنة وتدفق المبيعات لآخر 6 أشهر</p>
                                            </div>
                                        </div>

                                        {/* Dynamic Growth Badge */}
                                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md select-none ${
                                            revenueGrowthPct >= 0 
                                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                                                : 'bg-red-500/10 text-red-500 border-red-500/20'
                                        }`}>
                                            {revenueGrowthPct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                            <span>{Math.abs(revenueGrowthPct).toFixed(1)}%</span>
                                            <span className="text-[10px] opacity-75 font-normal">الشهر الحالي</span>
                                        </div>
                                    </div>

                                    <div className="h-[280px] w-full relative z-10">
                                        <SalesAreaChart data={charts.trendData} />
                                    </div>
                                </div>

                                {/* Expense Breakdown Donut */}
                                <div className="bg-gradient-to-b from-surface to-surface-hover/20 border border-border rounded-3xl p-6 h-[400px] flex flex-col group hover:border-red-500/30 hover:shadow-lg transition-all duration-300 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-48 h-48 bg-red-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-red-500/8 transition-all duration-500" />
                                    
                                    <div className="flex items-center gap-3 mb-6 relative z-10">
                                        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                            <PieChart size={22} className="text-red-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-text-main font-black text-base">توزيع المصروفات</h3>
                                            <p className="text-xs text-text-muted">حسب الفئات النشطة في النظام</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex items-center justify-center relative z-10">
                                        <div className="w-full h-full max-h-[280px]">
                                            <DonutChart data={charts.expenseBreakdown} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Second Row: Recent Transactions & Quick Metrics */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Recent Expenses List */}
                                <div className="lg:col-span-2 bg-surface border border-border rounded-3xl p-6 hover:shadow-md transition-all duration-300 flex flex-col">
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-10 h-10 rounded-xl bg-surface-hover border border-border flex items-center justify-center">
                                                <FileText size={18} className="text-text-muted" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-text-main">أحدث المصروفات المسجلة</h3>
                                                <p className="text-[10px] text-text-muted">مراقبة سريعة لآخر التدفقات النقدية الخارجة</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setActiveTab('expenses')}
                                            className="text-xs font-bold text-primary hover:underline transition-all"
                                        >
                                            عرض السجل بالكامل
                                        </button>
                                    </div>

                                    <div className="flex-1 space-y-3">
                                        {recentExpenses.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-xs text-text-muted py-8">
                                                لا توجد مصروفات مسجلة بعد
                                            </div>
                                        ) : (
                                            recentExpenses.map(e => {
                                                const catInfo = getCategoryInfo(e.category);
                                                const CatIcon = catInfo.icon;
                                                return (
                                                    <div 
                                                        key={e.id}
                                                        className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-hover/30 border border-border/30 hover:border-border hover:bg-surface-hover/60 transition-all duration-200"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-xl ${catInfo.bg} ${catInfo.border} border flex items-center justify-center`}>
                                                                <CatIcon size={16} className={catInfo.text} />
                                                            </div>
                                                            <div>
                                                                <h4 className="text-xs font-black text-text-main">{e.title}</h4>
                                                                <p className="text-[10px] text-text-muted font-mono mt-0.5">{e.date}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-surface border border-border text-text-muted">
                                                                {catInfo.label}
                                                            </span>
                                                            <span className="font-mono font-black text-red-500 text-sm">
                                                                -{formatCurrency(e.amount, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Quick Financial Metrics & Health indicator */}
                                <div className="bg-surface border border-border rounded-3xl p-6 hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-6">
                                    <div>
                                        <h3 className="text-sm font-black text-text-main mb-1">الوضع المالي العام</h3>
                                        <p className="text-[10px] text-text-muted mb-4">مؤشرات السيولة والربحية التقديرية</p>
                                        
                                        {/* Profit Margin Widget */}
                                        <div className="bg-surface-hover/40 border border-border/50 rounded-2xl p-4 mb-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[11px] font-bold text-text-muted">هامش الربح التشغيلي</span>
                                                <span className={`text-xs font-bold font-mono ${stats.profitMargin >= 20 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                    {stats.profitMargin.toFixed(1)}%
                                                </span>
                                            </div>
                                            {/* Beautiful custom progress bar */}
                                            <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        stats.profitMargin >= 30 
                                                            ? 'bg-emerald-500' 
                                                            : stats.profitMargin >= 15 
                                                            ? 'bg-primary' 
                                                            : stats.profitMargin > 0 
                                                            ? 'bg-amber-500' 
                                                            : 'bg-red-500'
                                                    }`}
                                                    style={{ width: `${Math.max(0, Math.min(100, stats.profitMargin))}%` }}
                                                />
                                            </div>
                                            <p className="text-[9px] text-text-muted mt-2">
                                                {stats.profitMargin >= 20 
                                                    ? 'معدل ربحية ممتاز ومستقر للنشاط التجاري' 
                                                    : stats.profitMargin > 0 
                                                    ? 'معدل ربحية مقبول، يرجى ترشيد المصروفات لزيادة الهامش' 
                                                    : 'تنبيه: النشاط التجاري يسجل خسائر حالياً!'}
                                            </p>
                                        </div>

                                        {/* Receivables vs Payables Ratio */}
                                        <div className="bg-surface-hover/40 border border-border/50 rounded-2xl p-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[11px] font-bold text-text-muted">نسبة الديون (لنا / علينا)</span>
                                                <span className="text-xs font-bold text-text-main font-mono">
                                                    {debtInfo.label}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 text-[10px] font-bold mb-3">
                                                <div className="flex items-center gap-1 text-blue-500">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                                    <span>لنا: {formatCurrency(stats.totalReceivables, prefs?.currency).replace(prefs?.currency || 'IQD', '')}</span>
                                                </div>
                                                <span className="text-text-muted mx-1">|</span>
                                                <div className="flex items-center gap-1 text-orange-500">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                                                    <span>علينا: {formatCurrency(stats.totalSupplierDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')}</span>
                                                </div>
                                            </div>

                                            <div className="w-full h-2 bg-border rounded-full overflow-hidden flex">
                                                <div 
                                                    className="h-full bg-blue-500 transition-all duration-500"
                                                    style={{ width: `${debtInfo.receivablesPct}%` }}
                                                    title={`المستحقات لنا: ${debtInfo.receivablesPct.toFixed(0)}%`}
                                                />
                                                <div 
                                                    className="h-full bg-orange-500 transition-all duration-500"
                                                    style={{ width: `${debtInfo.payablesPct}%` }}
                                                    title={`الديون علينا: ${debtInfo.payablesPct.toFixed(0)}%`}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Quick Button */}
                                    <button 
                                        onClick={() => setShowStats(true)} 
                                        className="w-full py-3 bg-primary/10 text-primary hover:bg-primary hover:text-black border border-primary/20 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                    >
                                        <LayoutDashboard size={14} />
                                        عرض لوحة المؤشرات العلوية بالكامل
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'expenses' && (
                        <div className="space-y-4">
                            <SearchInput value={search} onChange={setSearch} placeholder="بحث في المصروفات..." className="max-w-md" />
                            {filteredExpenses.length === 0 ? <EmptyState icon={FileText} title="لا توجد مصروفات" /> : (
                                <DataTable 
                                    columns={expenseColumns} 
                                    data={filteredExpenses} 
                                    searchQuery={search} 
                                    getRowColor={() => 'red'}
                                    onRowClick={(row) => {
                                        setExpenseForm({ ...row, amount: row.amount.toString() } as any);
                                        setExpenseModal(true);
                                    }}
                                />
                            )}
                        </div>
                    )}

                    {activeTab === 'suppliers' && (
                        <div className="space-y-4">
                            <SearchInput value={search} onChange={setSearch} placeholder="بحث عن مورد..." className="max-w-md" />
                            {filteredSuppliers.length === 0 ? <EmptyState icon={Users} title="لا يوجد موردين" /> : (
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
                                                {filteredSuppliers.map((s) => (
                                                    <tr
                                                        key={s.id}
                                                        className="border-b border-border/30 hover:bg-surface-hover/50 transition-colors group"
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
                                                                <button onClick={() => handleGenerateEmail(s)} className="px-2.5 py-1.5 hover:bg-purple-500/10 text-purple-400 hover:text-purple-500 rounded-xl text-[10px] font-bold border border-purple-500/20 transition-colors flex items-center gap-1"><Sparkles size={10} className="inline mr-1" /> ايميل طلبية</button>
                                                                <div className="w-px h-5 bg-border/60 mx-0.5"></div>
                                                                <button onClick={() => handleDeleteSupplier(s.id)} className="p-1.5 hover:bg-red-500/10 rounded-xl text-text-muted hover:text-red-500 border border-border/40 transition-colors" title="حذف المورد"><Trash2 size={13} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
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
                                <button title="تصنيف تلقائي بالذكاء الاصطناعي" onClick={handleAutoCategorize} disabled={isCategorizing} className="bg-purple-500/10 text-purple-400 p-2 rounded-xl border border-purple-500/20 hover:bg-purple-500 hover:text-white transition-all"><Sparkles size={18} className={isCategorizing ? 'animate-spin' : ''} /></button>
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
                        {generatingEmail ? <div className="absolute inset-0 flex items-center justify-center text-purple-500 gap-2"><Sparkles className="animate-spin" /> جاري الكتابة...</div> : (
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
