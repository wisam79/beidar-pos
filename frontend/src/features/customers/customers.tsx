
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Phone, DollarSign, Clock, Plus, Search, Edit, Trash2, FileText, CreditCard, Sparkles, BrainCircuit, History, Wallet, MessageSquare, Users, TrendingUp, Calculator, Check, AlertTriangle, Filter, Calendar } from 'lucide-react';
import { Customer, Sale } from '../../core/types';
import { formatCurrency } from '../../core/utils';
import { Modal, Badge, PageHeader, EmptyState, SpotlightCard } from '../../components/ui';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PageShell, StatsGrid, StatCard, LoadingState, SearchInput } from '../../components/blocks';
import { analyzeCustomerProfile } from '../../core/ai';
import { api } from '../../core/api';
import { useInvalidateCustomers } from '../../hooks';
import { ReceiptTemplate } from '../../components/ReceiptTemplate';
import { Printer, Eye } from 'lucide-react';
import { usePreferences } from '../../components/PreferencesContext';

export const CustomersPage: React.FC = () => {
    const { notify, prefs } = usePreferences();
    // i18n
    const { t } = useTranslation();

    // React Query cache invalidation for cross-page sync
    const invalidateCustomers = useInvalidateCustomers();

    // Local State
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);

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
    // Modified to use generic confirm modal state for flexible error handling
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        title: string;
        message: string;
        type?: 'confirm' | 'warning' | 'error' | 'info';
        confirmText?: string;
        onConfirm: () => void;
    }>({
        open: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    // Load Data using API
    const loadData = async () => {
        try {
            setLoading(true);
            const [custs, slsData] = await Promise.all([
                api.customers.list(),
                api.sales.list(0, 5000, '', '', '')
            ]);
            setCustomers(custs);
            setSales(slsData.data);
        } catch (e) {
            console.error(e);
            notify('فشل تحميل بيانات العملاء', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

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
                <div className="flex gap-3 items-center">
                    <SearchInput value={search} onChange={setSearch} placeholder="ابحث باسم العميل أو رقم الهاتف..." />
                    <button
                        onClick={() => setShowOnlyDebt(!showOnlyDebt)}
                        className={`h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all border touch-target ${showOnlyDebt ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-surface text-text-muted border-border hover:text-text-main hover:border-text-muted'}`}
                    >
                        <Filter size={14} /> {showOnlyDebt ? 'المديونين فقط' : 'الكل'}
                    </button>
                </div>
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
                {filtered.length === 0 ? (<EmptyState icon={User} title="لا يوجد عملاء" description={search ? "لا توجد نتائج مطابقة لبحثك." : "ابدأ بإضافة عملائك لتتبع مشترياتهم وديونهم."} action={!search && <button onClick={handleInitAdd} className="bg-surface text-text-main px-5 py-2 rounded-xl border border-border text-sm font-bold hover:bg-surface-hover">إضافة عميل</button>} />) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {filtered.map(c => {
                            const isVip = (c.totalPurchases || 0) > 1000000;
                            const hasDebt = (c.debt || 0) + (c.installmentDebt || 0) > 0;
                            return (
                                <SpotlightCard key={c.id} className="bg-surface border border-border rounded-2xl p-5 relative overflow-hidden group flex flex-col h-full hover:border-primary/30 transition-all duration-200" spotlightColor="rgba(255,255,255,0.02)">
                                    {/* VIP Badge */}
                                    {isVip && (
                                        <div className="absolute top-3 left-3 bg-primary/20 text-primary text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 border border-primary/30">
                                            <Sparkles size={10} /> VIP
                                        </div>
                                    )}

                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-5 relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black ${isVip ? 'bg-primary text-white' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                                                {c.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-black text-text-main text-lg leading-tight mb-1.5">{c.name}</h3>
                                                <p className="text-xs text-text-muted font-mono flex items-center gap-1.5"><Phone size={12} className="text-text-muted" /> {c.phone}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleInitEdit(c)} className="p-2.5 hover:bg-primary/10 rounded-xl text-text-muted hover:text-primary transition-colors touch-target" title="تعديل"><Edit size={16} /></button>
                                            <button onClick={() => handleDelete(c.id)} className="p-2.5 hover:bg-red-500/10 rounded-xl text-text-muted hover:text-red-500 transition-colors touch-target" title="حذف"><Trash2 size={16} /></button>
                                        </div>
                                    </div>

                                    {/* Stats - Redesigned */}
                                    {(() => {
                                        const debt = c.debt || 0;
                                        const instDebt = c.installmentDebt || 0;
                                        const totalDebt = debt + instDebt;
                                        const hasAnyDebt = totalDebt > 0;

                                        return (
                                            <div className="space-y-3 mb-5 flex-1">
                                                {/* Total Purchases */}
                                                <div className="bg-bg p-3 rounded-xl border border-border flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <TrendingUp size={14} className="text-primary" />
                                                        <span className="text-xs text-text-muted font-bold">المشتريات</span>
                                                    </div>
                                                    <span className="text-primary font-black text-base font-mono">{formatCurrency(c.totalPurchases || 0, prefs?.currency).replace(prefs?.currency || 'IQD', '')}</span>
                                                </div>

                                                {/* Debts Section */}
                                                <div className={`p-3 rounded-xl border ${hasAnyDebt ? 'bg-red-500/5 border-red-500/20' : 'bg-bg border-border'}`}>
                                                    {/* Total Debt Header */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Wallet size={14} className={hasAnyDebt ? 'text-red-500' : 'text-text-muted'} />
                                                            <span className="text-xs text-text-muted font-bold">الديون</span>
                                                        </div>
                                                        <span className={`font-black text-base font-mono ${hasAnyDebt ? 'text-red-500' : 'text-text-muted'}`}>
                                                            {formatCurrency(totalDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                                                        </span>
                                                    </div>

                                                    {/* Debt Breakdown */}
                                                    {hasAnyDebt && (
                                                        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-text-muted">آجل</span>
                                                                <span className="text-red-500/80 font-bold font-mono">{formatCurrency(debt, prefs?.currency).replace(prefs?.currency || 'IQD', '')}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-text-muted">أقساط</span>
                                                                <span className="text-red-500/80 font-bold font-mono">{formatCurrency(instDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* AI Analysis Result */}
                                    {analysisResult && analysisResult.id === c.id && (
                                        <div className="mb-3 bg-primary/5 border border-primary/20 p-3 rounded-xl text-xs text-text-main animate-in fade-in flex gap-2 items-start">
                                            <Sparkles size={12} className="shrink-0 mt-0.5 text-primary" />
                                            <span className="leading-relaxed">{analysisResult.text}</span>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="space-y-2.5 mt-auto">
                                        {/* Row 1: History + AI Analysis (always visible) */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => setHistoryModal(c.id)} className="py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-border bg-bg text-text-muted hover:text-text-main hover:border-primary/30 active:scale-95"><History size={14} /> السجل</button>
                                            <button onClick={() => handleAnalyze(c)} className="py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 active:scale-95">
                                                <BrainCircuit size={14} />
                                                <span>تحليل AI</span>
                                            </button>
                                        </div>

                                        {/* Row 2: Installments + Pay Debt (only if has debt) */}
                                        {hasDebt && (
                                            <div className="grid grid-cols-3 gap-2">
                                                <button onClick={() => setInstallmentModal(c.id)} className="py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-border bg-bg text-text-muted hover:border-primary/30 active:scale-95"><Calculator size={14} /> أقساط</button>
                                                <button onClick={() => setPayDebtModal(c)} className="py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-primary text-white hover:bg-primary/90 active:scale-95"><Wallet size={14} /> تسديد</button>
                                                {/* WhatsApp Reminder Button */}
                                                <button
                                                    onClick={() => {
                                                        const phone = c.phone?.replace(/[^0-9]/g, '') || '';
                                                        const message = encodeURIComponent(
                                                            `*تذكير بالدين المستحق* 📋\n\n` +
                                                            `عزيزي العميل ${c.name}،\n\n` +
                                                            `نود تذكيرك بأن لديك دين مستحق بقيمة *${formatCurrency(c.debt || 0, prefs?.currency)}*.\n\n` +
                                                            `نرجو التواصل معنا في أقرب وقت.\n` +
                                                            `شكراً لتعاملكم معنا 🙏`
                                                        );
                                                        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                                                        notify('تم فتح WhatsApp', 'success');
                                                    }}
                                                    className="py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-border bg-bg text-text-muted hover:border-green-500/30 hover:text-green-500 active:scale-95"
                                                    title="إرسال تذكير WhatsApp"
                                                >
                                                    <MessageSquare size={14} /> تذكير
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </SpotlightCard>
                            )
                        })}
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
                                                onClick={() => handlePayInstallment(s.id, idx, inst.amount / 100)}
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
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead className="bg-surface-hover border-b border-border sticky top-0 z-10">
                                    <tr>
                                        <th className="text-right">التاريخ</th>
                                        <th className="text-right">رقم الفاتورة</th>
                                        <th className="text-left">المبلغ</th>
                                        <th className="text-center">طريقة الدفع</th>
                                        <th className="text-center">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedCustomerHistory.map(s => (
                                        <tr key={s.id} className="border-b border-border/30 hover:bg-surface-hover/50 transition-colors">
                                            <td className="text-text-muted font-mono text-right">{new Date(s.timestamp).toLocaleDateString('en-GB')}</td>
                                            <td className="text-text-main font-mono text-right">{s.id}</td>
                                            <td className="font-mono font-bold text-primary text-left">{formatCurrency(s.total, prefs?.currency)}</td>
                                            <td className="text-center font-bold text-text-main">{t(`sales.${s.paymentMethod}`)}</td>
                                            <td className="text-center"><Badge type={s.status === 'completed' ? 'success' : 'warning'} text={s.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {selectedCustomerHistory.length === 0 && <div className="p-12 text-center text-text-muted text-xs font-bold">لا توجد سجلات شراء سابقة لهذا العميل.</div>}
                        </div>
                    </div>
                </Modal>
            }

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
