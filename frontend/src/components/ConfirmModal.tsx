import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, X, AlertTriangle, Info } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'confirm' | 'warning' | 'error' | 'info';
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    type = 'confirm',
    confirmText = 'نعم',
    cancelText = 'لا',
    onConfirm,
    onCancel
}) => {
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    const icons = {
        confirm: <AlertCircle className="text-primary" size={32} />,
        warning: <AlertTriangle className="text-amber-500" size={32} />,
        error: <X className="text-red-500" size={32} />,
        info: <Info className="text-blue-500" size={32} />
    };

    const iconBg = {
        confirm: 'bg-primary/10 border-primary/20',
        warning: 'bg-amber-500/10 border-amber-500/20',
        error: 'bg-red-500/10 border-red-500/20',
        info: 'bg-blue-500/10 border-blue-500/20'
    };

    const confirmBtnStyle = {
        confirm: 'bg-primary text-primary-fg hover:bg-primary/90',
        warning: 'bg-amber-500 text-black hover:bg-amber-600',
        error: 'bg-red-500 text-white hover:bg-red-600',
        info: 'bg-blue-500 text-white hover:bg-blue-600'
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            dir="rtl"
        >
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200" 
                onClick={onCancel}
            />

            {/* Modal */}
            <div
                className="relative w-full max-w-md bg-surface backdrop-blur-xl border border-border/80 rounded-3xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Content */}
                <div className="p-8 flex flex-col items-center text-center gap-4">
                    {/* Icon */}
                    <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${iconBg[type]}`}>
                        {icons[type]}
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-bold text-text-main">{title}</h3>

                    {/* Message */}
                    <p className="text-text-muted text-sm leading-relaxed max-w-xs">{message}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 p-6 pt-0">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-6 py-3 rounded-xl border border-border bg-surface text-text-muted font-bold hover:bg-surface-hover hover:text-text-main transition-all active:scale-95"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all active:scale-95 shadow-lg ${confirmBtnStyle[type]}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
