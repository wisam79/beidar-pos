/**
 * CartPanel - Shopping cart display component
 * Extracted from Sales.tsx for better maintainability
 */

import React, { useRef } from 'react';
import { ShoppingCart, PauseCircle, Maximize2, Minimize2, Trash2, Split, Calculator, Check, Loader2, Package } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatCurrency } from '../../../../core/utils';
import { CartItem, Customer, AppPreferences } from '../../../../core/types';
import { CartItemRow as Row } from '../CartItemRow';
import { EmptyState } from '../../../../components/ui';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface CartPanelProps {
    // Cart data
    cart: CartItem[];
    selectedCustomer: Customer | null;
    prefs: AppPreferences;

    // Totals
    subtotal: number;
    total: number;
    discount: number;
    receivedAmount: number;
    change: number;

    // Payment state
    paymentMethod: 'cash' | 'card' | 'credit' | 'split' | 'installment';
    isProcessing: boolean;

    // Zen mode
    isZenMode: boolean;

    // Setters
    setDiscount: (value: number) => void;
    setPaymentMethod: (method: 'cash' | 'card' | 'credit' | 'split' | 'installment') => void;
    setIsZenMode: (value: boolean) => void;
    setCart: (cart: CartItem[]) => void;
    setReceivedAmount: (value: number) => void;

    // Actions
    updateQty: (id: string, qty: number) => void;
    removeFromCart: (id: string) => void;
    handleParkSale: () => void;
    handleQuickCash: (amount: number) => void;
    handleCheckout: () => void;
    setShowSplitModal: (show: boolean) => void;
    setShowInstallmentModal: (show: boolean) => void;
    setInstConfig: (config: { downPayment: number; months: number }) => void;
    onQtyClick?: (item: CartItem) => void; // Added


    // Refs
    cartEndRef: React.RefObject<HTMLDivElement>;

    // Translation
    t: (key: string) => string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Virtualized Cart Items List
// ═══════════════════════════════════════════════════════════════════════════════

interface CartItemsListProps {
    cart: CartItem[];
    prefs: AppPreferences;
    updateQty: (id: string, qty: number) => void;
    removeFromCart: (id: string) => void;
    cartEndRef: React.RefObject<HTMLDivElement>;
    onQtyClick?: (item: CartItem) => void;
}

const CartItemsList: React.FC<CartItemsListProps> = ({ cart, prefs, updateQty, removeFromCart, cartEndRef, onQtyClick }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    // Responsive row height - larger on 2xl screens (matches new CartItemRow design)
    const is2XL = typeof window !== 'undefined' && window.innerWidth >= 1536;
    const rowHeight = is2XL ? 110 : 96;

    const virtualizer = useVirtualizer({
        count: cart.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => rowHeight, // Card height varies by screen size
        overscan: 3,
    });

    if (cart.length === 0) {
        return (
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3">
                <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-20 h-20 bg-surface border border-border rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Package size={36} className="text-text-muted" />
                        </div>
                        <p className="text-base font-bold text-text-muted mb-1">السلة فارغة</p>
                        <p className="text-sm text-text-muted/60">امسح الباركود أو اختر منتجاً</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div ref={parentRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3">

            <div
                style={{ height: `${virtualizer.getTotalSize()}px` }}
                className="w-full relative"
            >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                    const item = cart[virtualItem.index];
                    return (
                        <div
                            key={item.id}
                            style={{
                                height: `${virtualItem.size}px`,
                                transform: `translateY(${virtualItem.start}px)`,
                            }}
                            className="absolute top-0 left-0 w-full pb-3"
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
            <div ref={cartEndRef}></div>
        </div >
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export const CartPanel: React.FC<CartPanelProps> = ({
    cart,
    selectedCustomer,
    prefs,
    subtotal,
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
    return (
        <>
            {/* Cart Header - Enhanced */}
            <div className="px-4 py-4 border-b border-border bg-surface flex justify-between items-center shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-primary/20 to-emerald-500/10 rounded-xl flex items-center justify-center text-primary border border-primary/30">
                        <ShoppingCart size={22} />
                    </div>
                    <div>
                        <h2 className="font-bold text-text-main text-base">سلة المشتريات</h2>
                        <p className="text-xs text-text-muted">
                            <span className="font-mono font-bold text-primary">{cart.reduce((a, b) => a + b.qty, 0)}</span> منتج
                            {selectedCustomer && <span className="text-text-muted"> • {selectedCustomer.name}</span>}
                        </p>
                    </div>
                </div>
                <div className="flex gap-1.5">
                    {cart.length > 0 && (
                        <button
                            onClick={handleParkSale}
                            className="w-10 h-10 hover:bg-orange-500/10 rounded-xl text-text-muted hover:text-orange-500 transition-all active:scale-95 flex items-center justify-center"
                            title="تعليق البيع"
                            aria-label="تعليق البيع"
                        >
                            <PauseCircle size={20} />
                        </button>
                    )}
                    <button
                        onClick={() => setIsZenMode(!isZenMode)}
                        title={isZenMode ? "تصغير" : "تكبير"}
                        aria-label={isZenMode ? "تصغير" : "تكبير"}
                        className={`w-10 h-10 rounded-xl transition-all active:scale-95 flex items-center justify-center ${isZenMode ? 'bg-primary text-primary-fg' : 'hover:bg-surface-hover text-text-muted hover:text-text-main'}`}
                    >
                        {isZenMode ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                    </button>
                    <button
                        onClick={() => { setCart([]); setReceivedAmount(0); }}
                        title="إفراغ السلة"
                        aria-label="إفراغ السلة"
                        className="w-10 h-10 hover:bg-red-500/10 rounded-xl text-text-muted hover:text-red-500 transition-all active:scale-95 flex items-center justify-center"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            {/* Cart Items - Virtualized for performance */}
            <CartItemsList
                cart={cart}
                prefs={prefs}
                updateQty={updateQty}
                removeFromCart={removeFromCart}
                onQtyClick={onQtyClick}
                cartEndRef={cartEndRef}
            />

            {/* Cart Totals & Actions - Optimized Layout */}
            <div className="bg-surface border-t border-border px-4 py-3 shrink-0 z-30 relative">
                <div className="space-y-3">
                    {/* Row 1: Payment Method */}
                    <div className="flex gap-1 h-10 bg-bg rounded-xl p-1 border border-border">
                        {(['cash', 'card', 'credit'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => setPaymentMethod(m)}
                                className={`flex-1 rounded-lg text-xs font-bold transition-all active:scale-95 ${paymentMethod === m ? 'bg-surface shadow-sm text-text-main border border-border' : 'text-text-muted hover:text-text-main'}`}
                            >
                                {t(`sales.${m}`)}
                            </button>
                        ))}
                    </div>

                    {/* Row 2: Discount + Received Amount (Logical Flow) */}
                    <div className="flex items-center gap-2">
                        {/* Discount */}
                        <div className="w-28 relative shrink-0">
                            <input
                                type="number"
                                className="w-full h-10 bg-red-500/10 border border-red-500/30 rounded-xl px-3 pr-10 text-center text-sm font-bold text-red-500 outline-none focus:border-red-500 transition-all"
                                placeholder="خصم"
                                value={discount > 0 ? discount : ''}
                                onChange={e => setDiscount(Number(e.target.value))}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500/60 text-sm">🏷️</span>
                        </div>

                        {/* Received Amount (for cash) */}
                        {paymentMethod === 'cash' ? (
                            <>
                                <input
                                    type="number"
                                    className="flex-1 h-10 bg-input-bg border border-border rounded-xl px-3 text-sm font-bold text-text-main outline-none focus:border-primary transition-colors text-center"
                                    placeholder="المبلغ المستلم"
                                    value={receivedAmount > 0 ? receivedAmount : ''}
                                    onChange={e => setReceivedAmount(Number(e.target.value))}
                                />
                                {receivedAmount > 0 && (
                                    <div className={`h-10 px-3 rounded-xl flex items-center gap-1 font-bold text-sm shrink-0 ${change >= 0 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'}`}>
                                        <span className="text-[10px] opacity-70">الباقي:</span>
                                        <span className="tabular-nums">{formatCurrency(Math.abs(change), '')}</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex-1" />
                        )}
                    </div>

                    {/* Row 3: Quick Cash Buttons (Cash only) */}
                    {paymentMethod === 'cash' && (
                        <div className="grid grid-cols-4 gap-1.5">
                            {(() => {
                                const roundUp = (n: number, to: number) => Math.ceil(n / to) * to;
                                const smartAmounts: number[] = [];

                                if (total > 0) {
                                    smartAmounts.push(total);
                                    [5000, 10000, 25000, 50000].forEach(step => {
                                        const amt = roundUp(total, step);
                                        if (amt > total && !smartAmounts.includes(amt) && smartAmounts.length < 4) {
                                            smartAmounts.push(amt);
                                        }
                                    });
                                }

                                const displayAmounts = smartAmounts.length > 0 ? smartAmounts.slice(0, 4) : [5000, 10000, 25000, 50000];

                                return displayAmounts.map((amt, idx) => (
                                    <button
                                        key={amt}
                                        onClick={() => handleQuickCash(amt)}
                                        className={`py-2 rounded-lg text-[11px] font-bold font-mono transition-all active:scale-95 ${idx === 0 && total > 0
                                            ? 'bg-primary text-white'
                                            : 'bg-surface-hover hover:bg-surface-active border border-border text-text-muted hover:text-text-main'
                                            }`}
                                    >
                                        {amt >= 1000 ? `${(amt / 1000).toFixed(amt % 1000 === 0 ? 0 : 1)}k` : amt}
                                    </button>
                                ));
                            })()}
                        </div>
                    )}

                    {/* Row 4: Total + Action Buttons (Side by Side) */}
                    <div className="flex items-center gap-2">
                        {/* Total Display - Prominent */}
                        <div className="flex-1 h-12 bg-gradient-to-r from-emerald-500/10 to-primary/10 border-2 border-emerald-500/50 rounded-xl px-4 flex items-center justify-between">
                            <span className="text-xs font-bold text-primary/70">الإجمالي</span>
                            <div className="flex items-center gap-2">
                                <span className="text-3xl font-black text-text-main tabular-nums">
                                    {total > 0 ? formatCurrency(total, prefs.currency).replace(prefs.currency, '').trim() : '0'}
                                </span>
                                <span className="text-sm font-bold text-primary bg-primary/20 px-2 py-1 rounded-lg">
                                    {prefs.currency}
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <button
                            onClick={() => setShowSplitModal(true)}
                            className="w-10 h-12 bg-surface hover:bg-surface-hover text-text-muted border border-border rounded-xl flex items-center justify-center transition-all hover:text-text-main active:scale-95 shrink-0"
                            title="دفع مجزأ"
                        >
                            <Split size={18} />
                        </button>
                        {selectedCustomer && (
                            <button
                                onClick={() => { setInstConfig({ downPayment: 0, months: 3 }); setShowInstallmentModal(true); }}
                                className="w-10 h-12 bg-surface hover:bg-surface-hover text-text-muted border border-border rounded-xl flex items-center justify-center transition-all hover:text-text-main active:scale-95 shrink-0"
                                title="أقساط"
                            >
                                <Calculator size={18} />
                            </button>
                        )}
                        <button
                            onClick={handleCheckout}
                            disabled={cart.length === 0 || isProcessing}
                            className="w-28 h-12 bg-gradient-to-r from-primary to-emerald-400 text-black font-black rounded-xl text-sm flex items-center justify-center gap-2 hover:brightness-105 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-[0.98] shrink-0"
                        >
                            {isProcessing ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    <Check size={20} strokeWidth={3} />
                                    <span className="font-black">{paymentMethod === 'credit' ? 'دين' : 'بيع'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
