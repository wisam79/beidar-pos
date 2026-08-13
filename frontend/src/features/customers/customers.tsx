
import React, { useState, useMemo, useEffect, useDeferredValue, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Phone, Plus, Edit, Trash2, FileText, CreditCard, Sparkles, BrainCircuit, History, Wallet, MessageSquare, Users, Calculator, Check, Filter, ArrowRight } from 'lucide-react';
import { Customer, Sale } from '../../core/types';
import { formatCurrency } from '../../core/utils';
import { Modal, Badge, PageHeader, EmptyState } from '../../components/ui';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PageShell, StatsGrid, StatCard, LoadingState, SearchInput } from '../../components/blocks';
import { analyzeCustomerProfile } from '../../core/ai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCustomersPaged, useConfirmModal } from '../../hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import { api } from '../../core/api';
import { invalidateAllData, queryKeys } from '../../core/queryClient';
import { ReceiptTemplate } from '../../components/ReceiptTemplate';
import { Printer, Eye } from 'lucide-react';
import { DataTable } from '../../components/shared/DataTable';
import { usePreferences } from '../../components/PreferencesContext';

export const CustomersPage: React.FC = () => {
    const { notify, prefs } = usePreferences();
    // i18n
    const { t } = useTranslation();

    // React Query cache invalidation for cross-page sync
    const queryClient = useQueryClient();

    // Pagination & Search States
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [search, setSearch] = useState('');
    const deferredSearch = useDeferredValue(search);

    // Reset page on search change
    useEffect(() => {
        setPage(1);
    }, [deferredSearch]);

    // React Query Hooks
    const { customers, total, totalPages, isLoading: customersLoading } = useCustomersPaged(page, pageSize, deferredSearch);
    const { data: sales = [], isLoading: salesLoading } = useQuery({
        queryKey: queryKeys.sales.list(0, 5000, '', '', ''),
        queryFn: async () => {
            const res = await api.sales.list(0, 5000, '', '', '');
            return res?.data || [];
        }
    });

    const loading = customersLoading || salesLoading;

    const [modalOpen, setModalOpen] = useState(false);
    const [historyModal, setHistoryModal] = useState<string | null>(null);
    const [payDebtModal, setPayDebtModal] = useState<Customer | null>(null);
    const [installmentModal, setInstallmentModal] = useState<string | null>(null);
    const [previewSale, setPreviewSale] = useState<Sale | null>(null); // Invoice preview state
    const [previewMode, setPreviewMode] = useState<'thermal' | 'a4'>('a4');
    const [form, setForm] = useState<Partial<Customer>>({});
    const [showOnlyDebt, setShowOnlyDebt] = useState(false);
    const [showStats, setShowStats] = useState(false); // Collapsible stats state
    const { confirmState, openConfirm, closeConfirm } = useConfirmModal();

    // Installment sales for the selected customer (dedicated query, no full-sales scan)
    const { data: customerInstallments = [] } = useQuery({
        queryKey: queryKeys.sales.installments(installmentModal ?? ''),
        queryFn: () => api.payments.getCustomerInstallments(installmentModal ?? ''),
        enabled: !!installmentModal,
    });

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
        const totalCustomers = total || customers.length;
        const totalDebt = Math.round(customers.reduce((sum: number, c: Customer) => sum + (c.debt || 0), 0));
        const totalInstallmentDebt = Math.round(customers.reduce((sum: number, c: Customer) => sum + (c.installmentDebt || 0), 0));
        const totalAllDebt = totalDebt + totalInstallmentDebt;
        const vipCustomers = customers.filter((c: Customer) => (c.totalPurchases || 0) > 1000000).length;
        return { totalCustomers, totalDebt, totalInstallmentDebt, totalAllDebt, vipCustomers };
    }, [customers, total]);

    const handleInitAdd = () => { setForm({ name: '', phone: '', notes: '', debt: 0, totalPurchases: 0 }); setModalOpen(true); };
    const handleInitEdit = (c: Customer) => { setForm(c); setModalOpen(true); };

    const handleAnalyze = async (c: Customer) => {
        await analyzeCustomerProfile(c.name, c.totalPurchases, c.debt);
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
                phone: form.phone.replace(/[^0-9]/g, '')
            } as Customer;

            await api.customers.save(customerToSave);
            notify(form.id ? 'تم تحديث البيانات' : 'تم إضافة العميل', 'success');
            setModalOpen(false);
            invalidateAllData();
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
                invalidateAllData();
                closeConfirm();
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
            invalidateAllData(); // Sync cache with Sales page and everywhere
        } catch (e: unknown) {
            // Show error message from backend if available
            const errorMsg = e instanceof Error ? e.message : 'فشل العملية';
            notify(errorMsg, 'error');
        }
    };

    const [payingKey, setPayingKey] = useState<string | null>(null);

    // ═══════════════════════════════════════════════════════════════════════════════
    // 💳 Installment Payment Handler - تسديد قسط معين من خطة الأقساط
    // ═══════════════════════════════════════════════════════════════════════════════
    const handlePayInstallment = async (saleId: string, index: number, amount: number) => {
        const key = `${saleId}-${index}`;
        if (payingKey === key) return;
        setPayingKey(key);
        try {
            // استدعاء API تسديد القسط
            await api.payments.payInstallment(saleId, index, amount, 'cash');
            notify('تم تسديد القسط بنجاح', 'success');
            // إبطال صريح لكاش المبيعات والعملاء لتحديث الصفحة والمودال فوراً
            queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
            if (installmentModal) {
                queryClient.invalidateQueries({ queryKey: queryKeys.sales.installments(installmentModal) });
            }
            invalidateAllData();
        } catch (e: unknown) {
            console.error('Error paying installment:', e);
            let appError: unknown = null;
            const errStr = String(e);
            try {
                const jsonPart = errStr.includes('{') ? errStr.substring(errStr.indexOf('{')) : errStr;
                appError = JSON.parse(jsonPart);
            } catch { /* Not JSON */ }

            const errMsg = (appError as { message?: string })?.message ||
                (e as { message?: string })?.message ||
                (typeof e === 'string' ? e : 'حدث خطأ أثناء تسديد القسط');
            notify(errMsg, 'error');
        } finally {
            setPayingKey(null);
        }
    };

    const filtered = useMemo(() => {
        if (!showOnlyDebt) return customers;
        return customers.filter((c: Customer) => ((c.debt || 0) + (c.installmentDebt || 0)) > 0);
    }, [customers, showOnlyDebt]);

    const selectedCustomerHistory = historyModal
        ? sales.filter(s => {
            const target = customers.find((c: Customer) => c.id === historyModal);
            if (!target) return false;
            return s.customerId === historyModal || (!s.customerId && s.customer === target.name);
        })
        : [];

    // Virtualization setup
    const parentRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(1200);

    useEffect(() => {
        if (!parentRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        resizeObserver.observe(parentRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const gridColumns = useMemo(() => {
        if (containerWidth >= 1536) return 4;
        if (containerWidth >= 1280) return 3;
        if (containerWidth >= 768) return 2;
        return 1;
    }, [containerWidth]);

    const rows = Math.ceil(filtered.length / gridColumns);
    const rowVirtualizer = useVirtualizer({
        count: rows,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 280,
        overscan: 3,
    });

    if (loading && customers.length === 0) return <LoadingState icon={Users} title="جاري تحميل بيانات العملاء..." subtitle="تحليل السجلات" />;

    return (
        <PageShell>
            <PageHeader title="العملاء" icon={User} description="إدارة علاقات العملاء، سجل المشتريات، والديون المستحقة." actions={
                <div className="flex items-center gap-2">
                    <SearchInput value={search} onChange={setSearch} placeholder="ابحث باسم العميل أو رقم الهاتف..." />
                    <button
                        onClick={() => setShowOnlyDebt(!showOnlyDebt)}
                        className={`h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all border touch-target ${showOnlyDebt ? 'bg-danger/10 text-danger border-danger/30' : 'bg-surface text-text-muted border-border hover:text-text-main hover:border-text-muted'}`}
                    >
                        <Filter size={14} /> {showOnlyDebt ? 'المديونين فقط' : 'الكل'}
                    </button>
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer border ${showStats
                            ? 'bg-success/10 border-success/30 text-success'
                            : 'bg-surface border-border/80 text-text-muted hover:text-text-main'
                            }`}
                        title={showStats ? 'إخفاء الإحصائيات' : 'عرض تحليل العملاء'}
                    >
                        <Users size={18} />
                    </button>
                    <button onClick={handleInitAdd} className="bg-primary text-primary-fg font-black hover:brightness-110 h-10 px-4 rounded-xl flex items-center gap-2 transition-transform active:scale-[0.98] text-xs shadow-sm shadow-primary/20 cursor-pointer"><Plus size={16} /> إضافة عميل جديد</button>
                </div>
            }>
            </PageHeader>

            {/* Premium Quick Stats CRM */}
            <StatsGrid columns={3} visible={showStats}>
                <StatCard icon={Users} label="إجمالي العملاء" value={stats.totalCustomers} color="blue" subtitle="نشط" />
                <StatCard icon={CreditCard} label="إجمالي الديون" value={formatCurrency(stats.totalAllDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')} color="red">
                    <div className="flex gap-3 text-[9px] font-bold mt-1">
                        <span className="text-warning">آجل: {formatCurrency(stats.totalDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')}</span>
                        <span className="text-danger">أقساط: {formatCurrency(stats.totalInstallmentDebt, prefs?.currency).replace(prefs?.currency || 'IQD', '')}</span>
                    </div>
                </StatCard>
                <StatCard icon={Sparkles} label="عملاء VIP" value={stats.vipCustomers} color="amber" subtitle="مشتريات عالية" />
            </StatsGrid>

            <div ref={parentRef} className="flex-1 overflow-y-auto min-h-0 pr-1 custom-scrollbar pb-4">
                {filtered.length === 0 ? (
                    <EmptyState
                        icon={User}
                        title="لا يوجد عملاء"
                        description={search ? "لا توجد نتائج مطابقة لبحثك." : "ابدأ بإضافة عملائك لتتبع مشترياتهم وديونهم."}
                        action={!search && <button onClick={handleInitAdd} className="bg-primary text-primary-fg px-5 py-2.5 rounded-xl font-bold hover:brightness-110 shadow-sm transition-all">إضافة عميل جديد</button>}
                    />
                ) : (
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const startIndex = virtualRow.index * gridColumns;
                            const rowCustomers = filtered.slice(startIndex, startIndex + gridColumns);
                            return (
                                <div
                                    key={virtualRow.index}
                                    ref={rowVirtualizer.measureElement}
                                    data-index={virtualRow.index}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                    className={`grid gap-4.5 p-1 ${
                                        gridColumns === 4 ? 'grid-cols-4' :
                                        gridColumns === 3 ? 'grid-cols-3' :
                                        gridColumns === 2 ? 'grid-cols-2' : 'grid-cols-1'
                                    }`}
                                >
                                    {rowCustomers.map((c: Customer) => {
                                        const isVip = (c.totalPurchases || 0) > 1000000;
                                        const debt = c.debt || 0;
                                        const instDebt = c.installmentDebt || 0;
                                        const totalDebt = debt + instDebt;
                                        const hasAnyDebt = totalDebt > 0;

                                        return (
                                            <div
                                                key={c.id}
                                                className="group relative flex flex-col justify-between bg-surface hover:bg-surface-hover border border-border/80 hover:border-success/40 rounded-3xl p-5 shadow-sm hover:shadow-success/20 transition-all duration-200 overflow-hidden"
                                            >
                                                {/* Top Health Accent Bar */}
                                                <div
                                                    className={`absolute top-0 right-0 left-0 h-1 ${
                                                        isVip ? 'bg-success' : hasAnyDebt ? 'bg-danger' : 'bg-success/40'
                                                    }`}
                                                />

                                                <div>
                                                    {/* Card Top: Avatar, Name, Phone & Status */}
                                                    <div className="flex items-start justify-between gap-3 pt-1 mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-extrabold shadow-inner transition-transform group-hover:scale-105 ${
                                                                    isVip
                                                                        ? 'bg-primary text-primary-fg ring-2 ring-primary/30'
                                                                        : hasAnyDebt
                                                                            ? 'bg-danger/10 text-danger border border-danger/20'
                                                                            : 'bg-success/10 text-success border border-success/20'
                                                                }`}
                                                            >
                                                                {c.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <h3 className="font-bold text-text-main text-base group-hover:text-primary transition-colors">
                                                                        {c.name}
                                                                    </h3>
                                                                    {isVip && (
                                                                        <span className="bg-primary/15 text-primary text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 border border-primary/25 shadow-2xs">
                                                                            <Sparkles size={10} /> VIP
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <a
                                                                    href={`tel:${c.phone}`}
                                                                    className="text-xs text-text-muted hover:text-success font-mono mt-0.5 inline-block transition-colors"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    {c.phone || 'بدون هاتف'}
                                                                </a>
                                                            </div>
                                                        </div>

                                                        {/* Status Badge */}
                                                        <span
                                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${
                                                                hasAnyDebt
                                                                    ? 'bg-danger/10 text-danger border-danger/30'
                                                                    : 'bg-success/10 text-success border-success/30'
                                                            }`}
                                                        >
                                                            {hasAnyDebt ? 'مطلوب ديون' : 'حساب مصفّى'}
                                                        </span>
                                                    </div>

                                                    {/* Financial Summary Bevel */}
                                                    <div className="bg-bg/80 border border-border/60 rounded-2xl p-3.5 space-y-2 mb-4">
                                                        {/* Total Purchases */}
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-text-muted font-bold">إجمالي المشتريات:</span>
                                                            <span className="font-mono font-extrabold text-text-main text-sm">
                                                                {formatCurrency(c.totalPurchases || 0, prefs?.currency)}
                                                            </span>
                                                        </div>

                                                        {/* Outstanding Debt */}
                                                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/40">
                                                            <span className="text-text-muted font-bold">الديون المستحقة:</span>
                                                            <span
                                                                className={`font-mono font-black text-sm ${
                                                                    hasAnyDebt ? 'text-danger' : 'text-success'
                                                                }`}
                                                            >
                                                                {hasAnyDebt
                                                                    ? formatCurrency(totalDebt, prefs?.currency)
                                                                    : '0.00 ' + (prefs?.currency || 'IQD')}
                                                            </span>
                                                        </div>

                                                        {/* Debt Breakdown (if split) */}
                                                        {hasAnyDebt && (instDebt > 0 || debt > 0) && (
                                                            <div className="text-[10px] text-text-muted font-bold flex justify-between pt-1 text-right">
                                                                <span>آجل: {formatCurrency(debt, prefs?.currency)}</span>
                                                                <span>أقساط: {formatCurrency(instDebt, prefs?.currency)}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Notes preview if available */}
                                                    {c.notes && (
                                                        <p className="text-[11px] text-text-muted bg-surface/50 border border-border/30 rounded-xl p-2 mb-4 line-clamp-2">
                                                            {c.notes}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Action Bar */}
                                                <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1.5">
                                                    <div className="flex items-center gap-1">
                                                        {/* AI Analysis */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAnalyze(c)}
                                                            className="p-2 rounded-xl bg-surface hover:bg-primary/15 text-text-muted hover:text-primary border border-border/50 transition-all active:scale-95"
                                                            title="تحليل الذكاء الاصطناعي"
                                                        >
                                                            <BrainCircuit size={14} />
                                                        </button>

                                                        {/* History */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setHistoryModal(c.id)}
                                                            className="p-2 rounded-xl bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main border border-border/50 transition-all active:scale-95"
                                                            title="سجل الحركات والفواتير"
                                                        >
                                                            <History size={14} />
                                                        </button>

                                                        {/* Edit */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleInitEdit(c)}
                                                            className="p-2 rounded-xl bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main border border-border/50 transition-all active:scale-95"
                                                            title="تعديل بيانات العميل"
                                                        >
                                                            <Edit size={14} />
                                                        </button>

                                                        {/* Delete */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(c.id)}
                                                            className="p-2 rounded-xl bg-surface hover:bg-danger/15 text-text-muted hover:text-danger border border-border/50 transition-all active:scale-95"
                                                            title="حذف العميل"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>

                                                    {/* Debt Actions (Pay, Installments, WhatsApp) */}
                                                    <div className="flex items-center gap-1">
                                                        {hasAnyDebt && (
                                                            <>
                                                                {instDebt > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setInstallmentModal(c.id)}
                                                                        className="p-2 rounded-xl bg-warning/10 text-warning hover:bg-warning/20 border border-warning/30 transition-all active:scale-95"
                                                                        title="جدول الأقساط"
                                                                    >
                                                                        <Calculator size={14} />
                                                                    </button>
                                                                )}

                                                                <button
                                                                    type="button"
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
                                                                    className="p-2 rounded-xl bg-success/10 text-success hover:bg-success/20 border border-success/30 transition-all active:scale-95"
                                                                    title="إرسال تذكير عبر واتساب"
                                                                >
                                                                    <MessageSquare size={14} />
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPayDebtModal(c)}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:brightness-110 text-primary-fg font-extrabold text-xs shadow-sm shadow-primary/20 active:scale-95 transition-all"
                                                                    title="تسديد دفعة من الدين"
                                                                >
                                                                    <Wallet size={13} />
                                                                    <span>تسديد</span>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            <div className="shrink-0 py-3 flex items-center justify-between border-t border-border px-4 bg-surface rounded-b-xl">
                <span className="text-[10px] text-text-muted font-mono flex items-center gap-2 font-bold">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]"></div>
                    عرض {filtered.length} من {total} عميل
                </span>
                <div className="flex items-center gap-2">
                    <button
                        disabled={page <= 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="p-2 bg-bg border border-border rounded-xl text-text-main hover:bg-surface-hover disabled:opacity-30 transition-colors"
                        title="الصفحة السابقة"
                    >
                        <ArrowRight size={16} className="rotate-180" />
                    </button>
                    <span className="text-xs font-bold text-text-main min-w-[32px] text-center bg-bg py-2 px-3 rounded-xl border border-border">
                        {page} / {totalPages || 1}
                    </span>
                    <button
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="p-2 bg-bg border border-border rounded-xl text-text-main hover:bg-surface-hover disabled:opacity-30 transition-colors"
                        title="الصفحة التالية"
                    >
                        <ArrowRight size={16} />
                    </button>
                </div>
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
                        <div className="absolute top-0 right-0 w-20 h-20 bg-danger/10 blur-xl rounded-full pointer-events-none"></div>
                        <p className="text-xs text-text-muted font-bold uppercase tracking-wider mb-2">إجمالي الدين المستحق</p>
                        <p className="text-4xl font-black text-text-main tracking-tight font-mono">{formatCurrency(payDebtModal.debt || 0, prefs?.currency).replace(prefs?.currency || 'IQD', '')}<span className="text-sm text-danger ml-1">{prefs?.currency || 'IQD'}</span></p>
                    </div>
                    <div className="relative">
                        <input type="number" id="payAmount" className="w-full bg-input-bg border border-border text-primary rounded-2xl p-4 outline-none focus:border-primary font-black text-center text-3xl placeholder:text-text-muted" placeholder="0" autoFocus />
                        <p className="text-[10px] text-text-muted mt-2 font-bold">أدخل المبلغ المراد تسديده</p>
                    </div>
                    <button onClick={() => handlePayDebt(Number((document.getElementById('payAmount') as HTMLInputElement).value))} className="w-full bg-success text-white font-black py-4 rounded-2xl hover:bg-success shadow-lg shadow-success/20 active:scale-95 transition-all text-sm">تأكيد الدفع</button>
                </div>
            </Modal>}

            {installmentModal && <Modal title="الأقساط المستحقة" onClose={() => setInstallmentModal(null)} size="lg">
                <div className="space-y-4">
                    {customerInstallments.length === 0 ? <p className="text-center text-text-muted py-6 text-xs font-bold">لا توجد أقساط نشطة.</p> : customerInstallments.map(s => (
                        <div key={s.id} className="bg-bg border border-border rounded-2xl p-4">
                            <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
                                <div>
                                    <p className="text-xs text-text-muted font-bold">فاتورة #{s.id}</p>
                                    <p className="text-primary font-black text-sm font-mono">{formatCurrency(s.total, prefs?.currency)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setPreviewSale(s); setPreviewMode('a4'); }}
                                        className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold hover:bg-primary/20 transition-all flex items-center gap-1"
                                        title="معاينة الفاتورة"
                                    >
                                        <Eye size={14} /> معاينة
                                    </button>
                                </div>
                                <div>
                                    <p className="text-xs text-text-muted">المتبقي</p>
                                    <p className="text-danger font-bold font-mono">
                                        {formatCurrency(s.installmentPlan?.schedule.filter(i => i.status !== 'paid').reduce((acc, i) => acc + i.amount, 0) || 0, prefs?.currency)}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {s.installmentPlan?.schedule.map((inst, idx) => (
                                    <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border ${inst.status === 'paid' ? 'bg-success/5 border-success/20' : new Date(inst.dueDate) < new Date() ? 'bg-danger/5 border-danger/20' : 'bg-surface border-border'}`}>
                                        <div>
                                            <p className={`text-xs font-bold font-mono ${inst.status === 'paid' ? 'text-success' : 'text-text-main'}`}>قسط #{inst.number} - {formatCurrency(inst.amount)}</p>
                                            <p className="text-[10px] text-text-muted">مستحق: {inst.dueDate}</p>
                                        </div>
                                        {inst.status === 'paid' ? (
                                            <span className="text-xs text-success font-bold flex items-center gap-1"><Check size={14} /> تم الدفع</span>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={payingKey === `${s.id}-${idx}`}
                                                onClick={() => handlePayInstallment(s.id, idx, inst.amount)}
                                                className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold hover:bg-primary hover:text-primary-fg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                            >
                                                {payingKey === `${s.id}-${idx}` ? 'جاري التسديد...' : 'تسديد الآن'}
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
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${previewMode === 'a4' ? 'bg-primary text-primary-fg' : 'bg-surface border border-border text-text-muted hover:text-text-main'}`}
                                >
                                    <FileText size={16} /> فاتورة رسمية A4
                                </button>
                                <button
                                    onClick={() => setPreviewMode('thermal')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${previewMode === 'thermal' ? 'bg-primary text-primary-fg' : 'bg-surface border border-border text-text-muted hover:text-text-main'}`}
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
                                    } catch {
                                        notify('فشل في إنشاء ملف PDF', 'error');
                                    }
                                }}
                                className="w-full bg-primary text-primary-fg font-black py-4 rounded-xl hover:brightness-110 shadow-lg shadow-primary/20 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
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
