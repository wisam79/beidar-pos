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
}

const CartItemsList: React.FC<CartItemsListProps> = ({ cart, prefs, updateQty, removeFromCart, cartEndRef, onQtyClick }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: cart.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 112,
        overscan: 3,
    });

    if (cart.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-3 custom-scrollbar">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border bg-surface">
                        <Package size={36} className="text-text-muted" />
                    </div>
                    <p className="mb-1 text-base font-bold text-text-muted">السلة فارغة</p>
                    <p className="text-sm text-text-muted/60">امسح الباركود أو اختر منتجاً</p>
                </div>
            </div>
        );
    }

    return (
        <div ref={parentRef} className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
            <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
                {virtualizer.getVirtualItems().map((virtualItem) => {
                    const item = cart[virtualItem.index];
                    return (
                        <div
                            key={item.id}
                            className="absolute left-0 top-0 w-full pb-3"
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
            <div className="z-20 flex shrink-0 items-center justify-between border-b bg-surface px-4 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border bg-primary/10 text-primary">
                        <ShoppingCart size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-text-main">سلة المشتريات</h2>
                        <p className="text-xs text-text-muted">
                            <span className="font-mono font-bold text-primary">{quantity}</span> منتج
                            {selectedCustomer && <span> • {selectedCustomer.name}</span>}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                    {cart.length > 0 && (
                        <Button variant="icon" onClick={handleParkSale} title="تعليق البيع" aria-label="تعليق البيع">
                            <PauseCircle size={20} />
                        </Button>
                    )}
                    <Button variant={isZenMode ? 'primary' : 'icon'} onClick={() => setIsZenMode(!isZenMode)} title={isZenMode ? 'تصغير' : 'تكبير'} aria-label={isZenMode ? 'تصغير' : 'تكبير'}>
                        {isZenMode ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                    </Button>
                    <Button variant="icon" onClick={() => { setCart([]); setReceivedAmount(0); }} title="إفراغ السلة" aria-label="إفراغ السلة">
                        <Trash2 size={20} />
                    </Button>
                </div>
            </div>

            <CartItemsList
                cart={cart}
                prefs={prefs}
                updateQty={updateQty}
                removeFromCart={removeFromCart}
                onQtyClick={onQtyClick}
                cartEndRef={cartEndRef}
            />

            <div className="z-30 relative shrink-0 border-t bg-surface px-4 py-3">
                <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-1 rounded-xl border bg-bg p-1">
                        {(['cash', 'card', 'credit'] as const).map((method) => (
                            <button
                                key={method}
                                type="button"
                                onClick={() => setPaymentMethod(method)}
                                className={`h-10 rounded-lg text-xs font-bold transition active:scale-[0.98] ${paymentMethod === method ? 'border bg-surface text-text-main shadow-xs' : 'text-text-muted hover:text-text-main'}`}
                            >
                                {t(`sales.${method}`)}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative w-28 shrink-0">
                            <input
                                type="number"
                                className="h-10 w-full rounded-xl border border-danger/30 bg-danger-dim px-3 pr-10 text-center text-sm font-bold text-danger outline-none transition focus:border-danger"
                                placeholder="خصم"
                                value={discount > 0 ? discount : ''}
                                onChange={(e) => setDiscount(Number(e.target.value))}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-danger/60">%</span>
                        </div>

                        {paymentMethod === 'cash' ? (
                            <>
                                <input
                                    type="number"
                                    className="h-10 flex-1 min-w-0 rounded-xl border bg-input-bg px-3 text-center text-sm font-bold text-text-main outline-none transition focus:border-primary"
                                    placeholder="المبلغ المستلم"
                                    value={receivedAmount > 0 ? receivedAmount : ''}
                                    onChange={(e) => setReceivedAmount(Number(e.target.value))}
                                />
                                {receivedAmount > 0 && (
                                    <div className={`flex h-10 shrink-0 whitespace-nowrap items-center gap-1 rounded-xl border px-3 text-sm font-bold ${change >= 0 ? 'border-success/30 bg-success-dim text-success' : 'border-danger/30 bg-danger-dim text-danger'}`}>
                                        <span className="text-[10px] opacity-70">الباقي:</span>
                                        <span className="tabular-nums">{formatCurrency(Math.abs(change), '')}</span>
                                    </div>
                                )}
                            </>
                        ) : <div className="flex-1" />}
                    </div>

                    {paymentMethod === 'cash' && (
                        <div className="grid grid-cols-4 gap-1.5">
                            {smartAmounts.map((amount) => (
                                <button
                                    key={amount}
                                    type="button"
                                    onClick={() => handleQuickCash(amount)}
                                    className={`py-2 text-[11px] font-bold font-mono rounded-lg transition active:scale-[0.98] ${amount === total ? 'bg-primary text-white' : 'border border-border bg-surface-hover text-text-muted hover:bg-surface-active hover:text-text-main'}`}
                                >
                                    {amount >= 1000 ? `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k` : amount}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex shrink-0 items-center gap-2">
                        <div className="flex h-14 flex-1 min-w-0 items-center justify-between rounded-xl border-2 border-primary/30 bg-primary-dim px-4">
                            <span className="shrink-0 text-xs font-bold text-primary">الإجمالي</span>
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate tabular-nums text-3xl font-black text-text-main" title={formattedTotal}>{formattedTotal}</span>
                                <span className="shrink-0 rounded-lg bg-primary/20 px-2 py-1 text-sm font-bold text-primary">{prefs.currency}</span>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <Button variant="icon" onClick={() => setShowSplitModal(true)} title="دفع مجزأ" className="shrink-0">
                                <Split size={18} />
                            </Button>
                            {selectedCustomer && (
                                <Button variant="icon" onClick={() => { setInstConfig({ downPayment: 0, months: 3 }); setShowInstallmentModal(true); }} title="أقساط" className="shrink-0">
                                    <Calculator size={18} />
                                </Button>
                            )}
                            <Button variant="primary" onClick={handleCheckout} disabled={cart.length === 0 || isProcessing} className="h-14 w-32 shrink-0 whitespace-nowrap text-sm">
                                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check size={20} strokeWidth={3} /><span>{paymentMethod === 'credit' ? 'دين' : 'بيع'}</span></>}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
