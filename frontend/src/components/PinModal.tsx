
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, X, Lock, Check } from 'lucide-react';
import { playBeep } from '../core/utils';
import { api } from '../core/api';

interface PinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title?: string;
}

export const PinModal: React.FC<PinModalProps> = ({ isOpen, onClose, onSuccess, title = "مطلوب رمز الحماية" }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError(false);
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleNumberClick = (num: string) => {
        if (pin.length < 4) {
            setPin(prev => prev + num);
            setError(false);
        }
    };

    const handleDelete = () => setPin(prev => prev.slice(0, -1));

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (loading) return;

        setLoading(true);
        try {
            // Verify PIN via server
            const isValid = await api.auth.verifyPin(pin);

            if (isValid) {
                playBeep('success');
                onSuccess();
            } else {
                playBeep('error');
                setError(true);
                setPin('');
            }
        } catch (err) {
            console.error("PIN verification error:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90  flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-border rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4 border border-primary/20">
                    <Lock size={32} />
                </div>

                <h3 className="text-xl font-black text-text-main mb-1">{title}</h3>
                <p className="text-sm text-text-muted mb-6">أدخل رمز المدير للمتابعة</p>

                {/* PIN Dots */}
                <div className="flex gap-3 mb-6 justify-center">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${i < pin.length
                                ? (error ? 'bg-red-500 border-red-500 scale-110' : 'bg-primary border-primary scale-110')
                                : 'bg-transparent border-border'
                                }`}
                        />
                    ))}
                </div>

                {/* PIN Display */}
                <div className="bg-bg border border-border rounded-xl px-6 py-3 mb-6 min-w-[180px] text-center">
                    <span className="text-2xl font-mono font-bold tracking-[0.5em] text-text-main">
                        {'•'.repeat(pin.length) || '----'}
                    </span>
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] mb-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => handleNumberClick(num.toString())}
                            disabled={loading}
                            className="h-14 rounded-2xl bg-bg hover:bg-surface-hover text-text-main text-xl font-bold transition-all active:scale-95 border border-border"
                        >
                            {num}
                        </button>
                    ))}
                    <button
                        onClick={handleDelete}
                        disabled={loading}
                        className="h-14 rounded-2xl bg-bg hover:bg-surface-hover text-text-muted flex items-center justify-center transition-all active:scale-95 border border-border"
                        title="مسح"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <button
                        onClick={() => handleNumberClick('0')}
                        disabled={loading}
                        className="h-14 rounded-2xl bg-bg hover:bg-surface-hover text-text-main text-xl font-bold transition-all active:scale-95 border border-border"
                    >
                        0
                    </button>
                    <button
                        onClick={() => setPin('')}
                        disabled={loading}
                        className="h-14 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-all active:scale-95 border border-red-500/20"
                        title="مسح الكل"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 w-full max-w-[260px]">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 h-12 rounded-xl bg-bg hover:bg-surface-hover text-text-muted font-bold transition-all active:scale-95 border border-border"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={pin.length === 0 || loading}
                        className="flex-1 h-12 rounded-xl bg-primary hover:brightness-110 text-black font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <><Check size={18} /> تأكيد</>}
                    </button>
                </div>

                {/* Hidden Input for Physical Keyboard Support */}
                <input
                    ref={inputRef}
                    type="password"
                    className="opacity-0 absolute pointer-events-none"
                    value={pin}
                    onChange={e => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val)) setPin(val.slice(0, 4));
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSubmit();
                        if (e.key === 'Escape') onClose();
                    }}
                    autoFocus
                />

                {error && <p className="text-red-500 text-sm font-bold mt-4 animate-pulse">❌ الرمز غير صحيح</p>}
            </div>
        </div>
    );
};
