import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ShoppingCart, PauseCircle, Maximize2, Minimize2, Trash2, Split, Calculator, Check, Loader2, Package } from 'lucide-react';
import { formatCurrency } from '../../../../core/utils';
import { CartItem, Customer, AppPreferences } from '../../../../core/types';
import { CartItemRow as Row } from '../CartItemRow';
import { Button } from '../../../../components/ds/Button';

export interface CartPanelProps {
    cart: CartItem[];
    selectedCustomer: Customer | null;
    prefs: AppPreferences;
    subtotal: number;
    total: number;
    discount: number;
    receivedAmount: number;
    change: number;
    paymentMethod: 'cash' | 'card' | 'credit' | 'split' | 'installment';
    isProcessing: boolean;
    isZenMode: boolean;
    setDiscount: (value: number) => void;
    setPaymentMethod: (method: 'cash' | 'card' | 'credit' | 'split' | 'installment') => void;
    setIsZenMode: (value: boolean) => void;
    setCart: (cart: CartItem[]) => void;
    setReceivedAmount: (value: number) => void;
    updateQty: (id: string, qty: number) => void;
    removeFromCart: (id: string) => void;
    handleParkSale: () => void;
    handleQuickCash: (amount: number) => void;
    handleCheckout: () => void;
    setShowSplitModal: (show: boolean) => void;
    setShowInstallmentModal: (show: boolean) => void;
    setInstConfig: (config: { downPayment: number; months: number }) => void;
    onQtyClick?: (item: CartItem) => void;
    cartEndRef: React.RefObject<HTMLDivElement>;
    t: (key: string) => string;
}

interface CartItemsListProps {
    cart: CartItem[];
    prefs: AppPreferences;
    updateQty: (id: string, qty: number) => void;
    removeFromCart: (id: string) => void;
    cartEndRef: React.RefObject<HTMLDivElement>;
    onQtyClick?: (item: CartItem) => void;
    isZenMode?: boolean;
}

const CartItemsList: React.FC<CartItemsListProps> = ({ cart, prefs, updateQty, removeFromCart, cartEndRef, onQtyClick, isZenMode }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: cart.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 88,
        overscan: 3,
        gap: 10,
    });

    if (cart.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-3 custom-scrollbar">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-hover">
                        <Package size={36} className="text-text-muted" />
                    </div>
                    <p className="mb-1 text-base font-bold text-text-muted">السلة فارغة</p>
                    <p className="text-sm text-text-muted/60">امسح الباركود أو اختر منتجاً</p>
                </div>
            </div>
        );
    }

    return (
        <div ref={parentRef} className={`flex-1 overflow-y-auto px-4 py-3 custom-scrollbar ${isZenMode ? 'max-w-4xl mx-auto w-full' : ''}`}>
            <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
                {virtualizer.getVirtualItems().map((virtualItem) => {
                    const item = cart[virtualItem.index];
                    return (
                        <div
                            key={item.id}
                            className="absolute left-0 top-0 w-full"
                            style={{ height: `${virtualItem.size}px`, transform: `translateY(${virtualItem.start}px)` }}
                        >
                            <Row
                                item={item}
                                onUpdateQty={updateQty}
                                onRemove={removeFromCart}
                                onEdit={() => { }}
                                onQtyClick={onQtyClick}
                                currency={prefs.currency}
                            />
                        </div>
                    );
                })}
            </div>
            <div ref={cartEndRef} />
        </div>
    );
};

export const CartPanel: React.FC<CartPanelProps> = ({
    cart,
    selectedCustomer,
    prefs,
    total,
    discount,
    receivedAmount,
    change,
    paymentMethod,
    isProcessing,
    isZenMode,
    setDiscount,
    setPaymentMethod,
    setIsZenMode,
    setCart,
    setReceivedAmount,
    updateQty,
    removeFromCart,
    handleParkSale,
    handleQuickCash,
    handleCheckout,
    setShowSplitModal,
    setShowInstallmentModal,
    setInstConfig,
    onQtyClick,
    cartEndRef,
    t,
}) => {
    const smartAmounts = useMemo(() => {
        if (total <= 0) return [5000, 10000, 25000, 50000];
        const roundUp = (n: number, to: number) => Math.ceil(n / to) * to;
        const amounts = [total];
        [5000, 10000, 25000, 50000].forEach((step) => {
            const amount = roundUp(total, step);
            if (amount > total && !amounts.includes(amount) && amounts.length < 4) amounts.push(amount);
        });
        return amounts.slice(0, 4);
    }, [total]);

    const quantity = cart.reduce((sum, item) => sum + item.qty, 0);
    const formattedTotal = total > 0 ? formatCurrency(total, prefs.currency).replace(prefs.currency, '').trim() : '0';

    return (
        <>
            <div className="z-20 flex shrink-0 items-center border-b bg-surface px-4 py-2.5">
                <div className={`flex flex-1 items-center justify-between ${isZenMode ? 'max-w-4xl mx-auto w-full' : ''}`}>
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                            <ShoppingCart size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-text-main">سلة المشتريات</h2>
                            <p className="text-xs text-text-muted">
                                <span className="font-mono font-bold text-primary">{quantity}</span> منتج
                                {selectedCustomer && <span> • {selectedCustomer.name}</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                        {cart.length > 0 && (
                            <Button 
                                variant="icon" 
                                onClick={handleParkSale} 
                                className="bg-background/50 border-border/50 text-text-muted hover:text-warning hover:bg-warning/10 hover:border-warning/20 transition-all duration-200"
                                title="تعليق البيع" 
                                aria-label="تعليق البيع"
                            >
                                <PauseCircle size={20} />
                            </Button>
                        )}
                        <Button 
                            variant={isZenMode ? 'primary' : 'icon'} 
                            onClick={() => setIsZenMode(!isZenMode)} 
                            className={isZenMode ? "" : "bg-background/50 border-border/50 text-text-muted hover:text-primary hover:bg-primary/10 hover:border-primary/20 transition-all duration-200"}
                            title={isZenMode ? 'تصغير' : 'تكبير'} 
                            aria-label={isZenMode ? 'تصغير' : 'تكبير'}
                        >
                            {isZenMode ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                        </Button>
                        <Button 
                            variant="icon" 
                            onClick={() => { setCart([]); setReceivedAmount(0); }} 
                            className="bg-background/50 border-border/50 text-text-muted hover:text-danger hover:bg-danger/10 hover:border-danger/20 transition-all duration-200"
                            title="إفراغ السلة" 
                            aria-label="إفراغ السلة"
                        >
                            <Trash2 size={20} />
                        </Button>
                    </div>
                </div>
            </div>

            <CartItemsList
                cart={cart}
                prefs={prefs}
                updateQty={updateQty}
                removeFromCart={removeFromCart}
                onQtyClick={onQtyClick}
                cartEndRef={cartEndRef}
                isZenMode={isZenMode}
            />

            <div className="z-30 relative shrink-0 border-t bg-surface px-4 py-3 shadow-lg">
                <div className={`space-y-2.5 ${isZenMode ? 'max-w-4xl mx-auto w-full' : ''}`}>
                    {/* 1. Payment Method Pills Selector */}
                    <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/60 bg-bg p-1 shadow-3xs">
                        {(['cash', 'card', 'credit'] as const).map((method) => (
                            <button
                                key={method}
                                type="button"
                                onClick={() => setPaymentMethod(method)}
                                className={`h-10 rounded-lg text-xs font-bold transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center ${
                                    paymentMethod === method
                                        ? 'bg-primary text-primary-fg font-black shadow-md shadow-primary/20 ring-1 ring-white/20'
                                        : 'text-text-muted hover:text-text-main hover:bg-surface/50'
                                }`}
                            >
                                {t(`sales.${method}`)}
                            </button>
                        ))}
                    </div>

                    {/* 2. Inputs Row: Discount & Received Amount + Change */}
                    <div className="flex items-center gap-2">
                        {/* Discount Input */}
                        <div className="flex items-center rounded-xl border border-danger/30 bg-danger/5 px-2.5 h-10 w-28 shrink-0">
                            <span className="text-[11px] font-bold text-danger shrink-0 ml-1">خصم:</span>
                            <input
                                type="number"
                                className="w-full bg-transparent text-center font-mono font-bold text-xs text-danger outline-none"
                                placeholder="0"
                                value={discount > 0 ? discount : ''}
                                onChange={(e) => setDiscount(Number(e.target.value))}
                            />
                        </div>

                        {/* Received Amount Input */}
                        {paymentMethod === 'cash' ? (
                            <>
                                <div className="flex items-center rounded-xl border border-primary/30 bg-bg px-2.5 h-10 flex-1 min-w-0 focus-within:border-primary transition-all">
                                    <span className="text-[11px] font-bold text-text-muted shrink-0 ml-1">المستلم:</span>
                                    <input
                                        type="number"
                                        className="w-full bg-transparent text-center font-mono font-bold text-xs text-text-main outline-none"
                                        placeholder="0"
                                        value={receivedAmount > 0 ? receivedAmount : ''}
                                        onChange={(e) => setReceivedAmount(Number(e.target.value))}
                                    />
                                </div>

                                {/* Change Amount Badge */}
                                {receivedAmount > 0 && (
                                    <div className={`flex h-10 shrink-0 items-center gap-1 rounded-xl border px-2.5 text-xs font-bold whitespace-nowrap ${
                                        change >= 0 ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'
                                    }`}>
                                        <span className="text-[10px] opacity-70">الباقي:</span>
                                        <span className="font-mono font-black text-xs">{formatCurrency(Math.abs(change), '')}</span>
                                    </div>
                                )}
                            </>
                        ) : <div className="flex-1" />}
                    </div>

                    {/* 3. Quick Cash Smart Amounts */}
                    {paymentMethod === 'cash' && (
                        <div className="grid grid-cols-4 gap-1.5">
                            {smartAmounts.map((amount) => (
                                <button
                                    key={amount}
                                    type="button"
                                    onClick={() => handleQuickCash(amount)}
                                    className={`h-9 text-xs font-bold font-mono rounded-lg transition-all active:scale-[0.98] cursor-pointer ${
                                        amount === receivedAmount || (receivedAmount === 0 && amount === total)
                                            ? 'bg-primary text-primary-fg font-black shadow-sm'
                                            : 'border border-border/80 bg-bg hover:bg-surface-active text-text-muted hover:text-text-main'
                                    }`}
                                >
                                    {amount >= 1000 ? `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k` : amount}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 4. Dedicated Total Amount Banner (Zero Truncation Guaranteed) */}
                    <div className="flex items-center justify-between rounded-xl border-2 border-primary/30 bg-primary/10 px-3.5 py-2 shadow-inner">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-primary">الإجمالي الكلي</span>
                            <span className="text-[10px] font-bold text-text-muted">({cart.length} منتج)</span>
                        </div>
                        <div className="flex items-center gap-1.5" dir="ltr">
                            <span className="font-mono font-black text-xl lg:text-2xl text-text-main tracking-tight whitespace-nowrap" title={formattedTotal}>
                                {formattedTotal}
                            </span>
                            <span className="text-xs font-black text-primary bg-primary/20 px-2 py-0.5 rounded-md shrink-0">
                                {prefs.currency}
                            </span>
                        </div>
                    </div>

                    {/* 5. Main Primary Action Bar (Checkout & Payment Options) */}
                    <div className="flex items-center gap-2 pt-0.5">
                        <button
                            type="button"
                            onClick={() => setShowSplitModal(true)}
                            title="دفع مجزأ"
                            className="h-12 px-3 rounded-xl border border-border/80 bg-surface hover:bg-surface-hover hover:border-primary/40 text-text-main font-bold text-xs flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-3xs"
                        >
                            <Split size={16} />
                            <span className="hidden sm:inline">مجزأ</span>
                        </button>

                        {selectedCustomer && (
                            <button
                                type="button"
                                onClick={() => { setInstConfig({ downPayment: 0, months: 3 }); setShowInstallmentModal(true); }}
                                title="أقساط"
                                className="h-12 px-3 rounded-xl border border-border/80 bg-surface hover:bg-surface-hover hover:border-primary/40 text-text-main font-bold text-xs flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-3xs"
                            >
                                <Calculator size={16} />
                                <span className="hidden sm:inline">أقساط</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleCheckout}
                            disabled={cart.length === 0 || isProcessing}
                            className="h-12 flex-1 rounded-xl bg-success hover:brightness-110 active:scale-[0.98] text-white font-black text-base flex items-center justify-center gap-2 transition-all shadow-md shadow-success/20 disabled:opacity-50 disabled:shadow-none cursor-pointer"
                        >
                            {isProcessing ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <Check size={20} strokeWidth={3} />
                                    <span>{paymentMethod === 'credit' ? 'تسجيل دين' : 'إتمام البيع'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
