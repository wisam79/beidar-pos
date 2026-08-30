import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X, AlertTriangle, Info } from 'lucide-react';

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
        confirm: <AlertCircle className="text-success" size={36} />,
        warning: <AlertTriangle className="text-warning" size={36} />,
        error: <X className="text-danger" size={36} />,
        info: <Info className="text-primary" size={36} />
    };

    const iconBg = {
        confirm: 'bg-success/10 border-success/20',
        warning: 'bg-warning/10 border-warning/20',
        error: 'bg-danger/10 border-danger/20',
        info: 'bg-primary/10 border-primary/20'
    };

    const confirmBtnStyle = {
        confirm: 'bg-success text-primary-fg font-black hover:bg-success border-t border-t-white/40 border-b-[3px] border-b-success shadow-success/20',
        warning: 'bg-warning text-primary-fg font-black hover:bg-warning border-t border-t-white/40 border-b-[3px] border-b-warning',
        error: 'bg-danger text-white font-black hover:bg-danger border-t border-t-white/40 border-b-[3px] border-b-danger',
        info: 'bg-primary text-white font-black hover:bg-primary border-t border-t-white/40 border-b-[3px] border-b-primary'
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 select-none"
            dir="rtl"
        >
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200" 
                onClick={onCancel}
            />

            {/* Modal */}
            <div
                className="relative w-full max-w-md bg-surface border-t border-t-white/30 dark:border-t-white/10 border-x border-x-border/60 border-b-[4px] border-b-black/80 rounded-3xl shadow-2xl animate-modal-pop overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Content */}
                <div className="p-8 flex flex-col items-center text-center gap-4">
                    {/* Icon */}
                    <div className={`w-18 h-18 rounded-2xl border flex items-center justify-center ${iconBg[type]} shadow-md`}>
                        {icons[type]}
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-extrabold text-text-main tracking-tight">{title}</h3>

                    {/* Message */}
                    <p className="text-text-muted text-sm leading-relaxed max-w-xs font-medium">{message}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 p-6 pt-0">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-6 py-3 min-h-[48px] rounded-2xl border-t border-t-white/20 border-x border-x-border/60 border-b-[3px] border-b-black/60 dark:border-b-black/80 bg-surface text-text-muted font-extrabold hover:bg-surface-hover hover:text-text-main transition-all pressable touch-target outline-none cursor-pointer"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 px-6 py-3 min-h-[48px] rounded-2xl transition-all pressable shadow-lg touch-target outline-none cursor-pointer ${confirmBtnStyle[type]}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
