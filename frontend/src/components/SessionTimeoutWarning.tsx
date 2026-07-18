import React from 'react';
import { Clock, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../core/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════════
// ⏰ SESSION TIMEOUT WARNING - Shows when session is about to expire
// ═══════════════════════════════════════════════════════════════════════════════

export const SessionTimeoutWarning = () => {
    const { sessionTimeoutWarning, extendSession, logout } = useAuth();

    if (!sessionTimeoutWarning) return null;

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50  animate-in fade-in duration-300">
            <div className="bg-surface rounded-2xl border border-border shadow-2xl p-6 max-w-sm mx-4 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-text-main">انتهاء الجلسة قريباً</h3>
                        <p className="text-sm text-text-muted">٥ دقائق متبقية</p>
                    </div>
                </div>

                {/* Message */}
                <p className="text-text-muted text-sm mb-6">
                    سيتم تسجيل خروجك تلقائياً بسبب عدم النشاط.
                    اضغط على "متابعة" للبقاء متصلاً.
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={extendSession}
                        className="flex-1 bg-primary text-primary-fg font-bold py-3 px-4 rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={18} />
                        متابعة العمل
                    </button>
                    <button
                        onClick={logout}
                        className="px-4 py-3 rounded-xl border border-border text-text-muted hover:bg-surface-hover transition-all"
                        title="تسجيل الخروج"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
