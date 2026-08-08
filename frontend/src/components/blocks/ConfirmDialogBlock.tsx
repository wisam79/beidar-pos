/**
 * ConfirmDialogBlock — شريط التأكيد السريع المباشر في الصفحة
 */
import React, { memo } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { Button } from '../ds/Button';

interface ConfirmDialogBlockProps {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning' | 'primary';
    className?: string;
}

export const ConfirmDialogBlock = memo(({
    title,
    message,
    confirmText = 'تأكيد',
    cancelText = 'إلغاء',
    onConfirm,
    onCancel,
    variant = 'danger',
    className = '',
}: ConfirmDialogBlockProps) => {
    return (
        <div className={`p-4 rounded-2xl border bg-surface border-border shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200 ${className}`}>
            <div className="flex items-center gap-3 text-right">
                <div className="w-10 h-10 rounded-xl bg-danger-dim border border-danger/20 text-danger flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-text-main leading-tight">{title}</h4>
                    {message && <p className="text-xs text-text-muted mt-0.5 font-medium">{message}</p>}
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={onCancel} icon={X}>
                    {cancelText}
                </Button>
                <Button variant={variant === 'danger' ? 'danger' : 'primary'} size="sm" onClick={onConfirm} icon={Check}>
                    {confirmText}
                </Button>
            </div>
        </div>
    );
});

ConfirmDialogBlock.displayName = 'ConfirmDialogBlock';
