
import React, { useState, useMemo, useEffect } from 'react';
import { Landmark, TrendingDown, TrendingUp, Users, Plus, Search, Trash2, Sparkles, Building2, Wallet, PieChart, Minus, FileText, ShoppingCart, LayoutDashboard } from 'lucide-react';
import { formatCurrency } from '../core/utils';
import { Badge, Modal, PageHeader, SpotlightCard, EmptyState } from '../components/ui';
import { ConfirmModal } from '../components/ConfirmModal';
import { DonutChart, SalesAreaChart } from '../components/charts';
import { categorizeExpense, writeRestockEmail } from '../core/ai';
import { api, Expense, Supplier, Sale, PurchaseOrder } from '../core/api';
import { PurchaseOrdersTab } from '../components/finance/PurchaseOrdersTab';
import { PageShell, StatsGrid, StatCard, LoadingState, TabNav, SearchInput } from '../components/blocks';
import { usePreferences } from '../components/PreferencesContext';

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

    // --- Actions ---

    const handleSaveExpense = async () => {
        if (!expenseForm.title || !expenseForm.amount) { notify('يرجى إدخال العنوان والمبلغ', 'error'); return; }
        try {
            const e = {
                id: expenseForm.id || '', // Empty ID = new
                title: expenseForm.title,
                amount: Number(expenseForm.amount),
                category: expenseForm.category || 'other',
                date: expenseForm.date || new Date().toISOString().split('T')[0],
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

    if (loading) return <LoadingState icon={Landmark} title="جاري تحميل البيانات المالية..." subtitle="يرجى الانتظار" />;

    return (
        <PageShell>
            <PageHeader title="الإدارة المالية" icon={Landmark} description="متابعة المصروفات، الأرباح، وديون الموردين." actions={
                <div className="flex gap-2">
                    <button onClick={() => { setExpenseForm({}); setExpenseModal(true); }} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all text-sm touch-target active:scale-95"><Minus size={18} /> تسجيل مصروف</button>
                    <button onClick={() => { setSupplierForm({}); setSupplierModal(true); }} className="bg-primary/10 text-primary hover:bg-primary hover:text-black border border-primary/20 px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all text-sm touch-target active:scale-95"><Users size={18} /> إدارة الموردين</button>
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${showStats
                            ? 'bg-surface border border-border text-text-muted hover:text-text-main'
                            : 'bg-gradient-to-br from-primary to-emerald-500 text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105'
                            }`}
                        title={showStats ? 'إخفاء الإحصائيات' : 'عرض التحليل المالي'}
                    >
                        <LayoutDashboard size={showStats ? 20 : 22} />
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
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Revenue Growth Chart */}
                            <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6 h-[380px] relative overflow-hidden group hover:border-primary/20 transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                            <TrendingUp size={18} className="text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-text-main font-bold text-sm">نمو الإيرادات</h3>
                                            <p className="text-[10px] text-text-muted">آخر 6 أشهر</p>
                                        </div>
                                    </div>
                                </div>
                                <SalesAreaChart data={charts.trendData} />
                            </div>
                            {/* Expense Breakdown Donut */}
                            <div className="bg-surface border border-border rounded-2xl p-6 h-[380px] flex flex-col group hover:border-red-500/20 transition-all">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                        <PieChart size={18} className="text-red-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-text-main font-bold text-sm">توزيع المصروفات</h3>
                                        <p className="text-[10px] text-text-muted">حسب الفئة</p>
                                    </div>
                                </div>
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="w-44 h-44">
                                        <DonutChart data={charts.expenseBreakdown} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'expenses' && (
                        <div className="space-y-4">
                            <SearchInput value={search} onChange={setSearch} placeholder="بحث في المصروفات..." className="max-w-md" />
                            {filteredExpenses.length === 0 ? <EmptyState icon={FileText} title="لا توجد مصروفات" /> : (
                                <table className="w-full text-right text-sm">
                                    <thead className="text-primary font-bold text-xs bg-gradient-to-r from-primary/10 via-surface/50 to-transparent border-y border-primary/20 backdrop-blur-md"><tr><th className="p-4">العنوان</th><th className="p-4">التاريخ</th><th className="p-4">الفئة</th><th className="p-4">المبلغ</th><th className="p-4">إجراء</th></tr></thead>
                                    <tbody>
                                        {filteredExpenses.map(e => (
                                            <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="p-4 font-bold">{e.title}</td>
                                                <td className="p-4 text-text-muted font-mono">{e.date}</td>
                                                <td className="p-4"><Badge type="info" text={e.category === 'rent' ? 'إيجار' : e.category === 'salary' ? 'رواتب' : e.category === 'bills' ? 'فواتير' : 'أخرى'} /></td>
                                                <td className="p-4 font-black text-red-400 font-mono">{formatCurrency(e.amount, prefs?.currency).replace(prefs?.currency || 'IQD', '')}</td>
                                                <td className="p-4"><button title="حذف المصروف" onClick={() => handleDeleteExpense(e.id)} className="text-text-muted hover:text-red-500"><Trash2 size={16} /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {activeTab === 'suppliers' && (
                        <div className="space-y-4">
                            <SearchInput value={search} onChange={setSearch} placeholder="بحث عن مورد..." className="max-w-md" />
                            {filteredSuppliers.length === 0 ? <EmptyState icon={Users} title="لا يوجد موردين" /> : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {filteredSuppliers.map(s => (
                                        <SpotlightCard key={s.id} className="bg-surface/50 border border-white/10 p-4 rounded-2xl relative group backdrop-blur-sm hover:border-primary/30 transition-all">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h4 className="font-bold text-text-main">{s.name}</h4>
                                                    <p className="text-xs text-text-muted">{s.companyName}</p>
                                                </div>
                                                <div className="p-2 bg-surface rounded-lg text-text-muted"><Building2 size={18} /></div>
                                            </div>
                                            <div className="mb-3">
                                                <p className="text-[10px] text-text-muted uppercase font-bold">الرصيد (له)</p>
                                                <p className="text-xl font-black text-text-main font-mono">{formatCurrency(s.balance, prefs?.currency).replace(prefs?.currency || 'IQD', '')}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => { setSupplierForm(s); setSupplierModal(true); }} className="flex-1 py-2 bg-surface border border-border rounded-lg text-xs font-bold hover:bg-surface-hover">تعديل</button>
                                                <button onClick={() => handleGenerateEmail(s)} className="flex-1 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-bold hover:bg-purple-500 hover:text-white flex items-center justify-center gap-1"><Sparkles size={12} /> ايميل طلبية</button>
                                                <button onClick={() => handleDeleteSupplier(s.id)} className="p-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500 hover:text-white transition-colors" title="حذف المورد"><Trash2 size={16} /></button>
                                            </div>
                                        </SpotlightCard>
                                    ))}
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
                                <input type="date" className="w-full bg-input-bg border border-border rounded-xl px-4 py-2.5 text-sm" value={expenseForm.date || new Date().toISOString().split('T')[0]} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} aria-label="تاريخ المصروف" />
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
