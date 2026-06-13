/**
 * SalesModals - All modals used in the Sales page
 * Extracted from Sales.tsx for better maintainability
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { Package, ScanLine, CreditCard, Plus, PlayCircle, History } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Modal } from '../../../../components/ui';
import { SplitPaymentModal } from '../SplitPaymentModal';
import { ConfirmModal } from '../../../../components/ConfirmModal';
import { BarcodeScannerOverlay, ScanResult } from '../../../../components/BarcodeScannerOverlay';
import { ReceiptTemplate } from '../../../../components/ReceiptTemplate';
import { PrintPortal } from '../../../../components/PrintPortal';
import { formatCurrency } from '../../../../core/utils';
import { Customer, Sale, AppPreferences } from '../../../../core/types';
import { ParkedSaleDB, api } from '../../../../core/api';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface QuickFormState {
    name: string;
    price: number;
}

export interface InstallmentConfig {
    downPayment: number;
    months: number;
}

export interface CheckoutExtras {
    paymentMethod?: 'cash' | 'card' | 'credit' | 'split' | 'installment';
    status?: 'pending' | 'completed';
    splitDetails?: { cash: number; card: number };
    installmentPlan?: {
        totalAmount: number;
        downPayment: number;
        months: number;
        startDate: string;
        schedule: Array<{ number: number; dueDate: string; amount: number; status: 'pending' | 'paid' }>;
    };
}

export interface SalesModalsProps {
    // Modal visibility states
    showCustomerModal: boolean;
    showParkedModal: boolean;
    showQuickAddModal: boolean;
    showSplitModal: boolean;
    showInstallmentModal: boolean;
    isScannerOpen: boolean;

    // Modal close handlers
    onCloseCustomerModal: () => void;
    onCloseParkedModal: () => void;
    onCloseQuickAddModal: () => void;
    onCloseSplitModal: () => void;
    onCloseInstallmentModal: () => void;
    onCloseScannerModal: () => void;

    // Data
    customers: Customer[];
    parkedSales: ParkedSaleDB[];
    prefs: AppPreferences;
    total: number;

    // Quick Add Form
    quickForm: QuickFormState;
    setQuickForm: (form: QuickFormState) => void;
    newProductBarcode: string;
    onQuickAdd: () => void;

    // Installment Config
    instConfig: InstallmentConfig;
    setInstConfig: (config: InstallmentConfig) => void;
    onInstallmentConfirm: () => void;

    // Callbacks
    onSelectCustomer: (customer: Customer | null) => void;
    onRetrieveSale: (parked: ParkedSaleDB) => void;
    onCheckout: (extras?: CheckoutExtras) => void;
    onScan: (code: string) => Promise<ScanResult>;

    // Confirm Modal for product not found
    confirmState: { open: boolean; barcode: string };
    onConfirmAddProduct: () => void;
    onCancelConfirm: () => void;

    // Invoice QR Lookup
    scannedInvoice: Sale | null;
    onCloseScannedInvoice: () => void;
    onPrintInvoice: (sale: Sale) => void;
    notify: (message: string, type: 'success' | 'error' | 'info') => void;

    // Auto Print
    lastSaleForPrint: Sale | null;
    onAfterPrint: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Customer Selection Modal with Quick Add
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomerSelectionModalProps {
    customers: Customer[];
    prefs: AppPreferences;
    onSelectCustomer: (customer: Customer | null) => void;
    onCloseCustomerModal: () => void;
    notify: (message: string, type: 'success' | 'error' | 'info') => void;
}

const CustomerSelectionModal: React.FC<CustomerSelectionModalProps> = ({
    customers,
    prefs,
    onSelectCustomer,
    onCloseCustomerModal,
    notify,
}) => {
    const [showAddForm, setShowAddForm] = React.useState(false);
    const [newCustomer, setNewCustomer] = React.useState({ name: '', phone: '' });
    const [isLoading, setIsLoading] = React.useState(false);

    const handleAddCustomer = async () => {
        if (!newCustomer.name.trim()) {
            notify('يرجى إدخال اسم العميل', 'error');
            return;
        }

        setIsLoading(true);
        try {
            const customerId = `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const customer: Customer = {
                id: customerId,
                name: newCustomer.name.trim(),
                phone: newCustomer.phone.trim(),
                totalPurchases: 0,
                debt: 0,
                installmentDebt: 0,
                points: 0,
                lastVisit: new Date().toISOString(),
            };
            await api.customers.save(customer);
            notify('تم إضافة العميل بنجاح', 'success');
            onSelectCustomer(customer);
            onCloseCustomerModal();
        } catch (e) {
            console.error('Failed to add customer', e);
            notify('فشل في إضافة العميل', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal title={showAddForm ? "إضافة عميل جديد" : "اختر العميل"} onClose={onCloseCustomerModal} size="md">
            {showAddForm ? (
                <div className="space-y-4 pt-2">
                    {/* Back Button */}
                    <button
                        onClick={() => setShowAddForm(false)}
                        className="text-xs text-text-muted hover:text-text-main font-bold flex items-center gap-1"
                    >
                        ← العودة للقائمة
                    </button>

                    {/* Name Input */}
                    <div>
                        <label className="text-xs font-bold text-text-muted block mb-2">اسم العميل *</label>
                        <input
                            autoFocus
                            value={newCustomer.name}
                            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                            className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-sm font-bold text-text-main focus:border-primary outline-none transition-all"
                            placeholder="مثال: أحمد محمد"
                        />
                    </div>

                    {/* Phone Input */}
                    <div>
                        <label className="text-xs font-bold text-text-muted block mb-2">رقم الهاتف (اختياري)</label>
                        <input
                            value={newCustomer.phone}
                            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                            className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-sm font-bold text-text-main focus:border-primary outline-none transition-all"
                            placeholder="07XX XXX XXXX"
                            dir="ltr"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleAddCustomer}
                        disabled={isLoading || !newCustomer.name.trim()}
                        className="w-full bg-primary text-primary-fg font-bold py-3.5 rounded-xl hover:brightness-110 shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>جاري الإضافة...</>
                        ) : (
                            <><Plus size={18} /> إضافة واختيار</>
                        )}
                    </button>
                </div>
            ) : (
                <div className="space-y-1 pt-2">
                    {/* Add New Customer Button */}
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="w-full p-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl text-primary font-bold text-sm flex items-center justify-center gap-2 transition-all mb-3"
                    >
                        <Plus size={18} /> إضافة عميل جديد
                    </button>

                    {/* Customer List */}
                    {customers.map(c => (
                        <div
                            key={c.id}
                            onClick={() => { onSelectCustomer(c); onCloseCustomerModal(); }}
                            className="p-3 hover:bg-surface-hover rounded-lg cursor-pointer flex justify-between items-center border border-transparent hover:border-border transition-all group"
                        >
                            <div>
                                <p className="font-bold text-text-main text-sm">{c.name}</p>
                                <p className="text-[10px] text-text-muted">{c.phone}</p>
                            </div>
                            {c.debt > 0 && (
                                <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-1 rounded-lg font-bold border border-red-500/20">
                                    دين: {formatCurrency(c.debt, prefs.currency)}
                                </span>
                            )}
                        </div>
                    ))}

                    {/* Guest Button */}
                    <button
                        onClick={() => { onSelectCustomer(null); onCloseCustomerModal(); }}
                        className="w-full text-center py-3 text-xs text-text-muted hover:text-text-main font-bold mt-2 border-t border-border"
                    >
                        عميل عام (Guest)
                    </button>
                </div>
            )}
        </Modal>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export const SalesModals: React.FC<SalesModalsProps> = ({
    showCustomerModal,
    showParkedModal,
    showQuickAddModal,
    showSplitModal,
    showInstallmentModal,
    isScannerOpen,
    onCloseCustomerModal,
    onCloseParkedModal,
    onCloseQuickAddModal,
    onCloseSplitModal,
    onCloseInstallmentModal,
    onCloseScannerModal,
    customers,
    parkedSales,
    prefs,
    total,
    quickForm,
    setQuickForm,
    newProductBarcode,
    onQuickAdd,
    instConfig,
    setInstConfig,
    onInstallmentConfirm,
    onSelectCustomer,
    onRetrieveSale,
    onCheckout,
    onScan,
    confirmState,
    onConfirmAddProduct,
    onCancelConfirm,
    scannedInvoice,
    onCloseScannedInvoice,
    onPrintInvoice,
    notify,
    lastSaleForPrint,
    onAfterPrint,
}) => {
    // Reference for silent print receipt capture
    const silentPrintRef = useRef<HTMLDivElement>(null);
    const [isSilentPrinting, setIsSilentPrinting] = React.useState(false);

    // ═══════════════════════════════════════════════════════════════════════════════
    // 🖨️ SILENT BITMAP PRINTING - Captures receipt as image for Arabic support
    // ═══════════════════════════════════════════════════════════════════════════════
    const handleSilentBitmapPrint = useCallback(async () => {
        if (!silentPrintRef.current || !lastSaleForPrint || !prefs.autoPrint) return;
        if (prefs.autoPrintFormat !== 'thermal') return; // Only for thermal
        if (!prefs.receiptPrinter?.trim()) {
            notify('⚠️ لم يتم تحديد طابعة الإيصالات في الإعدادات', 'error');
            onAfterPrint();
            return;
        }

        try {
            setIsSilentPrinting(true);

            // Wait for fonts to load
            await document.fonts.ready;
            await new Promise(r => setTimeout(r, 200));

            // Capture receipt as PNG
            const dataUrl = await toPng(silentPrintRef.current, {
                quality: 1.0,
                pixelRatio: 2, // Higher quality
                backgroundColor: 'white',
                cacheBust: true,
            });

            // Send to backend for ESC/POS bitmap printing
            await api.print.bitmapReceipt(prefs.receiptPrinter, dataUrl);

            notify('✓ تمت الطباعة بنجاح', 'success');
        } catch (err: unknown) {
            console.error("Bitmap Print Failed:", err);
            const errorMsg = err instanceof Error ? err.message : String(err);

            if (errorMsg.includes('OpenPrinter') || errorMsg.includes('printer')) {
                notify(`❌ الطابعة "${prefs.receiptPrinter}" غير متصلة`, 'error');
            } else {
                notify(`❌ فشلت الطباعة: ${errorMsg.substring(0, 50)}`, 'error');
            }
        } finally {
            setIsSilentPrinting(false);
            onAfterPrint();
        }
    }, [lastSaleForPrint, prefs, onAfterPrint, notify]);

    // Track last printed sale to prevent double printing
    const lastPrintedSaleRef = useRef<string | null>(null);

    // Trigger silent print when sale is ready
    useEffect(() => {
        if (lastSaleForPrint && prefs.autoPrint && prefs.autoPrintFormat === 'thermal' && silentPrintRef.current) {
            // Prevent double printing - check if we already printed this sale
            if (lastPrintedSaleRef.current === lastSaleForPrint.id) {
                return;
            }
            if (isSilentPrinting) {
                return;
            }
            lastPrintedSaleRef.current = lastSaleForPrint.id;
            handleSilentBitmapPrint();
        } else {
            // Reset when no sale
            lastPrintedSaleRef.current = null;
        }
    }, [lastSaleForPrint, prefs.autoPrint, prefs.autoPrintFormat, handleSilentBitmapPrint, isSilentPrinting]);

    // Show PrintPortal only for A4 or when NOT using silent thermal print
    const shouldShowPrintPortal = lastSaleForPrint && prefs.autoPrint && prefs.autoPrintFormat !== 'thermal';
    // Show hidden receipt for silent thermal capture
    const shouldShowSilentCapture = lastSaleForPrint && prefs.autoPrint && prefs.autoPrintFormat === 'thermal';

    return (
        <>
            {/* Customer Selection Modal */}
            {showCustomerModal && (
                <CustomerSelectionModal
                    customers={customers}
                    prefs={prefs}
                    onSelectCustomer={onSelectCustomer}
                    onCloseCustomerModal={onCloseCustomerModal}
                    notify={notify}
                />
            )}

            {/* Quick Add Product Modal */}
            {showQuickAddModal && (
                <Modal title="إضافة منتج سريع" onClose={onCloseQuickAddModal} size="sm">
                    <div className="space-y-6">
                        {/* Header illustration */}
                        <div className="flex flex-col items-center text-center pb-4 border-b border-border">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                                <Package size={28} className="text-primary" />
                            </div>
                            <p className="text-text-muted text-sm">أضف منتجاً جديداً وأضفه للسلة مباشرةً</p>
                        </div>

                        {/* Form Fields */}
                        <div className="space-y-4">
                            {/* Barcode - Read only */}
                            <div className="bg-bg rounded-2xl border border-border p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                                        <ScanLine size={18} className="text-purple-500" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-text-muted block mb-1">الباركود</label>
                                        <p className="font-mono font-bold text-text-main text-sm">{newProductBarcode || '—'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Product Name */}
                            <div>
                                <label className="text-xs font-bold text-text-muted block mb-2 flex items-center gap-2">
                                    <Package size={14} /> اسم المنتج
                                </label>
                                <input
                                    autoFocus
                                    value={quickForm.name}
                                    onChange={e => setQuickForm({ ...quickForm, name: e.target.value })}
                                    className="w-full bg-input-bg border border-border rounded-xl px-4 py-3.5 text-sm font-bold text-text-main focus:border-primary focus:shadow-glow outline-none transition-all"
                                    placeholder="مثال: عصير برتقال 1 لتر"
                                />
                            </div>

                            {/* Price */}
                            <div>
                                <label className="text-xs font-bold text-text-muted block mb-2 flex items-center gap-2">
                                    <CreditCard size={14} /> سعر البيع
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={quickForm.price}
                                        onChange={e => setQuickForm({ ...quickForm, price: Number(e.target.value) })}
                                        className="w-full bg-input-bg border border-border rounded-xl px-4 py-3.5 text-sm font-bold text-text-main focus:border-primary focus:shadow-glow outline-none transition-all pl-16"
                                        placeholder="0"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">{prefs.currency}</span>
                                </div>
                            </div>
                        </div>

                        {/* Action Button */}
                        <button
                            onClick={onQuickAdd}
                            disabled={!quickForm.name || quickForm.price <= 0}
                            className="w-full bg-primary text-primary-fg font-bold py-4 rounded-xl hover:brightness-110 shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={20} strokeWidth={3} />
                            <span className="text-sm">إضافة المنتج وبيعه فوراً</span>
                        </button>
                    </div>
                </Modal>
            )}

            {/* Split Payment Modal */}
            {showSplitModal && (
                <SplitPaymentModal
                    total={total}
                    onClose={onCloseSplitModal}
                    onConfirm={(c, d) => onCheckout({ paymentMethod: 'split', splitDetails: { cash: c, card: d } })}
                />
            )}

            {/* Installment Modal */}
            {showInstallmentModal && (
                <Modal title="خطة الأقساط" onClose={onCloseInstallmentModal} size="sm">
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="block text-[10px] text-text-muted font-bold mb-1">الدفعة المقدمة</label>
                            <input
                                type="number"
                                title="الدفعة المقدمة"
                                placeholder="0"
                                className="w-full bg-input-bg border border-border text-text-main rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-primary"
                                value={instConfig.downPayment}
                                onChange={e => setInstConfig({ ...instConfig, downPayment: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-text-muted font-bold mb-1">عدد الأشهر</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[3, 6, 12, 24].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setInstConfig({ ...instConfig, months: m })}
                                        className={`py-2 rounded-xl text-xs font-bold border ${instConfig.months === m ? 'bg-primary text-primary-fg border-primary' : 'bg-input-bg text-text-muted border-border'}`}
                                    >
                                        {m} شهر
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={onInstallmentConfirm}
                            className="w-full bg-primary text-primary-fg font-black py-4 rounded-xl hover:brightness-110 shadow-lg active:scale-95 transition-all text-sm"
                        >
                            تأكيد الخطة
                        </button>
                    </div>
                </Modal>
            )}

            {/* Barcode Scanner Overlay */}
            {isScannerOpen && (
                <BarcodeScannerOverlay onClose={onCloseScannerModal} onScan={onScan} continuous={true} />
            )}

            {/* Product Not Found Confirm Modal */}
            <ConfirmModal
                isOpen={confirmState.open}
                title="منتج غير موجود"
                message={`المنتج (${confirmState.barcode}) غير موجود في النظام. هل تريد إضافته بسرعة؟`}
                type="warning"
                confirmText="إضافة المنتج"
                cancelText="إلغاء"
                onConfirm={onConfirmAddProduct}
                onCancel={onCancelConfirm}
            />

            {/* Invoice QR Lookup Modal */}
            {scannedInvoice && (
                <Modal title={`فاتورة #${scannedInvoice.id}`} onClose={onCloseScannedInvoice} size="md">
                    <div className="space-y-4">
                        {/* Invoice Header */}
                        <div className="flex justify-between items-start p-4 bg-bg rounded-xl border border-border">
                            <div>
                                <p className="text-text-muted text-xs">العميل</p>
                                <p className="text-text-main font-bold">{scannedInvoice.customer || 'زبون عام'}</p>
                            </div>
                            <div className="text-left">
                                <p className="text-text-muted text-xs">التاريخ</p>
                                <p className="text-text-main font-bold font-mono">{scannedInvoice.date}</p>
                            </div>
                        </div>

                        {/* Items */}
                        <div className="bg-bg rounded-xl border border-border p-3 max-h-48 overflow-y-auto custom-scrollbar">
                            <p className="text-xs text-text-muted font-bold mb-2">المنتجات ({scannedInvoice.itemsCount})</p>
                            {scannedInvoice.items?.map((item, i) => (
                                <div key={i} className="flex justify-between py-1.5 border-b border-border last:border-0">
                                    <span className="text-text-main text-sm">{item.name} × {item.qty}</span>
                                    <span className="text-text-main font-mono font-bold text-sm">
                                        {formatCurrency(item.total || (item.price * item.qty), prefs.currency)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Total */}
                        <div className="flex justify-between items-center p-4 bg-primary/10 rounded-xl border border-primary/30">
                            <span className="text-primary font-bold">الإجمالي</span>
                            <span className="text-primary font-black text-xl font-mono">
                                {formatCurrency(scannedInvoice.total, prefs.currency)}
                            </span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex justify-center">
                            <span className={`px-4 py-2 rounded-full text-xs font-bold ${scannedInvoice.status === 'completed' ? 'bg-emerald-500/20 text-emerald-500' :
                                scannedInvoice.status === 'returned' ? 'bg-red-500/20 text-red-500' :
                                    'bg-amber-500/20 text-amber-500'
                                }`}>
                                {scannedInvoice.status === 'completed' ? '✓ مكتملة' :
                                    scannedInvoice.status === 'returned' ? '↩ مرتجعة' : '⏳ معلقة'}
                            </span>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                                onClick={() => {
                                    onPrintInvoice(scannedInvoice);
                                    notify('جاري الطباعة...', 'success');
                                }}
                                className="bg-surface border border-border text-text-main py-3 rounded-xl font-bold hover:bg-surface-hover transition-all flex items-center justify-center gap-2"
                            >
                                🖨️ طباعة
                            </button>
                            {scannedInvoice.status !== 'returned' && (
                                <button
                                    onClick={async () => {
                                        try {
                                            await api.sales.return(scannedInvoice.id);
                                            notify('تم إرجاع الفاتورة بنجاح', 'success');
                                            onCloseScannedInvoice();
                                        } catch {
                                            notify('فشل إرجاع الفاتورة', 'error');
                                        }
                                    }}
                                    className="bg-red-500/10 border border-red-500/30 text-red-500 py-3 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                >
                                    ↩ إرجاع
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* Parked Sales Modal */}
            {showParkedModal && (
                <Modal title="الفواتير المعلقة" onClose={onCloseParkedModal} size="md">
                    <div className="space-y-3 max-h-96 overflow-auto">
                        {parkedSales.length === 0 ? (
                            <div className="text-center text-text-muted py-8">
                                <History size={48} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">لا توجد فواتير معلقة</p>
                            </div>
                        ) : (
                            parkedSales.map(parked => (
                                <div
                                    key={parked.id}
                                    className="bg-input-bg rounded-xl p-4 flex items-center justify-between hover:bg-surface-hover transition-colors border border-border"
                                >
                                    <div>
                                        <div className="font-bold text-text-main">
                                            {parked.customer_name || 'عميل عام'}
                                        </div>
                                        <div className="text-xs text-text-muted flex gap-3 mt-1">
                                            <span>{parked.items_count} منتجات</span>
                                            <span>•</span>
                                            <span>{formatCurrency(parked.total, prefs.currency)}</span>
                                        </div>
                                        <div className="text-[10px] text-text-muted mt-1">
                                            {new Date(parked.created_at * 1000).toLocaleString('ar')}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onRetrieveSale(parked)}
                                        className="px-4 py-2 bg-primary text-primary-fg rounded-lg font-bold text-xs hover:brightness-110 flex items-center gap-2"
                                    >
                                        <PlayCircle size={16} />
                                        استرجاع
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </Modal>
            )}

            {/* Print Portal - Only for A4 mode */}
            {shouldShowPrintPortal && (
                <PrintPortal onAfterPrint={onAfterPrint}>
                    <ReceiptTemplate sale={lastSaleForPrint} prefs={prefs} mode={(prefs.autoPrintFormat || 'a4') as 'thermal' | 'a4'} />
                </PrintPortal>
            )}

            {/* Hidden container for silent thermal bitmap capture */}
            {shouldShowSilentCapture && (
                <div
                    style={{
                        position: 'fixed',
                        left: '-9999px',
                        top: 0,
                        opacity: 0,
                        pointerEvents: 'none',
                        zIndex: -1
                    }}
                >
                    <div ref={silentPrintRef} style={{ background: 'white' }}>
                        <ReceiptTemplate sale={lastSaleForPrint} prefs={prefs} mode="thermal" />
                    </div>
                </div>
            )}
        </>
    );
};
