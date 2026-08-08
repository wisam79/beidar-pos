/**
 * InfoBanner — شريط التنبيهات والإرشادات الموحد
 * يوفر شريط تنبيهات أنيق مع الأيقونة والنص والزر الإجرائي
 */
import React, { memo } from 'react';
import { AlertTriangle, Info, CheckCircle2, XCircle, LucideIcon } from 'lucide-react';

export type BannerVariant = 'info' | 'warning' | 'success' | 'danger';

interface InfoBannerProps {
    variant?: BannerVariant;
    title?: string;
    message: React.ReactNode;
    icon?: LucideIcon;
    action?: React.ReactNode;
    onClose?: () => void;
    className?: string;
}

const variantStyles: Record<BannerVariant, { bg: string; border: string; text: string; icon: LucideIcon }> = {
    info: {
        bg: 'bg-primary-dim',
        border: 'border-primary/20',
        text: 'text-primary',
        icon: Info,
    },
    warning: {
        bg: 'bg-warning-dim',
        border: 'border-warning/25',
        text: 'text-warning',
        icon: AlertTriangle,
    },
    success: {
        bg: 'bg-success-dim',
        border: 'border-success/25',
        text: 'text-success',
        icon: CheckCircle2,
    },
    danger: {
        bg: 'bg-danger-dim',
        border: 'border-danger/25',
        text: 'text-danger',
        icon: XCircle,
    },
};

export const InfoBanner = memo(({
    variant = 'info',
    title,
    message,
    icon,
    action,
    className = '',
}: InfoBannerProps) => {
    const style = variantStyles[variant];
    const DefaultIcon = style.icon;
    const Icon = icon || DefaultIcon;

    return (
        <div className={`p-4 rounded-2xl border ${style.bg} ${style.border} flex items-center justify-between gap-4 transition-all ${className}`}>
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center shrink-0`}>
                    <Icon size={18} className={style.text} />
                </div>
                <div className="text-right min-w-0">
                    {title && <h4 className={`text-xs font-black leading-tight ${style.text}`}>{title}</h4>}
                    <div className="text-xs font-medium text-text-main mt-0.5 leading-relaxed">{message}</div>
                </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
});

InfoBanner.displayName = 'InfoBanner';
