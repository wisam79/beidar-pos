
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Phone, Plus, Edit, Trash2, FileText, CreditCard, Sparkles, BrainCircuit, History, Wallet, MessageSquare, Users, Calculator, Check, Filter } from 'lucide-react';
import { Customer, Sale } from '../../core/types';
import { formatCurrency } from '../../core/utils';
import { Modal, Badge, PageHeader, EmptyState } from '../../components/ui';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PageShell, StatsGrid, StatCard, LoadingState, SearchInput } from '../../components/blocks';
import { analyzeCustomerProfile } from '../../core/ai';
import { useQuery } from '@tanstack/react-query';
import { useCustomers, useInvalidateCustomers, useConfirmModal } from '../../hooks';
import { api } from '../../core/api';
import { ReceiptTemplate } from '../../components/ReceiptTemplate';
import { Printer, Eye } from 'lucide-react';
import { DataTable } from '../../components/shared/DataTable';
import { usePreferences } from '../../components/PreferencesContext';

export const CustomersPage: React.FC = () => {
    const { notify, prefs } = usePreferences();
    // i18n
    const { t } = useTranslation();

    // React Query cache invalidation for cross-page sync
    const invalidateCustomers = useInvalidateCustomers();

    // React Query Hooks
    const { customers, isLoading: customersLoading, refetch: refetchCustomers } = useCustomers();
    const { data: sales = [], isLoading: salesLoading } = useQuery({
        queryKey: ['sales', 0, 5000, '', '', ''],
        queryFn: async () => {
            const res = await api.sales.list(0, 5000, '', '', '');
            return res?.data || [];
        }
    });

    const loading = customersLoading || salesLoading;
    const loadData = () => {
        refetchCustomers();
    };

    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [historyModal, setHistoryModal] = useState<string | null>(null);
    const [payDebtModal, setPayDebtModal] = useState<Customer | null>(null);
    const [installmentModal, setInstallmentModal] = useState<string | null>(null);
    const [previewSale, setPreviewSale] = useState<Sale | null>(null); // Invoice preview state
    const [previewMode, setPreviewMode] = useState<'thermal' | 'a4'>('a4');
    const [form, setForm] = useState<Partial<Customer>>({});
    const [analysisResult, setAnalysisResult] = useState<{ id: string, text: string } | null>(null);
    const [showOnlyDebt, setShowOnlyDebt] = useState(false);
    const [showStats, setShowStats] = useState(false); // Collapsible stats state
    const { confirmState, openConfirm, closeConfirm } = useConfirmModal();

    // ═══════════════════════════════════════════════════════════════════════════════
    // 🔗 Pending Action Handler (from QuickActionsBar)
    // يتحقق من وجود إجراء معلق من لوحة التحكم ويفتح المودال المناسب
    // ═══════════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        const pendingAction = sessionStorage.getItem('pendingAction');
        if (pendingAction === 'openAddModal') {
            // مسح الإجراء المعلق حتى لا يتكرر
            sessionStorage.removeItem('pendingAction');
            // تأخير بسيط للتأكد من تحميل البيانات
            setTimeout(() => {
                handleInitAdd();
            }, 100);
        }
    }, []);

    const stats = useMemo(() => {
        const totalCustomers = customers.length;
        const totalDebt = customers.reduce((sum, c) => sum + (c.debt || 0), 0);
        const totalInstallmentDebt = customers.reduce((sum, c) => sum + (c.installmentDebt || 0), 0);
        const totalAllDebt = totalDebt + totalInstallmentDebt;
        const vipCustomers = customers.filter(c => (c.totalPurchases || 0) > 1000000).length;
        return { totalCustomers, totalDebt, totalInstallmentDebt, totalAllDebt, vipCustomers };
    }, [customers]);

    const handleInitAdd = () => { setForm({ name: '', phone: '', notes: '', debt: 0, totalPurchases: 0 }); setModalOpen(true); };
    const handleInitEdit = (c: Customer) => { setForm(c); setModalOpen(true); };

    const handleAnalyze = async (c: Customer) => {
        // AI Analysis assumes frontend logic or separate service
        setAnalysisResult({ id: c.id, text: 'جاري التحليل...' });
        const res = await analyzeCustomerProfile(c.name, c.totalPurchases, c.debt);
        setAnalysisResult({ id: c.id, text: res });
    };

    const handleSave = async () => {
        if (!form.name || !form.phone) { notify('الاسم ورقم الهاتف مطلوبان', 'error'); return; }
        try {
            const customerToSave = {
                ...form,
                id: form.id || undefined, // undefined relies on backend to generate ID if new, or check logic
                debt: Number(form.debt) || 0,
                totalPurchases: Number(form.totalPurchases) || 0,
                // Ensure required fields
                name: form.name,
                phone: form.phone
            } as Customer;

            await api.customers.save(customerToSave);
            notify(form.id ? 'تم تحديث البيانات' : 'تم إضافة العميل', 'success');
            setModalOpen(false);
            invalidateCustomers(); // Sync cache with Sales page
            loadData();
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : 'خطأ في الحفظ';
            notify(errorMsg, 'error');
        }
    };

    const handleDelete = (id: string) => {
        const performDelete = async (force: boolean) => {
            try {
                await api.customers.delete(id, force);
                notify('تم الحذف', 'success');
                invalidateCustomers();
                loadData();
                closeConfirm();
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
                    openConfirm({
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
                closeConfirm();
            }
        };

        openConfirm({
            title: 'حذف العميل',
            message: 'هل أنت متأكد من حذف هذا العميل؟ سيتم حذف جميع البيانات المرتبطة به.',
            type: 'error',
            confirmText: 'حذف',
            onConfirm: () => performDelete(false)
        });
    };

    const handlePayDebt = async (amount: number) => {
        if (!payDebtModal || amount <= 0) return;
        try {
            // Use CreatePayment API to properly record the payment
            // This will automatically update customer debt in the backend
            await api.payments.create({
                saleId: '',  // No specific sale - general debt payment
                customerId: payDebtModal.id,
                amount: amount,
                method: 'cash',
                note: 'تسديد دين',
                timestamp: Date.now()
            });
            notify(`تم التسديد ${formatCurrency(amount, prefs?.currency)}`, 'success');
            setPayDebtModal(null);
            invalidateCustomers(); // Sync cache with Sales page
            loadData();
        } catch (e: unknown) {
            // Show error message from backend if available
            const errorMsg = e instanceof Error ? e.message : 'فشل العملية';
            notify(errorMsg, 'error');
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // 💳 Installment Payment Handler - تسديد قسط معين من خطة الأقساط
    // ═══════════════════════════════════════════════════════════════════════════════
    const handlePayInstallment = async (saleId: string, index: number, amount: number) => {
        try {
            // استدعاء API تسديد القسط
            await api.payments.payInstallment(saleId, index, amount, 'cash');
            notify('تم تسديد القسط بنجاح ✓', 'success');
            // إعادة تحميل البيانات لتحديث الديون والأقساط
            loadData();
        } catch (e) {
            console.error('Error paying installment:', e);
            notify('حدث خطأ أثناء تسديد القسط', 'error');
        }
    };

    const filtered = customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
        const totalDebt = (c.debt || 0) + (c.installmentDebt || 0);
        const matchesDebt = showOnlyDebt ? totalDebt > 0 : true;
        return matchesSearch && matchesDebt;
    });

    const selectedCustomerHistory = historyModal ? sales.filter(s => s.customer === customers.find(c => c.id === historyModal)?.name) : [];

    // Installment logic
    const selectedCustomerInstallments = useMemo(() => {
        if (!installmentModal) return [];
        const customerName = customers.find(c => c.id === installmentModal)?.name;
        if (!customerName) return [];
        return sales.filter(s => s.customer === customerName && s.paymentMethod === 'installment' && s.installmentPlan);
    }, [installmentModal, sales, customers]);

    if (loading) return <LoadingState icon={Users} title="جاري تحميل بيانات العملاء..." subtitle="تحليل السجلات" />;

    return (
        <PageShell>
            <PageHeader title="العملاء" icon={User} description="إدارة علاقات العملاء، سجل المشتريات، والديون المستحقة." actions={
                <div className="flex items-center gap-2">
                    <SearchInput value={search} onChange={setSearch} placeholder="ابحث باسم العميل أو رقم الهاتف..." />
                    <button
                        onClick={() => setShowOnlyDebt(!showOnlyDebt)}
                        className={`h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all border touch-target ${showOnlyDebt ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-surface text-text-muted border-border hover:text-text-main hover:border-text-muted'}`}
                    >
                        <Filter size={14} /> {showOnlyDebt ? 'المديونين فقط' : 'الكل'}
                    </button>
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${showStats
                            ? 'bg-surface border border-border text-text-muted hover:text-text-main'
                            : 'bg-gradient-to-br from-primary to-emerald-500 text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105'
                            }`}
                        title={showStats ? 'إخفاء الإحصائيات' : 'عرض تحليل العملاء'}
                    >
                        <Users size={showStats ? 18 : 20} />
                    </button>
                    <button onClick={handleInitAdd} className="bg-primary text-primary-fg hover:brightness-110 h-10 px-4 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95 text-xs border border-primary/20 touch-target"><Plus size={16} /> إضافة عميل جديد</button>
                </div>
            }>
            </PageHeader>

            {/* Premium Quick Stats CRM */}
            <StatsGrid columns={3} visible={showStats}>
                <StatCard icon={Users} label="إجمالي العملاء" value={stats.totalCustomers} color="blue" subtitle="نشط" />
                <StatCard icon={CreditCard} label="إجمالي الديون" value={formatCurrency(stats.totalAllDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')} color="red">
                    <div className="flex gap-3 text-[9px] font-bold mt-1">
                        <span className="text-orange-400">آجل: {formatCurrency(stats.totalDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')}</span>
                        <span className="text-pink-400">أقساط: {formatCurrency(stats.totalInstallmentDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')}</span>
                    </div>
                </StatCard>
                <StatCard icon={Sparkles} label="عملاء VIP" value={stats.vipCustomers} color="amber" subtitle="مشتريات عالية" />
            </StatsGrid>

            <div className="flex-1 overflow-y-auto min-h-0 pr-1 custom-scrollbar pb-10">
                {filtered.length === 0 ? (
                    <EmptyState
                        icon={User}
                        title="لا يوجد عملاء"
                        description={search ? "لا توجد نتائج مطابقة لبحثك." : "ابدأ بإضافة عملائك لتتبع مشترياتهم وديونهم."}
                        action={!search && <button onClick={handleInitAdd} className="bg-surface text-text-main px-5 py-2 rounded-xl border border-border text-sm font-bold hover:bg-surface-hover">إضافة عميل</button>}
                    />
                ) : (
                    <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-[var(--shadow-card)] flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-right text-sm border-collapse">
                                <thead className="sticky top-0 z-10 bg-surface-hover border-b border-border text-text-muted text-xs">
                                    <tr>
                                        <th className="px-4 py-3 text-right">العميل</th>
                                        <th className="px-4 py-3 text-right w-[150px]">المشتريات</th>
                                        <th className="px-4 py-3 text-right w-[200px]">الديون المستحقة</th>
                                        <th className="px-4 py-3 text-left w-[420px] pl-8">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((c) => {
                                        const isVip = (c.totalPurchases || 0) > 1000000;
                                        const debt = c.debt || 0;
                                        const instDebt = c.installmentDebt || 0;
                                        const totalDebt = debt + instDebt;
                                        const hasAnyDebt = totalDebt > 0;
                                        const healthColor = isVip ? 'bg-primary' : hasAnyDebt ? 'bg-red-500' : 'bg-emerald-500';

                                        return (
                                            <tr
                                                key={c.id}
                                                className={`border-b border-border/30 hover:bg-surface-hover transition-colors group`}
                                            >
                                                <td className="px-4 py-3 relative">
                                                    {/* Health indicator bar on the right in RTL */}
                                                    <div className={`absolute right-0 top-2 bottom-2 w-1 rounded-l-full ${healthColor} shadow-[0_0_8px_currentColor] text-${isVip ? 'primary' : hasAnyDebt ? 'red' : 'emerald'}-500`} />
                                                    
                                                    <div className="flex items-center gap-3 pr-2">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black ${isVip ? 'bg-primary text-white border border-primary/20 shadow-sm' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                                                            {c.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="font-bold text-text-main text-xs group-hover:text-primary transition-colors">{c.name}</p>
                                                                {isVip && (
                                                                    <span className="bg-primary/20 text-primary text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-primary/30">
                                                                        <Sparkles size={8} className="inline mr-1" /> VIP
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-text-muted font-mono mt-0.5">{c.phone}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-primary text-base">
                                                    {formatCurrency(c.totalPurchases || 0, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`font-mono font-black text-sm ${hasAnyDebt ? 'text-red-500' : 'text-text-muted'}`}>
                                                            {formatCurrency(totalDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                                                        </span>
                                                        {hasAnyDebt && (
                                                            <span className="text-[9px] text-text-muted font-bold mt-0.5">
                                                                آجل: {formatCurrency(debt, prefs?.currency).replace(prefs?.currency || 'IQD', '')} | أقساط: {formatCurrency(instDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-left pl-8" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button onClick={() => setHistoryModal(c.id)} className="px-2.5 py-1.5 hover:bg-surface-hover hover:text-text-main text-text-muted rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 border border-border/40" title="عرض السجل"><History size={12} /> السجل</button>
                                                        <button onClick={() => handleAnalyze(c)} className="px-2.5 py-1.5 hover:bg-primary/10 text-[10px] font-bold text-primary transition-all flex items-center gap-1 border border-primary/20 rounded-xl" title="تحليل AI"><BrainCircuit size={12} /> تحليل</button>
                                                        {hasAnyDebt && (
                                                            <>
                                                                <button onClick={() => setInstallmentModal(c.id)} className="px-2.5 py-1.5 hover:bg-surface-hover hover:text-text-main text-text-muted rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 border border-border/40" title="الأقساط"><Calculator size={12} /> أقساط</button>
                                                                <button onClick={() => setPayDebtModal(c)} className="px-2.5 py-1.5 hover:bg-green-500/10 text-[10px] font-bold text-green-500 transition-all flex items-center gap-1 border border-green-500/20 rounded-xl" title="تسديد الدين"><Wallet size={12} /> تسديد</button>
                                                                <button
                                                                    onClick={() => {
                                                                        const phone = c.phone?.replace(/[^0-9]/g, '') || '';
                                                                        const message = encodeURIComponent(
                                                                            `*تذكير بالدين المستحق* 📋\n\nعزيزي العميل ${c.name}،\n\n` +
                                                                            `نود تذكيرك بأن لديك دين مستحق بقيمة *${formatCurrency(c.debt || 0, prefs?.currency)}*.\n\n` +
                                                                            `نرجو التواصل معنا في أقرب وقت.\n` +
                                                                            `شكراً لتعاملكم معنا 🙏`
                                                                        );
                                                                        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                                                                        notify('تم فتح WhatsApp', 'success');
                                                                    }}
                                                                    className="px-2.5 py-1.5 hover:bg-green-500/10 text-[10px] font-bold text-green-500 transition-all flex items-center gap-1 border border-green-500/20 rounded-xl"
                                                                    title="تذكير واتساب"
                                                                >
                                                                    <MessageSquare size={12} /> تذكير
                                                                </button>
                                                            </>
                                                        )}
                                                        <div className="w-px h-5 bg-border/60 mx-0.5"></div>
                                                        <button onClick={() => handleInitEdit(c)} className="p-1.5 hover:bg-primary/10 rounded-xl text-text-muted hover:text-primary transition-all border border-border/40" title="تعديل"><Edit size={13} /></button>
                                                        <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-500/10 rounded-xl text-text-muted hover:text-red-500 transition-all border border-border/40" title="حذف"><Trash2 size={13} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {modalOpen && <Modal title={form.id ? 'تعديل العميل' : 'إضافة عميل جديد'} onClose={() => setModalOpen(false)}>
                <div className="space-y-4 pt-2">
                    <div className="bg-bg p-4 rounded-2xl border border-border space-y-4">
                        <div className="relative group">
                            <User className="absolute right-4 top-3.5 text-text-muted group-focus-within:text-primary transition-colors" size={18} />
                            <input className="w-full bg-input-bg border border-border text-text-main rounded-xl py-3 pr-12 pl-4 outline-none focus:border-primary transition-all text-sm font-bold" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="الاسم الكامل" autoFocus />
                        </div>
                        <div className="relative group">
                            <Phone className="absolute right-4 top-3.5 text-text-muted group-focus-within:text-primary transition-colors" size={18} />
                            <input className="w-full bg-input-bg border border-border text-text-main rounded-xl py-3 pr-12 pl-4 outline-none focus:border-primary transition-all text-sm font-bold" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="رقم الهاتف" />
                        </div>
                    </div>
                    <div className="relative group">
                        <MessageSquare className="absolute right-4 top-3.5 text-text-muted group-focus-within:text-primary transition-colors" size={18} />
                        <textarea className="w-full bg-input-bg border border-border text-text-main rounded-xl py-3 pr-12 pl-4 outline-none focus:border-primary transition-all text-sm font-medium h-28 resize-none" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات إضافية..." />
                    </div>
                    <button onClick={handleSave} className="w-full bg-primary text-primary-fg font-black py-4 rounded-xl hover:brightness-110 shadow-[0_0_20px_var(--color-primary-dim)] active:scale-95 transition-all text-sm">حفظ البيانات</button>
                </div>
            </Modal>}

            {payDebtModal && <Modal title="تسديد دفعة" onClose={() => setPayDebtModal(null)} size="sm">
                <div className="space-y-6 text-center pt-2">
                    <div className="bg-bg p-6 rounded-3xl border border-border relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 blur-xl rounded-full pointer-events-none"></div>
                        <p className="text-xs text-text-muted font-bold uppercase tracking-wider mb-2">إجمالي الدين المستحق</p>
                        <p className="text-4xl font-black text-text-main tracking-tight font-mono">{formatCurrency(payDebtModal.debt || 0, prefs?.currency).replace(prefs?.currency || 'IQD', '')}<span className="text-sm text-red-500 ml-1">{prefs?.currency || 'IQD'}</span></p>
                    </div>
                    <div className="relative">
                        <input type="number" id="payAmount" className="w-full bg-input-bg border border-border text-primary rounded-2xl p-4 outline-none focus:border-primary font-black text-center text-3xl placeholder:text-text-muted" placeholder="0" autoFocus />
                        <p className="text-[10px] text-text-muted mt-2 font-bold">أدخل المبلغ المراد تسديده</p>
                    </div>
                    <button onClick={() => handlePayDebt(Number((document.getElementById('payAmount') as HTMLInputElement).value))} className="w-full bg-green-500 text-white font-black py-4 rounded-2xl hover:bg-green-600 shadow-lg shadow-green-500/20 active:scale-95 transition-all text-sm">تأكيد الدفع</button>
                </div>
            </Modal>}

            {installmentModal && <Modal title="الأقساط المستحقة" onClose={() => setInstallmentModal(null)} size="lg">
                <div className="space-y-4">
                    {selectedCustomerInstallments.length === 0 ? <p className="text-center text-text-muted py-6 text-xs font-bold">لا توجد أقساط نشطة.</p> : selectedCustomerInstallments.map(s => (
                        <div key={s.id} className="bg-bg border border-border rounded-2xl p-4">
                            <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
                                <div>
                                    <p className="text-xs text-text-muted font-bold">فاتورة #{s.id}</p>
                                    <p className="text-primary font-black text-sm font-mono">{formatCurrency(s.total, prefs?.currency)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setPreviewSale(s); setPreviewMode('a4'); }}
                                        className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-bold hover:bg-blue-500/20 transition-all flex items-center gap-1"
                                        title="معاينة الفاتورة"
                                    >
                                        <Eye size={14} /> معاينة
                                    </button>
                                </div>
                                <div>
                                    <p className="text-xs text-text-muted">المتبقي</p>
                                    <p className="text-pink-400 font-bold font-mono">
                                        {formatCurrency(s.installmentPlan?.schedule.filter(i => i.status !== 'paid').reduce((acc, i) => acc + i.amount, 0) || 0, prefs?.currency)}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {s.installmentPlan?.schedule.map((inst, idx) => (
                                    <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border ${inst.status === 'paid' ? 'bg-green-500/5 border-green-500/20' : new Date(inst.dueDate) < new Date() ? 'bg-red-500/5 border-red-500/20' : 'bg-surface border-border'}`}>
                                        <div>
                                            <p className={`text-xs font-bold font-mono ${inst.status === 'paid' ? 'text-green-500' : 'text-text-main'}`}>قسط #{inst.number} - {formatCurrency(inst.amount)}</p>
                                            <p className="text-[10px] text-text-muted">مستحق: {inst.dueDate}</p>
                                        </div>
                                        {inst.status === 'paid' ? (
                                            <span className="text-xs text-green-500 font-bold flex items-center gap-1"><Check size={14} /> تم الدفع</span>
                                        ) : (
                                            <button
                                                onClick={() => handlePayInstallment(s.id, idx, inst.amount)}
                                                className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold hover:bg-primary hover:text-black transition-all"
                                            >
                                                تسديد الآن
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>}

            {/* Invoice Preview Modal */}
            {
                previewSale && prefs && (
                    <Modal title="معاينة الفاتورة" onClose={() => setPreviewSale(null)} size="xl">
                        <div className="space-y-4">
                            {/* Format Toggle */}
                            <div className="flex justify-center gap-2 mb-4">
                                <button
                                    onClick={() => setPreviewMode('a4')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${previewMode === 'a4' ? 'bg-primary text-black' : 'bg-surface border border-border text-text-muted hover:text-text-main'}`}
                                >
                                    <FileText size={16} /> فاتورة رسمية A4
                                </button>
                                <button
                                    onClick={() => setPreviewMode('thermal')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${previewMode === 'thermal' ? 'bg-primary text-black' : 'bg-surface border border-border text-text-muted hover:text-text-main'}`}
                                >
                                    <Printer size={16} /> إيصال حراري 80mm
                                </button>
                            </div>

                            {/* Invoice Preview */}
                            <div className="max-h-[60vh] overflow-y-auto bg-gray-100 rounded-xl p-4 flex justify-center">
                                <ReceiptTemplate sale={previewSale} prefs={prefs} mode={previewMode} />
                            </div>

                            {/* Print Button */}
                            <button
                                onClick={async () => {
                                    try {
                                        await api.print.generatePDF(previewSale.id, previewMode);
                                        notify('تم إنشاء ملف PDF بنجاح', 'success');
                                    } catch (err) {
                                        notify('فشل في إنشاء ملف PDF', 'error');
                                    }
                                }}
                                className="w-full bg-primary text-black font-black py-4 rounded-xl hover:brightness-110 shadow-lg shadow-primary/20 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                            >
                                <Printer size={18} /> طباعة الفاتورة
                            </button>
                        </div>
                    </Modal>
                )
            }

            {
                historyModal && <Modal title="سجل المشتريات" onClose={() => setHistoryModal(null)} size="lg">
                    <div className="bg-bg border border-border rounded-2xl overflow-hidden shadow-2xl">
                        <div className="h-[400px]">
                            <DataTable
                                data={selectedCustomerHistory}
                                columns={[
                                    {
                                        header: 'التاريخ',
                                        accessorKey: 'timestamp',
                                        cell: (info) => <span className="text-text-muted font-mono">{new Date(info.getValue() as number).toLocaleDateString('en-GB')}</span>,
                                    },
                                    {
                                        header: 'رقم الفاتورة',
                                        accessorKey: 'id',
                                        cell: (info) => <span className="text-text-main font-mono font-bold">{info.getValue() as string}</span>,
                                    },
                                    {
                                        header: 'المبلغ',
                                        accessorKey: 'total',
                                        cell: (info) => <span className="font-mono font-bold text-primary">{formatCurrency(info.getValue() as number, prefs?.currency)}</span>,
                                    },
                                    {
                                        header: 'طريقة الدفع',
                                        accessorKey: 'paymentMethod',
                                        cell: (info) => <span className="font-bold text-text-main">{t(`sales.${info.getValue() as string}`)}</span>,
                                    },
                                    {
                                        header: 'الحالة',
                                        accessorKey: 'status',
                                        cell: (info) => <Badge type={info.getValue() === 'completed' ? 'success' : 'warning'} text={info.getValue() as string} />,
                                    },
                                ]}
                                emptyStateTitle="لا توجد سجلات"
                                emptyStateDescription="لا توجد سجلات شراء سابقة لهذا العميل."
                            />
                        </div>
                    </div>
                </Modal>
            }

            <ConfirmModal
                isOpen={confirmState.open}
                title={confirmState.title}
                message={confirmState.message}
                type={confirmState.type}
                confirmText={confirmState.confirmText}
                cancelText="إلغاء"
                onConfirm={confirmState.onConfirm}
                onCancel={closeConfirm}
            />
        </PageShell>
    );
};
