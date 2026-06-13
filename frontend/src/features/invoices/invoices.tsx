import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PrintPortal } from '../../components/PrintPortal';
import { Search, Printer, FileText, Receipt, RefreshCcw, Trash2, DollarSign, CheckCircle2, Clock, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Calendar, ArrowUpRight, CreditCard, ScanLine } from 'lucide-react';
import { Sale } from '../../core/types';
import { formatCurrency, playBeep } from '../../core/utils';
import { Badge, Modal, PageHeader, EmptyState, useScanDetection } from '../../components/ui';
import { ReceiptTemplate } from '../../components/ReceiptTemplate';
import { PinModal } from '../../components/PinModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { BarcodeScannerOverlay, ScanResult } from '../../components/BarcodeScannerOverlay';
import { api } from '../../core/api';
import { useInvalidateSales, useInvalidateProducts, useInvalidateCustomers } from '../../hooks';
import { PageShell, StatsGrid, StatCard, LoadingState, FilterBar, SearchInput, SegmentedControl, Pagination } from '../../components/blocks';
import { usePreferences } from '../../components/PreferencesContext';

export const InvoicesPage: React.FC = () => {
    const { notify, prefs } = usePreferences();
    // i18n
    const { t } = useTranslation();

    // React Query cache invalidation for cross-page sync
    const invalidateSales = useInvalidateSales();
    const invalidateProducts = useInvalidateProducts();
    const invalidateCustomers = useInvalidateCustomers();

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'returned'>('all');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');
    const [selectedInvoice, setSelectedInvoice] = useState<Sale | null>(null);
    const [showStats, setShowStats] = useState(false);

    const [deleteConfirmation, setDeleteConfirmation] = useState<Sale | null>(null);
    const [returnConfirmation, setReturnConfirmation] = useState<Sale | null>(null);
    const [showPinModal, setShowPinModal] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [printMode, setPrintMode] = useState<'a4' | 'thermal'>('a4');
    const [previewScale, setPreviewScale] = useState(0.45);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const [page, setPage] = useState(0);
    const pageSize = 50;

    // --- Server Data State ---
    const [salesData, setSalesData] = useState<Sale[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [stats, setStats] = useState({ count: 0, total: 0, pending: 0, returns: 0 });
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await api.sales.list(page, pageSize, search, statusFilter, dateFilter);
            setSalesData(data.data);
            setTotalRecords(data.total);
            setStats(data.stats);
        } catch (e) {
            console.error(e);
            notify("خطأ في تحميل المبيعات", "error");
        } finally {
            setLoading(false);
        }
    };

    // Load data when dependencies change
    useEffect(() => { loadData(); }, [page, search, statusFilter, dateFilter]);


    // --- Actions ---
    const handleInitDelete = (sale: Sale) => {
        if (prefs.adminPin) {
            setDeleteConfirmation(sale);
            setShowPinModal(true);
        } else {
            setDeleteConfirmation(sale);
        }
    };

    const performDelete = async () => {
        if (!deleteConfirmation) return;
        try {
            await api.sales.delete(deleteConfirmation.id);
            notify('تم حذف الفاتورة بنجاح', 'success');
            setDeleteConfirmation(null);
            setSelectedInvoice(null);
            setShowPinModal(false);
            invalidateSales(); // Sync cache
            loadData();
        } catch (_e) {
            notify('خطأ في الحذف', 'error');
        }
    };

    const handleReturnInit = (sale: Sale) => {
        setReturnConfirmation(sale);
    };

    const performReturn = async () => {
        if (!returnConfirmation) return;
        try {
            await api.sales.return(returnConfirmation.id);
            notify('تم إرجاع الفاتورة وتحديث المخزون', 'success');
            setSelectedInvoice(null);
            setIsPrinting(false);
            setReturnConfirmation(null);
            invalidateSales(); // Sync sales cache
            invalidateProducts(); // Sync products (stock restored)
            invalidateCustomers(); // Sync customer debt
            loadData();
        } catch (_e) {
            notify('خطأ في عملية الإرجاع', 'error');
            console.error(_e);
        }
    };

    // QR Code Scanner Handler
    const handleScan = async (code: string): Promise<ScanResult> => {
        // Check if this is an invoice QR code (format: INV:XXXXXX|T:XXXXX|D:XXXX)
        if (code.startsWith('INV:')) {
            const invoiceId = code.split('|')[0].replace('INV:', '');
            try {
                const sale = await api.sales.get(invoiceId);
                if (sale) {
                    setSelectedInvoice(sale);
                    setIsScannerOpen(false);
                    playBeep('success');
                    return { success: true, name: `فاتورة #${invoiceId}` };
                } else {
                    playBeep('error');
                    notify('الفاتورة غير موجودة', 'error');
                    return { success: false, message: 'فاتورة غير موجودة' };
                }
            } catch (_e) {
                playBeep('error');
                notify('خطأ في تحميل الفاتورة', 'error');
                return { success: false, message: 'خطأ في التحميل' };
            }
        }
        // Not an invoice QR
        playBeep('error');
        return { success: false, message: 'هذا ليس QR فاتورة' };
    };

    // Listen for keyboard barcode scans
    useScanDetection({ onScan: handleScan });

    if (loading) return <LoadingState icon={FileText} title="جاري تحميل الفواتير..." subtitle="معالجة السجلات" />;

    return (
        <PageShell className="relative">
            <PinModal
                isOpen={showPinModal}
                onClose={() => { setShowPinModal(false); setDeleteConfirmation(null); }}
                onSuccess={performDelete}
                title="تأكيد الحذف"
            />

            <PageHeader
                title="سجل الفواتير"
                icon={FileText}
                description="إدارة شاملة للمبيعات، المرتجعات، والذمم المالية."
                actions={
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${showStats
                            ? 'bg-surface border border-border text-text-muted hover:text-text-main'
                            : 'bg-gradient-to-br from-primary to-emerald-500 text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105'
                            }`}
                        title={showStats ? 'إخفاء الإحصائيات' : 'عرض التحليل'}
                    >
                        <ArrowUpRight size={showStats ? 20 : 22} />
                    </button>
                }
            />

            {/* Stats Cards */}
            <StatsGrid columns={4} visible={showStats}>
                <StatCard icon={DollarSign} label="إجمالي المبيعات" value={formatCurrency(stats.total, prefs.currency).replace(prefs.currency, '')} color="blue" subtitle={`${stats.count} فاتورة`} />
                <StatCard icon={Clock} label="مبالغ معلقة (ذمم)" value={formatCurrency(stats.pending, prefs.currency).replace(prefs.currency, '')} color="orange" subtitle="قيد التحصيل" />
                <StatCard icon={RefreshCcw} label="عدد المرتجعات" value={stats.returns} color="red" subtitle="تم استرجاعها" />
                <StatCard icon={CheckCircle2} label="صافي العمليات" value={stats.count - stats.returns} color="emerald" subtitle="• مكتملة" />
            </StatsGrid>

            {/* Filter Bar */}
            <FilterBar>
                <SearchInput
                    value={search}
                    onChange={v => { setSearch(v); setPage(0); }}
                    placeholder="بحث برقم الفاتورة أو اسم العميل..."
                />

                    <SegmentedControl
                        options={[
                            { id: 'all', label: 'الكل' },
                            { id: 'completed', label: 'مكتمل' },
                            { id: 'pending', label: 'معلق' },
                            { id: 'returned', label: 'مرتجع' },
                        ]}
                        value={statusFilter}
                        onChange={v => { setStatusFilter(v as 'all' | 'completed' | 'pending' | 'returned'); setPage(0); }}
                    />
                    <div className="w-px h-8 bg-border mx-1"></div>
                    <SegmentedControl
                        options={[
                            { id: 'all', label: 'الكل' },
                            { id: 'today', label: 'اليوم' },
                            { id: 'week', label: 'أسبوع' },
                        ]}
                        value={dateFilter}
                        onChange={v => setDateFilter(v as 'all' | 'today' | 'week')}
                    />
                    <button
                        onClick={() => setIsScannerOpen(true)}
                        className="p-3.5 bg-primary text-primary-fg rounded-xl hover:brightness-110 transition-all flex items-center gap-2 font-bold text-sm shrink-0 touch-target active:scale-95"
                        title="مسح QR الفاتورة"
                    >
                        <ScanLine size={18} />
                        <span className="hidden sm:inline">مسح QR</span>
                    </button>
            </FilterBar>

            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pr-2 pb-10">
                {salesData.length === 0 ? (
                    <EmptyState
                        icon={FileText}
                        title="لا توجد فواتير"
                        description={search ? "لا توجد نتائج مطابقة لبحثك." : "لم يتم تسجيل أي عمليات بيع بعد."}
                    />
                ) : (
                    <div className="space-y-2">
                        <div className="hidden md:grid grid-cols-12 gap-3 px-6 py-2 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                            <div className="col-span-2">رقم الفاتورة</div>
                            <div className="col-span-3">العميل</div>
                            <div className="col-span-2">التاريخ</div>
                            <div className="col-span-2">الإجمالي</div>
                            <div className="col-span-2">الحالة</div>
                            <div className="col-span-1 text-center">إجراءات</div>
                        </div>

                        {salesData.map((s: Sale, index) => {
                            const animStyle = { animationDelay: `${index * 50}ms` };
                            return (
                                <div
                                    key={s.id}
                                    onClick={() => { setSelectedInvoice(s); setIsPrinting(false); setPrintMode('a4'); }}
                                    className={`
                            group relative bg-surface/50 border border-border rounded-2xl p-4 cursor-pointer backdrop-blur-md
                            transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1
                            grid grid-cols-2 md:grid-cols-12 gap-3 items-center
                            ${s.status === 'returned' ? 'opacity-60 grayscale-[0.5]' : ''}
                        `}
                                    style={animStyle}
                                >
                                    <div className={`absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full shadow-[0_0_10px_currentColor] ${s.status === 'completed' ? 'bg-emerald-500 text-emerald-500' : s.status === 'returned' ? 'bg-red-500 text-red-500' : 'bg-orange-500 text-orange-500'}`}></div>

                                    <div className="col-span-2 flex items-center gap-3 pl-2">
                                        <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center text-text-muted group-hover:text-primary transition-colors shadow-inner">
                                            <FileText size={18} />
                                        </div>
                                        <div>
                                            <p className="font-mono font-bold text-text-main text-xs group-hover:text-primary transition-colors">{s.id}</p>
                                            <p className="text-[10px] text-text-muted font-medium">{s.itemsCount} مواد</p>
                                        </div>
                                    </div>

                                    <div className="col-span-3">
                                        <p className="font-bold text-text-main text-sm truncate">{s.customer}</p>
                                        <p className="text-[10px] text-text-muted flex items-center gap-1.5 mt-0.5">
                                            {s.paymentMethod === 'cash' ? <DollarSign size={10} /> : <CreditCard size={10} />}
                                            {t(`sales.${s.paymentMethod}`)}
                                        </p>
                                    </div>

                                    <div className="col-span-2">
                                        <div className="flex items-center gap-1.5 text-text-muted text-[10px] bg-bg px-2 py-1 rounded-lg w-fit border border-border">
                                            <Calendar size={10} />
                                            <span>{new Date(s.date).toLocaleDateString('en-GB')}</span>
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <span className="font-black text-text-main text-lg tracking-tight drop-shadow-sm">{formatCurrency(s.total, prefs.currency).replace(prefs.currency, '')} <span className="text-[9px] text-text-muted font-bold ml-0.5">{prefs.currency}</span></span>
                                    </div>

                                    <div className="col-span-2">
                                        <Badge type={s.status === 'completed' ? 'success' : s.status === 'returned' ? 'error' : 'warning'} text={s.status === 'completed' ? 'مكتمل' : s.status === 'returned' ? 'مرتجع' : 'معلق'} />
                                    </div>

                                    <div className="col-span-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-surface border border-border rounded-xl p-1 flex shadow-xl backdrop-blur-md">
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedInvoice(s); setIsPrinting(false); setPrintMode('a4'); }} className="p-2 hover:bg-surface-hover hover:text-primary text-text-muted rounded-lg transition-colors" title="طباعة الفاتورة"><Printer size={16} /></button>
                                            <div className="w-px bg-border my-1"></div>
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedInvoice(s); setIsPrinting(false); setPrintMode('a4'); }} className="p-2 hover:bg-surface-hover hover:text-text-main text-text-muted rounded-lg transition-colors" title="عرض التفاصيل"><ArrowUpRight size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            <Pagination
                page={page}
                totalRecords={totalRecords}
                pageSize={pageSize}
                onPageChange={setPage}
            />

            {/* Print Preview Modal - Only for preview, PrintPortal is triggered separately */}
            {selectedInvoice && (
                <Modal title="معاينة الطباعة" onClose={() => setSelectedInvoice(null)} size="lg">
                    <div className="flex flex-col h-[75vh]">
                        {/* Print Mode Selection - Compact */}
                        <div className="flex flex-col sm:flex-row justify-center gap-3 mb-2 pb-2 border-b border-border">
                            <button
                                onClick={() => setPrintMode('thermal')}
                                className={`px-6 py-3 rounded-2xl font-bold transition-all border-2 flex items-center justify-center gap-3 flex-1 sm:flex-none ${printMode === 'thermal' ? 'bg-primary text-primary-fg border-primary shadow-lg shadow-primary/20' : 'bg-surface text-text-muted border-border hover:border-primary/50 hover:text-text-main'}`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${printMode === 'thermal' ? 'bg-black/10' : 'bg-bg'}`}>
                                    <Receipt size={20} />
                                </div>
                                <div className="text-right">
                                    <span className="block text-sm">إيصال حراري</span>
                                    <span className="block text-[10px] opacity-70">80mm</span>
                                </div>
                            </button>

                            <button
                                onClick={() => setPrintMode('a4')}
                                className={`px-6 py-3 rounded-2xl font-bold transition-all border-2 flex items-center justify-center gap-3 flex-1 sm:flex-none ${printMode === 'a4' ? 'bg-primary text-primary-fg border-primary shadow-lg shadow-primary/20' : 'bg-surface text-text-muted border-border hover:border-primary/50 hover:text-text-main'}`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${printMode === 'a4' ? 'bg-black/10' : 'bg-bg'}`}>
                                    <FileText size={20} />
                                </div>
                                <div className="text-right">
                                    <span className="block text-sm">فاتورة رسمية</span>
                                    <span className="block text-[10px] opacity-70">A4</span>
                                </div>
                            </button>
                        </div>

                        {/* Preview Area */}
                        <div className="flex-1 bg-gray-200 rounded-3xl overflow-hidden relative shadow-inner flex flex-col">
                            {/* Scrollable Receipt Container */}
                            <div className="flex-1 overflow-auto custom-scrollbar p-2 flex justify-center items-start">
                                <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center', transition: 'transform 0.2s' } as React.CSSProperties}>
                                    <ReceiptTemplate sale={selectedInvoice} prefs={prefs} mode={printMode} />
                                </div>
                            </div>

                            {/* Floating Zoom Controls */}
                            <div className="absolute bottom-4 right-4 flex gap-2 bg-surface/90 backdrop-blur-md rounded-xl p-2 border border-border shadow-lg z-10">
                                <button onClick={() => setPreviewScale(s => Math.min(1.5, s + 0.1))} className="p-2 hover:bg-surface-hover text-text-main rounded-lg transition-colors" title="تكبير"><ZoomIn size={20} /></button>
                                <div className="w-px bg-border"></div>
                                <button onClick={() => setPreviewScale(s => Math.max(0.3, s - 0.1))} className="p-2 hover:bg-surface-hover text-text-main rounded-lg transition-colors" title="تصغير"><ZoomOut size={20} /></button>
                            </div>
                        </div>

                        {/* Sticky Action Footer */}
                        <div className="shrink-0 mt-6 pt-4 border-t border-border flex gap-3 bg-surface z-20">
                            <button
                                onClick={() => setIsPrinting(true)}
                                className="flex-1 bg-primary text-primary-fg font-black py-4 rounded-xl hover:brightness-110 shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                            >
                                <Printer size={22} />
                                <span className="text-sm">طباعة الفاتورة</span>
                            </button>

                            {selectedInvoice.status !== 'returned' && (
                                <button onClick={() => handleReturnInit(selectedInvoice)} className="px-6 bg-orange-500/10 text-orange-500 border-2 border-orange-500/20 rounded-xl font-bold hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all flex items-center gap-2" title="استرجاع الفاتورة">
                                    <RefreshCcw size={20} />
                                </button>
                            )}
                            <button onClick={() => handleInitDelete(selectedInvoice)} className="px-6 bg-red-500/10 text-red-500 border-2 border-red-500/20 rounded-xl font-bold hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center gap-2" title="حذف الفاتورة">
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* PRINT PORTAL - Opens popup window when isPrinting is true */}
            {isPrinting && selectedInvoice && (
                <PrintPortal onAfterPrint={() => setIsPrinting(false)}>
                    <ReceiptTemplate sale={selectedInvoice} prefs={prefs} mode={printMode} />
                </PrintPortal>
            )}

            {/* Return Confirmation Modal */}
            <ConfirmModal
                isOpen={!!returnConfirmation}
                title="تأكيد الإرجاع"
                message="هل أنت متأكد من إرجاع هذه الفاتورة؟ سيتم إعادة المخزون وتحديث حساب العميل."
                type="warning"
                confirmText="نعم، إرجاع"
                cancelText="إلغاء"
                onConfirm={performReturn}
                onCancel={() => setReturnConfirmation(null)}
            />

            {/* QR Scanner Overlay */}
            {isScannerOpen && (
                <BarcodeScannerOverlay
                    onClose={() => setIsScannerOpen(false)}
                    onScan={handleScan}
                    continuous={false}
                />
            )}
        </PageShell>
    );
};

