import React, { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, Plus, Minus, DollarSign, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../core/api';
import { Shift } from '../core/types';
import { formatCurrency } from '../core/utils';

interface ShiftManagerProps {
    staff: { id: string; name: string } | null;
    currency: string;
    notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
    onShiftChange?: (shift: Shift | null) => void;
}

export const ShiftManager: React.FC<ShiftManagerProps> = ({ staff, currency, notify, onShiftChange }) => {
    const [activeShift, setActiveShift] = useState<Shift | null>(null);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState(false);

    // Form states
    const [openingBalance, setOpeningBalance] = useState(0);
    const [closingBalance, setClosingBalance] = useState(0);
    const [closeNote, setCloseNote] = useState('');
    const [movementType, setMovementType] = useState<'cash_in' | 'cash_out'>('cash_in');
    const [movementAmount, setMovementAmount] = useState(0);
    const [movementReason, setMovementReason] = useState('');

    // Fetch active shift on mount
    useEffect(() => {
        fetchActiveShift();
    }, []);

    const fetchActiveShift = async () => {
        try {
            setLoading(true);
            const shift = await api.shift.getActive();
            setActiveShift(shift || null);
            onShiftChange?.(shift || null);
        } catch (e) {
            console.error('Failed to fetch shift:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenShift = async () => {
        if (!staff) {
            notify('يجب تسجيل الدخول أولاً', 'error');
            return;
        }
        try {
            const shift = await api.shift.open(staff.id, staff.name, openingBalance);
            setActiveShift(shift);
            onShiftChange?.(shift);
            setShowOpenModal(false);
            setOpeningBalance(0);
            notify('تم فتح الشفت بنجاح', 'success');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'فشل فتح الشفت';
            notify(msg, 'error');
        }
    };

    const handleCloseShift = async () => {
        if (!activeShift) return;
        try {
            const shift = await api.shift.close(activeShift.id, closingBalance, closeNote);
            setActiveShift(null);
            onShiftChange?.(null);
            setShowCloseModal(false);
            setClosingBalance(0);
            setCloseNote('');

            // Show variance result
            if (shift && shift.variance !== 0) {
                const varianceMsg = shift.variance > 0
                    ? `فائض: ${formatCurrency(shift.variance, currency)}`
                    : `عجز: ${formatCurrency(Math.abs(shift.variance), currency)}`;
                notify(`تم إغلاق الشفت. ${varianceMsg}`, shift.variance < 0 ? 'error' : 'success');
            } else {
                notify('تم إغلاق الشفت بنجاح', 'success');
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'فشل إغلاق الشفت';
            notify(msg, 'error');
        }
    };

    const handleAddMovement = async () => {
        if (!activeShift || !staff || movementAmount <= 0) return;
        try {
            await api.shift.addMovement(
                activeShift.id,
                movementType,
                movementReason,
                staff.id,
                staff.name,
                movementAmount
            );
            // Refresh shift data
            await fetchActiveShift();
            setShowMovementModal(false);
            setMovementAmount(0);
            setMovementReason('');
            notify(movementType === 'cash_in' ? 'تم إضافة النقد' : 'تم سحب النقد', 'success');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'فشل تسجيل الحركة';
            notify(msg, 'error');
        }
    };

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-text-muted gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-surface-active/50" />
                <span className="text-sm font-bold">جاري تحميل بيانات الشفت...</span>
            </div>
        );
    }

    return (
        <div className="h-full bg-white dark:bg-surface border border-border rounded-3xl p-5 flex flex-col shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-16 bg-primary/5 rounded-bl-[100px] transition-transform group-hover:scale-110 pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h3 className="font-black text-lg text-text-main leading-none">إدارة الشفت</h3>
                        <p className="text-xs text-text-muted font-bold mt-1">التحكم في الشفت الحالي</p>
                    </div>
                </div>
                {activeShift && (
                    <span className="px-3 py-1.5 bg-success/10 border border-success/20 text-success dark:text-success text-xs font-black rounded-xl flex items-center gap-2 shadow-sm">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
                        </span>
                        شفت مفتوح
                    </span>
                )}
            </div>

            {/* Active Shift Info */}
            {activeShift ? (
                <div className="flex-1 flex flex-col gap-4 relative z-10 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                    <div className="grid grid-cols-2 gap-3">
                        {/* Opening Balance */}
                        <div className="bg-surface border border-border/50 rounded-2xl p-3 flex flex-col gap-1 hover:border-border transition-colors">
                            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">رصيد الافتتاح</span>
                            <span className="text-lg font-black text-text-main font-mono tracking-tight">
                                {formatCurrency(activeShift.openingBalance, currency).replace(currency, '')}
                                <span className="text-[10px] text-text-muted mr-1">{currency}</span>
                            </span>
                        </div>

                        {/* Expected Balance */}
                        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-3 flex flex-col gap-1 hover:border-primary/30 transition-colors">
                            <span className="text-[10px] uppercase font-bold text-primary/70 dark:text-primary/70 tracking-wider">المتوقع حالياً</span>
                            <span className="text-lg font-black text-primary dark:text-primary font-mono tracking-tight">
                                {formatCurrency(activeShift.expectedBalance, currency).replace(currency, '')}
                                <span className="text-[10px] text-primary/70 mr-1">{currency}</span>
                            </span>
                        </div>

                        {/* Cash Sales */}
                        <div className="bg-success/5 border border-success/10 rounded-2xl p-3 flex flex-col gap-1 hover:border-success/30 transition-colors">
                            <span className="text-[10px] uppercase font-bold text-success/70 dark:text-success/70 tracking-wider">مبيعات نقدية</span>
                            <span className="text-lg font-black text-success dark:text-success font-mono tracking-tight">
                                {formatCurrency(activeShift.cashSales, currency).replace(currency, '')}
                                <span className="text-[10px] text-success/70 mr-1">{currency}</span>
                            </span>
                        </div>

                        {/* Sales Count */}
                        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-3 flex flex-col gap-1 hover:border-primary/30 transition-colors">
                            <span className="text-[10px] uppercase font-bold text-primary/70 dark:text-primary/70 tracking-wider">عدد الفواتير</span>
                            <span className="text-lg font-black text-primary dark:text-primary font-mono tracking-tight">
                                {activeShift.salesCount}
                            </span>
                        </div>
                    </div>

                    <div className="mt-auto space-y-3 pt-2">
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setMovementType('cash_in'); setShowMovementModal(true); }}
                                className="flex-1 py-3 px-4 rounded-xl bg-success/10 text-success dark:text-success font-bold text-sm border border-success/20 hover:bg-success hover:text-white hover:shadow-lg hover:shadow-success/20 transition-all flex items-center justify-center gap-2 group/btn"
                            >
                                <Plus size={18} className="group-hover/btn:rotate-90 transition-transform" />
                                إيداع
                            </button>
                            <button
                                onClick={() => { setMovementType('cash_out'); setShowMovementModal(true); }}
                                className="flex-1 py-3 px-4 rounded-xl bg-warning/10 text-warning dark:text-warning font-bold text-sm border border-warning/20 hover:bg-warning hover:text-white hover:shadow-lg hover:shadow-warning/20 transition-all flex items-center justify-center gap-2 group/btn"
                            >
                                <Minus size={18} />
                                سحب
                            </button>
                        </div>

                        <button
                            onClick={() => { setClosingBalance(activeShift.expectedBalance); setShowCloseModal(true); }}
                            className="w-full py-3.5 px-4 rounded-xl bg-danger text-white font-black text-sm shadow-lg shadow-danger/20 hover:bg-danger hover:shadow-danger/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                            <LogOut size={18} />
                            إغلاق الشفت الحالي
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10 p-6 rounded-2xl border border-dashed border-border/80 bg-surface  group-hover:border-primary/25 transition-all">
                    {/* Glowing active indicator dot */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-danger/10 border border-danger/20 text-danger dark:text-danger text-[10px] font-black px-2 py-0.5 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                        مغلق
                    </div>

                    <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:border-primary/30 transition-all duration-500 shadow-inner">
                        <LogIn size={36} className="text-primary opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>
                    
                    <h4 className="text-lg font-black text-text-main mb-1.5">لا يوجد شفت نشط</h4>
                    <p className="text-xs text-text-muted mb-6 max-w-[240px] leading-relaxed">
                        يجب فتح شفت (وردية مالية) جديدة لتتمكن من تسجيل المبيعات ومراقبة النقدية في درج الصندوق.
                    </p>

                    <button
                        onClick={() => setShowOpenModal(true)}
                        className="px-8 py-3.5 bg-primary text-white rounded-xl font-black shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all flex items-center gap-2.5 group/btn"
                    >
                        <Plus size={20} className="group-hover/btn:scale-110 transition-transform" />
                        فتح شفت جديد
                    </button>

                    {/* Quick tip box */}
                    <div className="mt-8 p-3.5 bg-surface border border-border/60 rounded-xl text-right max-w-[260px] text-[10px] leading-relaxed text-text-muted">
                        <span className="font-bold text-text-main block mb-1">💡 تلميح سريع:</span>
                        الرصيد الافتتاحي هو مجموع المبالغ النقدية (الفكة) المتواجدة في الدرج عند استلامك الصندوق لضمان دقة الجرد عند الإغلاق.
                    </div>
                </div>
            )}

            {/* Modals remain mostly the same but with rounded-3xl for consistency */}

            {/* Open Shift Modal */}
            {showOpenModal && (
                <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-surface border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-5 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-xl text-text-main">فتح شفت جديد</h3>
                            <button onClick={() => setShowOpenModal(false)} className="w-8 h-8 rounded-full bg-surface hover:bg-danger/10 hover:text-danger flex items-center justify-center transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-text-muted mb-2">رصيد الافتتاح (النقد في الصندوق)</label>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <DollarSign className="text-text-muted group-focus-within/input:text-primary transition-colors" size={20} />
                                </div>
                                <input
                                    type="number"
                                    value={openingBalance || ''}
                                    onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-surface-active/30 border border-border rounded-xl pl-10 pr-4 py-3.5 text-text-main font-mono text-lg font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                                    placeholder="0"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleOpenShift}
                            className="w-full py-4 bg-primary text-white rounded-xl font-black shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={20} />
                            تأكيد وفتح الشفت
                        </button>
                    </div>
                </div>
            )}

            {/* Close Shift Modal */}
            {showCloseModal && activeShift && (
                <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-surface border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-5 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-xl text-text-main">إغلاق الشفت</h3>
                            <button onClick={() => setShowCloseModal(false)} className="w-8 h-8 rounded-full bg-surface hover:bg-danger/10 hover:text-danger flex items-center justify-center transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 mb-6 text-center">
                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1">الرصيد المتوقع في الصندوق</span>
                            <span className="text-2xl font-black text-primary dark:text-primary font-mono tracking-tight">{formatCurrency(activeShift.expectedBalance, currency)}</span>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-bold text-text-muted mb-2">الرصيد الفعلي (بعد العدّ)</label>
                            <input
                                type="number"
                                value={closingBalance || ''}
                                onChange={(e) => setClosingBalance(parseFloat(e.target.value) || 0)}
                                className="w-full bg-surface-active/30 border border-border rounded-xl px-4 py-3.5 text-text-main font-mono text-lg font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                                placeholder="0"
                                autoFocus
                            />
                        </div>

                        {closingBalance !== activeShift.expectedBalance && closingBalance > 0 && (
                            <div className={`flex items-center gap-3 p-3 rounded-xl mb-4 text-sm font-bold ${closingBalance > activeShift.expectedBalance ? 'bg-success/10 text-success dark:text-success' : 'bg-danger/10 text-danger'}`}>
                                <AlertTriangle size={18} />
                                <span>
                                    {closingBalance > activeShift.expectedBalance ? 'يوجد فائض: ' : 'يوجد عجز: '}
                                    <span className="font-black font-mono text-base ml-1">{formatCurrency(Math.abs(closingBalance - activeShift.expectedBalance), currency)}</span>
                                </span>
                            </div>
                        )}

                        <div className="mb-6">
                            <label className="block text-sm font-bold text-text-muted mb-2">ملاحظات (اختياري)</label>
                            <textarea
                                value={closeNote}
                                onChange={(e) => setCloseNote(e.target.value)}
                                className="w-full bg-surface-active/30 border border-border rounded-xl px-4 py-3 text-text-main resize-none h-24 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-text-muted/50"
                                placeholder="أي ملاحظات إضافية حول الإغلاق..."
                            />
                        </div>

                        <button
                            onClick={handleCloseShift}
                            className="w-full py-4 bg-danger text-white rounded-xl font-black shadow-lg shadow-danger/20 hover:shadow-danger/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                            <LogOut size={20} />
                            تأكيد الإغلاق النهائي
                        </button>
                    </div>
                </div>
            )}

            {/* Cash Movement Modal */}
            {showMovementModal && (
                <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-surface border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-5 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-xl text-text-main flex items-center gap-2">
                                {movementType === 'cash_in' ? <Plus className="text-success" /> : <Minus className="text-warning" />}
                                {movementType === 'cash_in' ? 'إيداع نقد' : 'سحب نقد'}
                            </h3>
                            <button onClick={() => setShowMovementModal(false)} className="w-8 h-8 rounded-full bg-surface hover:bg-danger/10 hover:text-danger flex items-center justify-center transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-bold text-text-muted mb-2">المبلغ</label>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <DollarSign className="text-text-muted group-focus-within/input:text-primary transition-colors" size={20} />
                                </div>
                                <input
                                    type="number"
                                    value={movementAmount || ''}
                                    onChange={(e) => setMovementAmount(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-surface-active/30 border border-border rounded-xl pl-10 pr-4 py-3.5 text-text-main font-mono text-lg font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                                    placeholder="0"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-bold text-text-muted mb-2">السبب</label>
                            <input
                                type="text"
                                value={movementReason}
                                onChange={(e) => setMovementReason(e.target.value)}
                                className="w-full bg-surface-active/30 border border-border rounded-xl px-4 py-3.5 text-text-main font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-text-muted/50"
                                placeholder={movementType === 'cash_in' ? 'مثال: إضافة فكة' : 'مثال: سحب للمصروفات'}
                            />
                        </div>

                        <button
                            onClick={handleAddMovement}
                            disabled={movementAmount <= 0}
                            className={`w-full py-4 text-white rounded-xl font-black shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:translate-y-0 ${movementType === 'cash_in'
                                ? 'bg-success hover:bg-success shadow-success/20 hover:shadow-success/40'
                                : 'bg-warning hover:bg-warning shadow-warning/20 hover:shadow-warning/40'
                                }`}
                        >
                            {movementType === 'cash_in' ? <Plus size={20} /> : <Minus size={20} />}
                            {movementType === 'cash_in' ? 'تأكيد الإيداع' : 'تأكيد السحب'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
