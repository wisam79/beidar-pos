import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ScanLine, User, Clock } from 'lucide-react';
import { formatCurrency, generateId, getLocalDateString, playBeep, triggerConfetti } from '../../../core/utils';
import { logger } from '../../../core/logger';
import { Modal } from '../../../components/ui';
import { ScanResult } from '../../../components/BarcodeScannerOverlay';
import { Numpad } from '../components/Numpad';
import { api, ParkedSaleDB, type ModelSale } from '../../../core/api';
import { Product, Sale, CartItem } from '../../../core/types';
import { useInvalidateProducts, useProducts, useCustomers, useParkedSales, useUsbScannerDetection } from '../../../hooks';
import { useCart } from '../hooks/useCart';
import { usePreferences } from '../../../components/PreferencesContext';
import { SalesModals, CartPanel, SalesHeader } from '../components/sales';
import { ReceiptTemplate } from '../../../components/ReceiptTemplate';
import { ShiftManager } from '../../../components/ShiftManager';
import { Shift } from '../../../core/types';
import { useAuth } from '../../../core/AuthContext';
import { VirtualProductGrid } from '../components/VirtualProductGrid';

export const SalesPage: React.FC = () => {
    const { prefs, notify } = usePreferences();
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const invalidateProducts = useInvalidateProducts();

    const {
        cart,
        setCart,
        selectedCustomer,
        setSelectedCustomer,
        discount,
        setDiscount,
        receivedAmount,
        setReceivedAmount,
        paymentMethod,
        setPaymentMethod,
        subtotal,
        total,
        change,
        addToCart: addToCartHook,
        updateQty,
        removeFromCart,
        clearCart,
        justAddedId,
        isZenMode,
        setIsZenMode,
    } = useCart({
        onCartRestored: () => notify('تم استعادة السلة المحفوظة', 'info'),
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('الكل');
    const [isWholesale, setIsWholesale] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [showInstallmentModal, setShowInstallmentModal] = useState(false);
    const [showParkedModal, setShowParkedModal] = useState(false);
    const [showQuickAddModal, setShowQuickAddModal] = useState(false);
    const [newProductBarcode, setNewProductBarcode] = useState('');

    const [qtyEditState, setQtyEditState] = useState<{ open: boolean; item: CartItem | null; val: number }>({ open: false, item: null, val: 0 });
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [instConfig, setInstConfig] = useState({ downPayment: 0, months: 3 });
    const [quickForm, setQuickForm] = useState({ name: '', price: 0 });

    const [lastSaleForPrint, setLastSaleForPrint] = useState<Sale | null>(null);
    const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
    const [confirmState, setConfirmState] = useState<{ open: boolean; barcode: string }>({ open: false, barcode: '' });
    const [scannedInvoice, setScannedInvoice] = useState<Sale | null>(null);
    const [, setIsLoadingInvoice] = useState(false);

    const searchRef = useRef<HTMLInputElement>(null);
    const cartEndRef = useRef<HTMLDivElement>(null);

    const [activeShift, setActiveShift] = useState<Shift | null>(null);
    const [showShiftPanel, setShowShiftPanel] = useState(false);

    const [whatsappSale, setWhatsappSale] = useState<Sale | null>(null);
    const whatsappReceiptRef = useRef<HTMLDivElement>(null);

    const { products, filteredProducts, categories } = useProducts({
        search: searchQuery,
        category: selectedCategory,
    });

    const { customers } = useCustomers();

    const {
        parkedSales,
        parkedCount,
        parkSale: parkSaleAPI,
        retrieveSale: retrieveSaleAPI,
    } = useParkedSales();

    useEffect(() => {
        searchRef.current?.focus();
    }, []);

    useEffect(() => {
        if (justAddedId) cartEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [cart.length, justAddedId]);

    const addToCart = useCallback((p: Product) => {
        const priceToUse = isWholesale ? (p.wholesalePrice || p.price) : p.price;
        const productToAdd = { ...p, price: priceToUse };

        addToCartHook(productToAdd, isScannerOpen);
        setTimeout(() => { setSearchQuery(''); searchRef.current?.focus(); }, 10);
    }, [isScannerOpen, addToCartHook, isWholesale]);

    useEffect(() => {
        if (!cart.length) return;

        const updatedCart = cart.map(item => {
            const original = products.find(p => p.id === item.id);
            if (!original) return item;

            const newPrice = isWholesale ? (original.wholesalePrice || original.price) : original.price;
            if (newPrice !== item.price) {
                return { ...item, price: newPrice };
            }
            return item;
        });

        const hasChanges = updatedCart.some((item, i) => item.price !== cart[i].price);
        if (hasChanges) {
            setCart(updatedCart);
            notify(isWholesale ? 'تم تفعيل أسعار الجملة' : 'تم تفعيل أسعار المفرد', 'info');
        }
    }, [isWholesale, products]);

    const remove = removeFromCart;

    const handleCheckout = async (extras?: Partial<Sale>) => {
        if (!cart.length || isProcessing) return;
        setIsProcessing(true);

        const sale: Sale = {
            id: `INV-${generateId()}`,
            customer: selectedCustomer?.name || 'زبون عام',
            customerId: selectedCustomer?.id,
            staffId: currentUser?.id || '',
            staffName: currentUser?.name || '',
            date: getLocalDateString(),
            timestamp: Date.now(),
            subtotal, discount, vat: 0, total,
            paymentMethod,
            status: paymentMethod === 'credit' ? 'pending' : 'completed',
            itemsCount: cart.reduce((a, b) => a + b.qty, 0),
            items: cart.map(i => ({
                pid: 0,
                id: i.id,
                name: i.name,
                qty: i.qty,
                price: i.price,
                cost: i.cost,
                discount: i.itemDiscount || 0,
                total: (i.price * i.qty) - (i.itemDiscount || 0),
                returnedQty: 0
            })),
            ...extras
        };

        try {
            await api.sales.process(sale as unknown as ModelSale);
            setCart([]); setDiscount(0); setSelectedCustomer(null); setPaymentMethod('cash'); setShowSplitModal(false); setShowInstallmentModal(false);
            setReceivedAmount(0);
            triggerConfetti(); notify('تم البيع بنجاح', 'success');

            if (prefs.autoPrint) {
                setLastSaleForPrint(sale as Sale);
            }

            invalidateProducts();
            setLastCompletedSale(sale as Sale);
            setTimeout(() => searchRef.current?.focus(), 100);
        } catch (e: unknown) {
            const errMsg = (e as { message?: string })?.message ||
                (typeof e === 'string' ? e : 'حدث خطأ أثناء المعالجة');
            notify(errMsg, 'error');

            if (errMsg.includes('شفت') || errMsg.includes('Shift')) {
                setShowShiftPanel(true);
            }

            logger.error('Sale processing error', e, 'Sales');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleParkSale = async () => {
        if (!cart.length) {
            notify('السلة فارغة', 'info');
            return;
        }
        try {
            await parkSaleAPI({
                cart,
                customer: selectedCustomer,
                total,
            });
            notify('تم تعليق الفاتورة', 'success');
            setCart([]);
            setSelectedCustomer(null);
            setDiscount(0);
        } catch (_e) {
            notify('فشل تعليق الفاتورة', 'error');
        }
    };

    const handleRetrieveSale = async (parked: ParkedSaleDB) => {
        try {
            const retrieved = await retrieveSaleAPI(parked.id);
            const items: CartItem[] = JSON.parse(retrieved.items_json);
            setCart(items);
            if (retrieved.customer_id) {
                const cust = customers.find(c => c.id === retrieved.customer_id);
                if (cust) setSelectedCustomer(cust);
            }
            setShowParkedModal(false);
            notify('تم استرجاع الفاتورة', 'success');
        } catch (_e) {
            notify('فشل استرجاع الفاتورة', 'error');
        }
    };

    const openParkedModal = useCallback(() => {
        setShowParkedModal(true);
    }, []);

    const handleQuickAdd = async () => {
        if (!quickForm.name || !quickForm.price) return;
        const newProduct: Product = {
            id: Math.floor(Date.now() / 1000).toString(),
            name: quickForm.name,
            price: Number(quickForm.price),
            barcode: newProductBarcode || Math.floor(Date.now() / 1000).toString(),
            cost: 0, stock: 1, minStock: 5, wholesalePrice: 0, category: 'عام', image: '📦'
        };

        try {
            await api.products.save(newProduct);
            invalidateProducts();
            addToCart(newProduct);

            setShowQuickAddModal(false);
            setQuickForm({ name: '', price: 0 });
            notify('تم إضافة المنتج وبيعه', 'success');
        } catch (_e) {
            notify('فشل إضافة المنتج', 'error');
        }
    };

    const handleScan = async (code: string): Promise<ScanResult> => {
        if (code.startsWith('INV:')) {
            const invoiceId = code.split('|')[0].replace('INV:', '');
            setIsLoadingInvoice(true);
            try {
                const sale = await api.sales.get(invoiceId);
                if (sale) {
                    setScannedInvoice(sale);
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
            } finally {
                setIsLoadingInvoice(false);
            }
        }

        const found = products.find(p => p.barcode === code);
        if (found) {
            addToCart(found);
            return { success: true, name: found.name };
        }
        setConfirmState({ open: true, barcode: code });
        return { success: true, message: 'المنتج غير موجود - أكمل الإضافة على الكمبيوتر' };
    };

    const handleConfirmAddProduct = () => {
        setNewProductBarcode(confirmState.barcode);
        setShowQuickAddModal(true);
        setConfirmState({ open: false, barcode: '' });
    };

    const { isUsbDetected, scanCount } = useUsbScannerDetection({
        onScan: handleScan,
        onUsbDetected: () => {
            notify('تم اكتشاف قارئ الباركود USB ✅', 'success');
        }
    });

    const handleQuickCash = (amount: number) => { setReceivedAmount(amount); playBeep('success'); };

    const handleScanRef = useRef(handleScan);
    useEffect(() => { handleScanRef.current = handleScan; }, [handleScan]);

    useEffect(() => {
        if (window.runtime) {
            window.runtime.EventsOff("remote-scan-received");

            window.runtime.EventsOn("remote-scan-received", (data: unknown) => {
                const code = (data as { code?: string }).code;
                logger.debug('📡 Remote scan received:', code, 'RemoteScan');

                if (code) {
                    handleScanRef.current(code).then(result => {
                        if (result.success) {
                            playBeep('success');
                            notify(`تم مسح: ${result.name}`, 'success');
                        } else {
                            playBeep('error');
                            notify(result.message || 'مسح غير معروف', 'error');
                        }
                    }).catch(err => {
                        logger.error('Scan processing error', err, 'RemoteScan');
                        playBeep('error');
                        notify('خطأ في معالجة المسح', 'error');
                    });
                }
            });
        }
        return () => {
            if (window.runtime) window.runtime.EventsOff("remote-scan-received");
        };
    }, []);

    const handleInstallmentConfirm = async () => {
        try {
            const plan = await window.go.main.App.CalculateInstallmentPlan(total, instConfig.downPayment, instConfig.months);

            handleCheckout({
                paymentMethod: 'installment',
                status: 'pending',
                installmentPlan: plan
            });
        } catch (error) {
            notify('فشل حساب الأقساط', 'error');
            logger.error('Installment plan calculation failed', error, 'Sales');
        }
    };

    const sendToWhatsapp = async (sale: Sale) => {
        if (!sale) return;
        setWhatsappSale(sale);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            if (!whatsappReceiptRef.current) throw new Error("Receipt element not found");
            const { toBlob } = await import('html-to-image');
            const blob = await toBlob(whatsappReceiptRef.current, { backgroundColor: '#fff', quality: 0.95 });
            if (!blob) throw new Error("Failed to generate image");

            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);

            notify("تم نسخ الفاتورة كصورة! ألصقها في واتساب (Ctrl+V)", "success");
            playBeep('success');

            const phone = sale.customer === 'زبون عام' ? '' : customers.find(c => c.id === sale.customerId)?.phone || '';
            setTimeout(() => {
                window.open(`https://api.whatsapp.com/send?phone=${phone}`, '_blank');
            }, 500);

        } catch (error) {
            logger.error('WhatsApp generation error', error, 'Sales');
            notify("فشل إنشاء صورة الفاتورة (تأكد من دعم المتصفح)", "error");
        }
    };

    return (
        <div className={`flex h-full gap-2 animate-in fade-in page-enter relative overflow-hidden ${isZenMode ? 'p-0' : 'p-2'}`}>
            {!isZenMode && (
                <div className="flex min-w-0 flex-1 flex-col">
                    <SalesHeader
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        searchRef={searchRef}
                        products={products}
                        addToCart={addToCart}
                        categories={categories}
                        selectedCategory={selectedCategory}
                        setSelectedCategory={setSelectedCategory}
                        selectedCustomer={selectedCustomer}
                        setShowCustomerModal={setShowCustomerModal}
                        isUsbDetected={isUsbDetected}
                        scanCount={scanCount}
                        setIsScannerOpen={setIsScannerOpen}
                        isWholesale={isWholesale}
                        setIsWholesale={setIsWholesale}
                        parkedCount={parkedCount}
                        openParkedModal={openParkedModal}
                        handleParkSale={handleParkSale}
                        cartLength={cart.length}
                        lastCompletedSale={lastCompletedSale}
                        sendToWhatsapp={sendToWhatsapp}
                        t={t}
                    />

                    <div className="flex-1 min-h-0 mt-2">
                        <VirtualProductGrid
                            products={filteredProducts}
                            onProductClick={addToCart}
                            justAddedId={justAddedId}
                            onQuickAdd={() => setShowQuickAddModal(true)}
                            currency={prefs.currency}
                            isWholesale={isWholesale}
                        />
                    </div>
                </div>
            )}

            <div className={`flex flex-col bg-surface backdrop-blur-md border-l border-border h-full transition-all duration-300 ${isZenMode ? 'w-full rounded-none shadow-none' : 'w-[380px] lg:w-[420px] xl:w-[480px] 2xl:w-[520px] rounded-l-2xl shadow-2xl overflow-hidden'}`}>
                {!isZenMode && (
                    <div className={`border-b transition-all shrink-0 ${activeShift ? 'bg-green-500/5 border-green-500/20' : 'bg-black/5 dark:bg-white/[0.01] border-border'}`}>
                        <button
                            onClick={() => setShowShiftPanel(!showShiftPanel)}
                            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeShift ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-400'}`}>
                                    <Clock size={14} />
                                </div>
                                <span className="text-xs font-medium text-text-main">
                                    {activeShift ? `${activeShift.staffName} • ${formatCurrency(activeShift.expectedBalance, prefs.currency)}` : 'لا يوجد شفت'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {activeShift && (
                                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-500 text-[10px] rounded-full flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                        {activeShift.salesCount}
                                    </span>
                                )}
                                <svg className={`w-4 h-4 text-text-muted transition-transform ${showShiftPanel ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </button>
                        {showShiftPanel && (
                            <div className="p-2 bg-bg/20">
                                <ShiftManager
                                    staff={currentUser ? { id: currentUser.id, name: currentUser.name } : null}
                                    currency={prefs.currency}
                                    notify={notify}
                                    onShiftChange={setActiveShift}
                                />
                            </div>
                        )}
                    </div>
                )}
                {isZenMode && (
                    <div className="p-4 border-b border-border bg-black/5 dark:bg-white/[0.02] backdrop-blur-md flex items-center gap-3 shrink-0">
                        <div className="relative flex-1">
                            <input
                                ref={searchRef}
                                className="w-full bg-input-bg text-text-main border border-border rounded-full pl-12 pr-5 py-3.5 outline-none focus:border-primary transition-all text-base font-black placeholder:text-text-muted focus:shadow-[0_0_0_4px_rgba(var(--color-primary-rgb),0.15)] touch-target shadow-sm"
                                placeholder="ابحث أو امسح الباركود..."
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value);
                                    const found = products.find(p => p.barcode === e.target.value);
                                    if (found) {
                                        addToCart(found);
                                        setSearchQuery('');
                                    }
                                }}
                            />
                            <Search className="absolute left-4.5 top-4 text-text-muted opacity-70" size={20} />
                        </div>
                        <button onClick={() => setIsScannerOpen(true)} className="p-3.5 bg-purple-500/10 border border-purple-500/20 text-purple-500 rounded-full hover:bg-purple-500 hover:text-white transition-all btn-press touch-target shadow-sm" title="ماسح الباركود" aria-label="ماسح الباركود">
                            <ScanLine size={22} />
                        </button>
                        <button onClick={() => setShowCustomerModal(true)} className={`p-3.5 rounded-full border transition-all btn-press touch-target shadow-sm ${selectedCustomer ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface text-text-muted border-border hover:text-text-main'}`} title="اختر العميل" aria-label="اختر العميل">
                            <User size={22} />
                        </button>
                    </div>
                )}

                <CartPanel
                    cart={cart}
                    selectedCustomer={selectedCustomer}
                    prefs={prefs}
                    subtotal={subtotal}
                    total={total}
                    discount={discount}
                    receivedAmount={receivedAmount}
                    change={change}
                    paymentMethod={paymentMethod}
                    isProcessing={isProcessing}
                    isZenMode={isZenMode}
                    setDiscount={setDiscount}
                    setPaymentMethod={setPaymentMethod}
                    setIsZenMode={setIsZenMode}
                    setCart={setCart}
                    setReceivedAmount={setReceivedAmount}
                    updateQty={updateQty}
                    onQtyClick={(item) => setQtyEditState({ open: true, item, val: item.qty })}
                    removeFromCart={remove}
                    handleParkSale={handleParkSale}
                    handleQuickCash={handleQuickCash}
                    handleCheckout={() => handleCheckout()}
                    setShowSplitModal={setShowSplitModal}
                    setShowInstallmentModal={setShowInstallmentModal}
                    setInstConfig={setInstConfig}
                    cartEndRef={cartEndRef}
                    t={t}
                />
            </div>

            <SalesModals
                showCustomerModal={showCustomerModal}
                showParkedModal={showParkedModal}
                showQuickAddModal={showQuickAddModal}
                showSplitModal={showSplitModal}
                showInstallmentModal={showInstallmentModal}
                isScannerOpen={isScannerOpen}
                onCloseCustomerModal={() => setShowCustomerModal(false)}
                onCloseParkedModal={() => setShowParkedModal(false)}
                onCloseQuickAddModal={() => setShowQuickAddModal(false)}
                onCloseSplitModal={() => setShowSplitModal(false)}
                onCloseInstallmentModal={() => setShowInstallmentModal(false)}
                onCloseScannerModal={() => setIsScannerOpen(false)}
                customers={customers}
                parkedSales={parkedSales}
                prefs={prefs}
                total={total}
                quickForm={quickForm}
                setQuickForm={setQuickForm}
                newProductBarcode={newProductBarcode}
                onQuickAdd={handleQuickAdd}
                instConfig={instConfig}
                setInstConfig={setInstConfig}
                onInstallmentConfirm={handleInstallmentConfirm}
                onSelectCustomer={setSelectedCustomer}
                onRetrieveSale={handleRetrieveSale}
                onCheckout={handleCheckout}
                onScan={handleScan}
                confirmState={confirmState}
                onConfirmAddProduct={handleConfirmAddProduct}
                onCancelConfirm={() => setConfirmState({ open: false, barcode: '' })}
                scannedInvoice={scannedInvoice}
                onCloseScannedInvoice={() => setScannedInvoice(null)}
                onPrintInvoice={setLastSaleForPrint}
                notify={notify}
                lastSaleForPrint={lastSaleForPrint}
                onAfterPrint={() => setLastSaleForPrint(null)}
            />

            {qtyEditState.open && (
                <Modal title="تعديل الكمية" onClose={() => setQtyEditState({ open: false, item: null, val: 0 })} size="sm">
                    <div className="p-1">
                        <Numpad
                            value={qtyEditState.val}
                            onChange={(v) => setQtyEditState(prev => ({ ...prev, val: v }))}
                            onConfirm={() => {
                                if (qtyEditState.item && qtyEditState.val > 0) {
                                    const delta = qtyEditState.val - qtyEditState.item.qty;
                                    updateQty(qtyEditState.item.id, delta);
                                }
                                setQtyEditState({ open: false, item: null, val: 0 });
                            }}
                            mode="quantity"
                            productName={qtyEditState.item?.name}
                            maxQty={99999}
                        />
                    </div>
                </Modal>
            )}
            <div className="absolute top-0 left-[-9999px] opacity-0 pointer-events-none">
                <div ref={whatsappReceiptRef} className="w-[80mm] bg-white text-black p-2">
                    {whatsappSale && (
                        <ReceiptTemplate sale={whatsappSale} prefs={prefs} mode="thermal" />
                    )}
                </div>
            </div>
        </div>
    );
};
