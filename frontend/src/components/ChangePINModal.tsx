import React, { useState, useRef, useEffect } from 'react';
import { Lock, Key, AlertTriangle, Check, Eye, EyeOff } from 'lucide-react';
import { api } from '../core/api';
import { useAuth } from '../core/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 CHANGE PIN MODAL - Forced PIN change for security
// ═══════════════════════════════════════════════════════════════════════════════

interface ChangePINModalProps {
    isOpen: boolean;
    onSuccess: () => void;
    isForced?: boolean; // If true, cannot be dismissed
}

export const ChangePINModal: React.FC<ChangePINModalProps> = ({
    isOpen,
    onSuccess,
    isForced = false
}) => {
    const { currentUser } = useAuth();
    const [currentPIN, setCurrentPIN] = useState('');
    const [newPIN, setNewPIN] = useState('');
    const [confirmPIN, setConfirmPIN] = useState('');
    const [showPINs, setShowPINs] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const newPINRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && newPINRef.current) {
            setTimeout(() => newPINRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const validatePIN = (pin: string): string | null => {
        if (pin.length !== 4) return 'رمز PIN يجب أن يكون 4 أرقام';
        if (!/^\d+$/.test(pin)) return 'رمز PIN يجب أن يحتوي على أرقام فقط';

        // Check for weak PINs
        const weakPINs = ['1234', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '4321'];
        if (weakPINs.includes(pin)) return 'الرمز سهل التخمين، اختر رمزاً أقوى';

        return null;
    };

    const handleSubmit = async () => {
        setError('');

        // Validate new PIN
        const validationError = validatePIN(newPIN);
        if (validationError) {
            setError(validationError);
            return;
        }

        // Check confirmation
        if (newPIN !== confirmPIN) {
            setError('رمز PIN الجديد غير متطابق');
            return;
        }

        // Don't allow same as current (if provided)
        if (currentPIN && currentPIN === newPIN) {
            setError('الرمز الجديد يجب أن يختلف عن الحالي');
            return;
        }

        setLoading(true);

        try {
            if (!currentUser?.id) {
                setError('خطأ في الجلسة');
                return;
            }

            await api.staff.updatePassword(currentUser.id, newPIN);
            setSuccess(true);

            // Wait for animation then close
            setTimeout(() => {
                onSuccess();
            }, 1500);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'فشل تغيير الرمز';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface border border-border rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95">
                {/* Header */}
                <div className={`p-6 text-center ${isForced ? 'bg-amber-500/10 border-b border-amber-500/20' : 'bg-primary/10 border-b border-primary/20'}`}>
                    <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${isForced ? 'bg-amber-500/20' : 'bg-primary/20'}`}>
                        {isForced ? (
                            <AlertTriangle size={32} className="text-amber-500" />
                        ) : (
                            <Key size={32} className="text-primary" />
                        )}
                    </div>
                    <h2 className="text-xl font-black text-text-main">
                        {isForced ? 'يجب تغيير رمز PIN' : 'تغيير رمز PIN'}
                    </h2>
                    <p className="text-text-muted text-sm mt-2">
                        {isForced
                            ? 'لأسباب أمنية، يجب تغيير رمز PIN الافتراضي'
                            : 'أدخل رمز PIN الجديد (4 أرقام)'
                        }
                    </p>
                </div>

                {/* Success State */}
                {success ? (
                    <div className="p-8 text-center">
                        <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                            <Check size={40} className="text-green-500" />
                        </div>
                        <p className="text-green-500 font-bold text-lg">تم تغيير الرمز بنجاح!</p>
                    </div>
                ) : (
                    /* Form */
                    <div className="p-6 space-y-4">
                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm text-center flex items-center justify-center gap-2">
                                <AlertTriangle size={16} />
                                {error}
                            </div>
                        )}

                        {/* New PIN */}
                        <div className="relative">
                            <input
                                ref={newPINRef}
                                type={showPINs ? 'text' : 'password'}
                                value={newPIN}
                                onChange={(e) => setNewPIN(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="رمز PIN الجديد"
                                className="w-full bg-bg border border-border rounded-xl py-4 px-5 pr-12 text-center text-2xl font-mono tracking-[0.5em] text-text-main outline-none focus:border-primary transition-colors"
                                maxLength={4}
                            />
                            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                        </div>

                        {/* Confirm PIN */}
                        <div className="relative">
                            <input
                                type={showPINs ? 'text' : 'password'}
                                value={confirmPIN}
                                onChange={(e) => setConfirmPIN(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="تأكيد رمز PIN"
                                className="w-full bg-bg border border-border rounded-xl py-4 px-5 pr-12 text-center text-2xl font-mono tracking-[0.5em] text-text-main outline-none focus:border-primary transition-colors"
                                maxLength={4}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPINs(!showPINs)}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
                            >
                                {showPINs ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>

                        {/* PIN Strength Indicator */}
                        {newPIN.length === 4 && (
                            <div className="flex items-center gap-2 text-xs">
                                {validatePIN(newPIN) ? (
                                    <span className="text-red-400">⚠️ {validatePIN(newPIN)}</span>
                                ) : (
                                    <span className="text-green-500">✓ رمز قوي</span>
                                )}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={loading || newPIN.length !== 4 || confirmPIN.length !== 4}
                            className="w-full bg-primary text-primary-fg font-black py-4 rounded-xl hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-3 border-black/20 border-t-black rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Key size={20} />
                                    حفظ الرمز الجديد
                                </>
                            )}
                        </button>

                        {/* Security Tips */}
                        <div className="bg-bg/50 rounded-xl p-4 border border-border">
                            <p className="text-[10px] text-text-muted font-bold mb-2">💡 نصائح للأمان:</p>
                            <ul className="text-[10px] text-text-muted space-y-1">
                                <li>• تجنب الأرقام المتسلسلة (1234)</li>
                                <li>• تجنب الأرقام المتكررة (0000)</li>
                                <li>• لا تستخدم تاريخ ميلادك</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChangePINModal;
