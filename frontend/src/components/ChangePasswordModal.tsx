import React, { useState, useRef, useEffect } from 'react';
import { Lock, Shield, Check, Loader2 } from 'lucide-react';
import { api } from '../core/api';

interface ChangePasswordModalProps {
    isOpen: boolean;
    staffId: string;
    staffName: string;
    isForced?: boolean; // If true, user MUST change PIN (can't close)
    onSuccess: () => void;
    onClose?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
    isOpen,
    staffId,
    staffName,
    isForced = false,
    onSuccess,
    onClose
}) => {
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const newPinInputRef = useRef<HTMLInputElement>(null);
    const confirmPinInputRef = useRef<HTMLInputElement>(null);

    // Autofocus on mount / when isOpen changes
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                newPinInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // PIN validation
    const isValidLength = newPin.length === 4;
    const isAllDigits = /^\d{4}$/.test(newPin);
    const isNotDefault = newPin !== '0000';
    const pinsMatch = newPin === confirmPin && confirmPin.length === 4;
    const canSubmit = isValidLength && isAllDigits && isNotDefault && pinsMatch;

    const handlePinChange = (value: string, setter: (v: string) => void) => {
        const digits = value.replace(/\D/g, '').slice(0, 4);
        setter(digits);
        setError('');

        // Shift focus to confirm input when new PIN is filled
        if (setter === setNewPin && digits.length === 4) {
            setTimeout(() => {
                confirmPinInputRef.current?.focus();
            }, 50);
        }
    };

    const handleFormClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button')) {
            return;
        }

        if (newPin.length < 4) {
            newPinInputRef.current?.focus();
        } else {
            confirmPinInputRef.current?.focus();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setLoading(true);
        setError('');

        try {
            await api.staff.updatePassword(staffId, newPin);
            onSuccess();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء تغيير رمز PIN';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70  z-[200] flex items-center justify-center p-4">
            <div className="bg-surface rounded-3xl border border-border shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-6 border-b border-border">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                            <Shield size={28} className="text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-text-main">تغيير رمز PIN</h2>
                            <p className="text-text-muted text-sm">
                                {isForced ? 'يجب تغيير الرمز الافتراضي للمتابعة' : 'قم بتعيين رمز PIN جديد'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} onClick={handleFormClick} className="p-6 space-y-6">
                    {/* New PIN */}
                    <div>
                        <label className="text-sm font-medium text-text-muted mb-3 block">رمز PIN الجديد (4 أرقام)</label>
                        <div className="flex justify-center gap-3 cursor-pointer" onClick={() => newPinInputRef.current?.focus()}>
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className={`w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${newPin.length > i
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border bg-bg text-text-muted'
                                        }`}
                                >
                                    {newPin[i] || ''}
                                </div>
                            ))}
                        </div>
                        <input
                            ref={newPinInputRef}
                            type="tel"
                            inputMode="numeric"
                            value={newPin}
                            onChange={(e) => handlePinChange(e.target.value, setNewPin)}
                            className="opacity-0 absolute w-0 h-0"
                            maxLength={4}
                            autoFocus
                            aria-label="رمز PIN الجديد"
                        />
                        <p
                            onClick={() => newPinInputRef.current?.focus()}
                            className="text-center text-text-muted text-xs mt-2 cursor-pointer hover:text-primary"
                        >
                            اضغط وأدخل رمز PIN
                        </p>
                    </div>

                    {/* Confirm PIN */}
                    <div>
                        <label className="text-sm font-medium text-text-muted mb-3 block">تأكيد رمز PIN</label>
                        <div className="flex justify-center gap-3 cursor-pointer" onClick={() => confirmPinInputRef.current?.focus()}>
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className={`w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${confirmPin.length > i
                                            ? pinsMatch && confirmPin.length === 4
                                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                                                : 'border-amber-500 bg-amber-500/10 text-amber-400'
                                            : 'border-border bg-bg text-text-muted'
                                        }`}
                                >
                                    {confirmPin[i] || ''}
                                </div>
                            ))}
                        </div>
                        <input
                            ref={confirmPinInputRef}
                            type="tel"
                            inputMode="numeric"
                            value={confirmPin}
                            onChange={(e) => handlePinChange(e.target.value, setConfirmPin)}
                            className="opacity-0 absolute w-0 h-0"
                            maxLength={4}
                            aria-label="تأكيد رمز PIN"
                        />
                        <p
                            onClick={() => confirmPinInputRef.current?.focus()}
                            className="text-center text-text-muted text-xs mt-2 cursor-pointer hover:text-primary"
                        >
                            اضغط لتأكيد الرمز
                        </p>
                    </div>

                    {/* Validation hints */}
                    <div className="bg-bg/50 rounded-xl p-4 space-y-2">
                        <div className={`flex items-center gap-2 text-xs ${isNotDefault ? 'text-emerald-400' : 'text-text-muted'}`}>
                            <Check size={14} className={isNotDefault ? 'opacity-100' : 'opacity-30'} />
                            لا يمكن استخدام 0000
                        </div>
                        <div className={`flex items-center gap-2 text-xs ${pinsMatch ? 'text-emerald-400' : 'text-text-muted'}`}>
                            <Check size={14} className={pinsMatch ? 'opacity-100' : 'opacity-30'} />
                            الرمزان متطابقان
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        {!isForced && onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 p-4 bg-surface-hover text-text-main rounded-xl font-bold hover:bg-border transition-colors"
                            >
                                إلغاء
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={!canSubmit || loading}
                            className={`flex-1 p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${canSubmit
                                ? 'bg-gradient-to-r from-primary to-emerald-400 text-black hover:shadow-lg'
                                : 'bg-surface-hover text-text-muted cursor-not-allowed'
                                }`}
                        >
                            {loading ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <>
                                    <Lock size={20} />
                                    تأكيد رمز PIN
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
