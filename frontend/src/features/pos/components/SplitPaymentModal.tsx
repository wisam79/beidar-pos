
import React, { useState } from 'react';
import { Banknote, CreditCard, Split } from 'lucide-react';
import { Modal } from '../../../components/ui';
import { formatCurrency } from '../../../core/utils';

export const SplitPaymentModal = ({ total, onClose, onConfirm, currency = 'IQD' }: { total: number, onClose: () => void, onConfirm: (cash: number, card: number) => void, currency?: string }) => {
    const [cash, setCash] = useState(total);
    const card = total - cash;
    const step = currency === 'IQD' && total >= 250 ? (total % 250 === 0 ? 250 : 50) : (total < 100 ? 0.25 : 1);

    return (
        <Modal title="دفع مجزأ (Split Payment)" onClose={onClose} size="sm">
            <div className="space-y-6 pt-2">
                <div className="bg-bg p-4 rounded-2xl border border-border text-center">
                    <p className="text-text-muted text-xs font-bold mb-1 uppercase">إجمالي المبلغ</p>
                    <p className="text-3xl font-black text-text-main">{formatCurrency(total, currency).replace(currency, '')}</p>
                </div>

                <div>
                    <label className="flex justify-between text-xs font-bold text-text-muted mb-2"><span>نقدي (Cash)</span><span className="text-text-main font-mono">{formatCurrency(cash, currency)}</span></label>
                    <input type="range" min="0" max={total} step={step} value={cash} onChange={e => setCash(Number(e.target.value))} className="w-full h-2 bg-input-bg rounded-lg appearance-none cursor-pointer accent-success" />
                </div>

                <div>
                    <label className="flex justify-between text-xs font-bold text-text-muted mb-2"><span>بطاقة (Card)</span><span className="text-text-main font-mono">{formatCurrency(card, currency)}</span></label>
                    <input type="range" min="0" max={total} step={step} value={card} onChange={e => setCash(total - Number(e.target.value))} className="w-full h-2 bg-input-bg rounded-lg appearance-none cursor-pointer accent-primary" />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="bg-success/10 border border-success/20 p-3 rounded-xl text-center">
                        <Banknote className="mx-auto mb-1 text-success" size={20} />
                        <p className="font-bold text-text-main text-lg">{formatCurrency(cash, currency).replace(currency, '')}</p>
                    </div>
                    <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl text-center">
                        <CreditCard className="mx-auto mb-1 text-primary" size={20} />
                        <p className="font-bold text-text-main text-lg">{formatCurrency(card, currency).replace(currency, '')}</p>
                    </div>
                </div>

                <button onClick={() => onConfirm(cash, card)} className="w-full bg-primary text-primary-fg font-black py-4 rounded-xl hover:brightness-110 shadow-lg shadow-primary/20 active:scale-95 transition-all text-sm flex items-center justify-center gap-2">
                    <Split size={18} /> تأكيد الدفع
                </button>
            </div>
        </Modal>
    );
};
