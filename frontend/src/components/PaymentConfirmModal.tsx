
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, CreditCard, Banknote, Clock, Receipt, Sparkles } from 'lucide-react';
import { formatCurrency } from '../core/utils';
import { CartItem, Customer } from '../core/types';

interface PaymentConfirmModalProps {
    cart: CartItem[];
    total: number;
    discount: number;
    customer: Customer | null;
    paymentMethod: 'cash' | 'card' | 'credit' | 'split' | 'installment';
    onConfirm: () => void;
    onClose: () => void;
}

export const PaymentConfirmModal: React.FC<PaymentConfirmModalProps> = ({
    cart, total, discount, customer, paymentMethod, onConfirm, onClose
}) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleConfirm = async () => {
        setIsProcessing(true);
        await new Promise(r => setTimeout(r, 600)); // Brief delay for UX
        setIsSuccess(true);
        await new Promise(r => setTimeout(r, 800)); // Show success
        onConfirm();
    };

    const paymentIcon = {
        cash: <Banknote size={24} />,
        card: <CreditCard size={24} />,
        credit: <Clock size={24} />,
        split: <Receipt size={24} />,
        installment: <Clock size={24} />
    }[paymentMethod];

    const paymentLabel = {
        cash: 'نقدي',
        card: 'بطاقة',
        credit: 'آجل',
        split: 'تجزئة',
        installment: 'أقساط'
    }[paymentMethod];

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
            {isSuccess ? (
                // Success Animation
                <div className="flex flex-col items-center justify-center animate-in zoom-in duration-500">
                    <div className="w-32 h-32 bg-primary rounded-full flex items-center justify-center mb-6 shadow-[0_0_60px_rgba(16,185,129,0.5)]">
                        <Check size={64} className="text-black" strokeWidth={3} />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-2">تم بنجاح!</h2>
                    <p className="text-white/60">جاري الإنتقال...</p>
                    <Sparkles className="text-primary mt-4 animate-pulse" size={32} />
                </div>
            ) : (
                // Confirmation Card
                <div className="w-full max-w-md bg-white dark:bg-surface rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                    {/* Header */}
                    <div className="bg-primary p-6 text-center relative">
                        <button onClick={onClose} title="إغلاق" className="absolute top-4 left-4 text-black/50 hover:text-black p-2 rounded-full hover:bg-black/10 transition-colors">
                            <X size={20} />
                        </button>
                        <div className="inline-flex items-center gap-2 text-black font-bold bg-black/10 px-4 py-1.5 rounded-full mb-3">
                            {paymentIcon}
                            <span>{paymentLabel}</span>
                        </div>
                        <h2 className="text-4xl font-black text-black">{formatCurrency(total)}</h2>
                        {discount > 0 && <p className="text-black/60 text-sm mt-1">خصم: {formatCurrency(discount)}</p>}
                    </div>

                    {/* Customer */}
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <span className="text-text-muted text-sm">العميل</span>
                        <span className="font-bold text-text-main">{customer?.name || 'عميل عام'}</span>
                    </div>

                    {/* Items Preview */}
                    <div className="p-4 max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                        {cart.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-sm">
                                <span className="text-text-muted truncate flex-1">{item.name} × {item.qty}</span>
                                <span className="font-bold text-text-main">{formatCurrency(item.price * item.qty)}</span>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="p-4 bg-bg border-t border-border">
                        <button
                            onClick={handleConfirm}
                            disabled={isProcessing}
                            className="w-full bg-primary hover:bg-emerald-400 text-black font-black text-xl py-5 rounded-2xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3"
                        >
                            {isProcessing ? (
                                <div className="w-6 h-6 border-3 border-black/20 border-t-black rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Check size={28} strokeWidth={3} />
                                    تأكيد الدفع
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};
