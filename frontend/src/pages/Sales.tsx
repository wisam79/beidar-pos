
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, ScanLine, User, Clock } from 'lucide-react';
import { formatCurrency, generateId, playBeep, triggerConfetti } from '../core/utils';
import { logger } from '../core/logger';
import { EmptyState, Modal } from '../components/ui';
import { ScanResult } from '../components/BarcodeScannerOverlay';
import { Numpad } from '../components/Numpad';
import { CartItemRow as Row } from '../components/CartItemRow';
import { VirtualProductGrid } from '../components/VirtualProductGrid';
import { api, ParkedSaleDB, type ModelSale } from '../core/api';
import { Product, Sale, CartItem, AppPreferences, NotifyFunction } from '../core/types';
import { useInvalidateProducts, useProducts, useCustomers, useParkedSales, useUsbScannerDetection, useCart } from '../hooks';
import { SalesModals, CartPanel, SalesHeader, CheckoutExtras } from '../components/sales';
import { ReceiptTemplate } from '../components/ReceiptTemplate';
import { toBlob } from 'html-to-image';
import { ShiftManager } from '../components/ShiftManager';
import { Shift } from '../core/types';
import { useAuth } from '../core/AuthContext';

// Props interface for type safety
interface SalesPageProps {
    prefs: AppPreferences;
    notify: NotifyFunction;
}


export const SalesPage: React.FC<SalesPageProps> = ({ prefs, notify }) => {
    // i18n translation hook
    const { t } = useTranslation();

    // Auth context - get current staff for shift management
    const { currentUser } = useAuth();

    // React Query cache invalidation
    const invalidateProducts = useInvalidateProducts();

    // ═══════════════════════════════════════════════════════════════════════════════
    // 🛒 Cart State - Using extracted useCart hook for cleaner code
    // ═══════════════════════════════════════════════════════════════════════════════
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
        itemsCount,
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
    const [isWholesale, setIsWholesale] = useState(false); // Wholesale Mode State
    // Payment method & Zen Mode now handled by useCart persistence
    const [isProcessing, setIsProcessing] = useState(false);

    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [showInstallmentModal, setShowInstallmentModal] = useState(false);
    const [showParkedModal, setShowParkedModal] = useState(false);
    const [showQuickAddModal, setShowQuickAddModal] = useState(false);
    const [newProductBarcode, setNewProductBarcode] = useState('');

    // Qty Edit Modal State
    const [qtyEditState, setQtyEditState] = useState<{ open: boolean; item: CartItem | null; val: number }>({ open: false, item: null, val: 0 });

    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const [instConfig, setInstConfig] = useState({ downPayment: 0, months: 3 });

    const [quickForm, setQuickForm] = useState({ name: '', price: 0 });

    // Auto-Print State
    const [lastSaleForPrint, setLastSaleForPrint] = useState<Sale | null>(null);
    const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

    // Confirm modal state for product not found
    const [confirmState, setConfirmState] = useState<{ open: boolean; barcode: string }>({ open: false, barcode: '' });

    // Invoice QR Lookup State
    const [scannedInvoice, setScannedInvoice] = useState<Sale | null>(null);
    const [, setIsLoadingInvoice] = useState(false);

    const searchRef = useRef<HTMLInputElement>(null);
    const cartEndRef = useRef<HTMLDivElement>(null);

    // Shift Management State
    const [activeShift, setActiveShift] = useState<Shift | null>(null);
    const [showShiftPanel, setShowShiftPanel] = useState(false);

    // WhatsApp Image Generation State
    const [whatsappSale, setWhatsappSale] = useState<Sale | null>(null);
    const whatsappReceiptRef = useRef<HTMLDivElement>(null);

    // ═══════════════════════════════════════════════════════════════════════════════
    // 🔄 Data Fetching with React Query (cached & optimized)
    // ═══════════════════════════════════════════════════════════════════════════════

    // Products - cached and filtered client-side
    const { products, filteredProducts, categories } = useProducts({
        search: searchQuery,
        category: selectedCategory,
    });

    // Customers - cached
    const { customers } = useCustomers();

    // Parked Sales - with mutations
    const {
        parkedSales,
        parkedCount,
        parkSale: parkSaleAPI,
        retrieveSale: retrieveSaleAPI,
    } = useParkedSales();

    // Focus search input on mount
    useEffect(() => {
        searchRef.current?.focus();
    }, []);

    // Scroll to newly added cart item
    useEffect(() => {
        if (justAddedId) cartEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [cart.length, justAddedId]);

    // Wrapper for addToCart to handle search clearing AND Wholesale Pricing
    const addToCart = useCallback((p: Product) => {
        // Apply Wholesale Price if active
        const priceToUse = isWholesale ? (p.wholesalePrice || p.price) : p.price;
        // Optimization: Create a copy directly instead of mutating product which might be cached
        const productToAdd = { ...p, price: priceToUse };

        addToCartHook(productToAdd, isScannerOpen);
        setTimeout(() => { setSearchQuery(''); searchRef.current?.focus(); }, 10);
    }, [isScannerOpen, addToCartHook, isWholesale]); // Added isWholesale dependency

    // Re-calculate cart prices when toggling wholesale mode
    useEffect(() => {
        if (!cart.length) return;

        // This is a bit heavy, strictly speaking we should modify the cart in place or batch update.
        // For now, we iterate and update.
        const updatedCart = cart.map(item => {
            // Find original product to get prices
            const original = products.find(p => p.id === item.id);
            if (!original) return item;

            const newPrice = isWholesale ? (original.wholesalePrice || original.price) : original.price;
            if (newPrice !== item.price) {
                return { ...item, price: newPrice };
            }
            return item;
        });

        // Only update if changed (simple check)
        const hasChanges = updatedCart.some((item, i) => item.price !== cart[i].price);
        if (hasChanges) {
            setCart(updatedCart);
            notify(isWholesale ? 'تم تفعيل أسعار الجملة' : 'تم تفعيل أسعار المفرد', 'info');
        }
    }, [isWholesale, products]); // Intentionally not adding 'cart' to avoid loops, only when mode changes

    // Alias for consistent naming in the template
    const remove = removeFromCart;

    const handleCheckout = async (extras?: Partial<Sale>) => {
        if (!cart.length || isProcessing) return;
        setIsProcessing(true);

        const sale: Sale = {
            id: `INV-${generateId()}`,
            customer: selectedCustomer?.name || 'Guest',
            customerId: selectedCustomer?.id,
            staffId: currentUser?.id || '',
            staffName: currentUser?.name || '',
            date: new Date().toISOString().split('T')[0],
            timestamp: Date.now(),
            subtotal, discount, vat: 0, total,
            paymentMethod,
            status: paymentMethod === 'credit' ? 'pending' : 'completed',
            itemsCount: cart.reduce((a, b) => a + b.qty, 0),
            items: cart.map(i => ({
                pid: 0,
                id: i.id, // Product ID string
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
            // 🔧 Type cast required: Frontend Sale type has structural differences from Wails-generated backend.Sale
            await api.sales.process(sale as unknown as ModelSale);
            setCart([]); setDiscount(0); setSelectedCustomer(null); setPaymentMethod('cash'); setShowSplitModal(false); setShowInstallmentModal(false);
            setReceivedAmount(0);
            triggerConfetti(); notify('تم البيع بنجاح', 'success');

            // Auto Print Logic
            if (prefs.autoPrint) {
                setLastSaleForPrint(sale as Sale);
                // PrintPortal now handles the print and cleanup via onAfterPrint
            }

            // Refresh products cache after sale
            invalidateProducts();

            setLastCompletedSale(sale as Sale);
            setTimeout(() => searchRef.current?.focus(), 100);
        } catch (e: unknown) {
            // Extract meaningful error message from backend
            const errMsg = (e as { message?: string })?.message ||
                (typeof e === 'string' ? e : 'حدث خطأ أثناء المعالجة');
            notify(errMsg, 'error');

            // Auto-open shift panel if error is related to missing shift
            if (errMsg.includes('شفت') || errMsg.includes('Shift')) {
                setShowShiftPanel(true);
            }

            logger.error('Sale processing error', e, 'Sales');
        } finally {
            setIsProcessing(false);
        }
    };


    // ═══════════════════════════════════════════════════════════════════════════════
    // ⏸️ Parked Sales - Using React Query hooks
    // ═══════════════════════════════════════════════════════════════════════════════

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
        // Wails API usually requires a full struct.
        const newProduct: Product = {
            id: Math.floor(Date.now() / 1000).toString(),
            name: quickForm.name,
            price: Number(quickForm.price),
            barcode: newProductBarcode || Math.floor(Date.now() / 1000).toString(),
            cost: 0, stock: 1, minStock: 5, wholesalePrice: 0, category: 'عام', image: '📦'
        };

        try {
            await api.products.save(newProduct);
            // Invalidate products cache to refresh the list
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
        // 1️⃣ Check if this is an invoice QR code (format: INV:XXXXXX|T:XXXXX|D:XXXX)
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

        // 2️⃣ Otherwise, search as product barcode
        const found = products.find(p => p.barcode === code);
        if (found) {
            addToCart(found);
            return { success: true, name: found.name };
        }
        // Show styled confirm modal for product not found
        setConfirmState({ open: true, barcode: code });
        // Return success so mobile app doesn't show red error, but inform user to check desktop
        return { success: true, message: 'المنتج غير موجود - أكمل الإضافة على الكمبيوتر' };
    };

    const handleConfirmAddProduct = () => {
        setNewProductBarcode(confirmState.barcode);
        setShowQuickAddModal(true);
        setConfirmState({ open: false, barcode: '' });
    };

    // USB Scanner Detection - replaces useScanDetection
    const { isUsbDetected, scanCount, resetDetection } = useUsbScannerDetection({
        onScan: handleScan,
        onUsbDetected: () => {
            notify('تم اكتشاف قارئ الباركود USB ✅', 'success');
        }
    });

    const handleQuickCash = (amount: number) => { setReceivedAmount(amount); playBeep('success'); };

    // ═══════════════════════════════════════════════════════════════════════════════
    // 📱 Mobile Scanner Integration (Refactored for Fresh State Access)
    // ═══════════════════════════════════════════════════════════════════════════════

    // Use a ref for handleScan to ensure the event listener always accesses the latest version
    // of handleScan and its dependencies (products, isWholesale, etc.)
    const handleScanRef = useRef(handleScan);
    useEffect(() => { handleScanRef.current = handleScan; }, [handleScan]);

    useEffect(() => {
        if (window.runtime) {
            // New typed definition makes this valid
            window.runtime.EventsOff("remote-scan-received"); // Clean start

            // New typed definition makes this valid
            window.runtime.EventsOn("remote-scan-received", (data: unknown) => {
                const code = (data as { code?: string }).code;
                // Remote scan debug - uses logger (not shown in production)
                logger.debug('📡 Remote scan received:', code, 'RemoteScan');

                if (code) {
                    // Use the ref to call the latest handleScan
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
    }, []); // Empty dependency array ensures listener is attached only ONCE per mount
    // The magic is in handleScanRef which updates whenever dependencies change.

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

        // 1. Set the sale to be rendered in the hidden div
        setWhatsappSale(sale);

        // 2. Wait a tick for React to render the template
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            if (!whatsappReceiptRef.current) throw new Error("Receipt element not found");

            // 3. Generate Image Blob
            const blob = await toBlob(whatsappReceiptRef.current, { backgroundColor: '#fff', quality: 0.95 });

            if (!blob) throw new Error("Failed to generate image");

            // 4. Copy to Clipboard
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);

            notify("تم نسخ الفاتورة كصورة! ألصقها في واتساب (Ctrl+V)", "success");
            playBeep('success');

            // 5. Open WhatsApp
            const phone = sale.customer === 'Guest' ? '' : customers.find(c => c.id === sale.customerId)?.phone || '';
            // We use a small delay to ensure the clipboard write is finished
            setTimeout(() => {
                window.open(`https://api.whatsapp.com/send?phone=${phone}`, '_blank');
            }, 500);

        } catch (error) {
            logger.error('WhatsApp generation error', error, 'Sales');
            notify("فشل إنشاء صورة الفاتورة (تأكد من دعم المتصفح)", "error");
        } finally {
            // Optional: Clear after a delay, or keep it. Keeping it is fine.
            // setWhatsappSale(null); 
        }
    };

    return (
        <div className={`flex h-full animate-in fade-in page-enter relative overflow-hidden ${isZenMode ? 'p-0' : ''}`}>

            {/* LEFT COLUMN: Header + Products Grid */}
            {!isZenMode && (
                <div className="flex-1 flex flex-col min-h-0 p-2">
                    {/* Header - Above products */}
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

                    {/* Products Grid - Scrollable */}
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

            {/* Cart Panel - Responsive width for better space utilization */}
            <div className={`flex flex-col bg-surface border-l border-border h-full transition-all duration-300 ${isZenMode ? 'w-full rounded-none shadow-none' : 'w-[380px] lg:w-[420px] xl:w-[480px] 2xl:w-[520px] rounded-l-2xl shadow-2xl overflow-hidden'}`}>
                {/* Shift Manager - Compact bar at top of cart panel */}
                {!isZenMode && (
                    <div className={`border-b transition-all shrink-0 ${activeShift ? 'bg-green-500/5 border-green-500/20' : 'bg-bg/30 border-border'}`}>
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
                {/* Zen Mode Toolbar - Only in Zen Mode */}
                {isZenMode && (
                    <div className="p-4 border-b border-border bg-bg/50 flex items-center gap-3 shrink-0">
                        <div className="relative flex-1">
                            <input
                                ref={searchRef}
                                className="w-full bg-input-bg text-text-main border border-border rounded-xl pl-12 pr-4 py-3.5 outline-none focus:border-primary transition-all text-base font-bold placeholder:text-text-muted focus:shadow-glow touch-target"
                                placeholder="ابحث أو امسح الباركود..."
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value);
                                    // Auto-add if barcode found
                                    const found = products.find(p => p.barcode === e.target.value);
                                    if (found) {
                                        addToCart(found);
                                        setSearchQuery('');
                                    }
                                }}
                            />
                            <Search className="absolute left-4 top-3.5 text-text-muted opacity-70" size={20} />
                        </div>
                        <button onClick={() => setIsScannerOpen(true)} className="p-3.5 bg-purple-500/10 border border-purple-500/20 text-purple-500 rounded-xl hover:bg-purple-500 hover:text-white transition-all btn-press touch-target" title="ماسح الباركود" aria-label="ماسح الباركود">
                            <ScanLine size={22} />
                        </button>
                        <button onClick={() => setShowCustomerModal(true)} className={`p-3.5 rounded-xl border transition-all btn-press touch-target ${selectedCustomer ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface text-text-muted border-border hover:text-text-main'}`} title="اختر العميل" aria-label="اختر العميل">
                            <User size={22} />
                        </button>
                    </div>
                )}


                {/* Cart - Extracted to CartPanel component */}
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


            {/* Modals - Extracted to SalesModals component */}
            <SalesModals
                // Modal visibility states
                showCustomerModal={showCustomerModal}
                showParkedModal={showParkedModal}
                showQuickAddModal={showQuickAddModal}
                showSplitModal={showSplitModal}
                showInstallmentModal={showInstallmentModal}
                isScannerOpen={isScannerOpen}

                // Modal close handlers
                onCloseCustomerModal={() => setShowCustomerModal(false)}
                onCloseParkedModal={() => setShowParkedModal(false)}
                onCloseQuickAddModal={() => setShowQuickAddModal(false)}
                onCloseSplitModal={() => setShowSplitModal(false)}
                onCloseInstallmentModal={() => setShowInstallmentModal(false)}
                onCloseScannerModal={() => setIsScannerOpen(false)}

                // Data
                customers={customers}
                parkedSales={parkedSales}
                prefs={prefs}
                total={total}

                // Quick Add Form
                quickForm={quickForm}
                setQuickForm={setQuickForm}
                newProductBarcode={newProductBarcode}
                onQuickAdd={handleQuickAdd}

                // Installment Config
                instConfig={instConfig}
                setInstConfig={setInstConfig}
                onInstallmentConfirm={handleInstallmentConfirm}

                // Callbacks
                onSelectCustomer={setSelectedCustomer}
                onRetrieveSale={handleRetrieveSale}
                onCheckout={handleCheckout}
                onScan={handleScan}

                // Confirm Modal
                confirmState={confirmState}
                onConfirmAddProduct={handleConfirmAddProduct}
                onCancelConfirm={() => setConfirmState({ open: false, barcode: '' })}

                // Invoice QR Lookup
                scannedInvoice={scannedInvoice}
                onCloseScannedInvoice={() => setScannedInvoice(null)}
                onPrintInvoice={setLastSaleForPrint}
                notify={notify}

                // Auto Print
                lastSaleForPrint={lastSaleForPrint}
                onAfterPrint={() => setLastSaleForPrint(null)}
            />

            {/* Qty Edit Modal */}
            {qtyEditState.open && (
                <Modal title="تعديل الكمية" onClose={() => setQtyEditState({ open: false, item: null, val: 0 })} size="sm">
                    <div className="p-1">
                        <Numpad
                            value={qtyEditState.val}
                            onChange={(v) => setQtyEditState(prev => ({ ...prev, val: v }))}
                            onConfirm={() => {
                                if (qtyEditState.item && qtyEditState.val > 0) {
                                    // Calculate delta
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
            {/* Hidden Off-screen Receipt for Image Generation */}
            <div className="absolute top-0 left-[-9999px] opacity-0 pointer-events-none">
                <div ref={whatsappReceiptRef} className="w-[80mm] bg-white text-black p-2">
                    {whatsappSale && (
                        <ReceiptTemplate sale={whatsappSale} prefs={prefs} mode="thermal" />
                    )}
                </div>
            </div>
        </div >

    );
};
