/**
 * ActionButton — أزرار الإجراءات الموحدة
 * 5 أنماط: primary, secondary, danger, ghost, icon
 */
import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';

interface ActionButtonProps {
    variant?: ButtonVariant;
    icon?: LucideIcon;
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    title?: string;
    type?: 'button' | 'submit';
    /** Full width */
    block?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary: `
        bg-success text-primary-fg hover:bg-success
        border border-success/60
        active:scale-[0.98]
    `,
    secondary: `
        bg-surface hover:bg-surface-hover text-text-main
        border border-border/80
        active:scale-[0.98]
    `,
    danger: `
        bg-danger/10 text-danger hover:bg-danger hover:text-white
        border border-danger/30
        active:scale-[0.98]
    `,
    ghost: `
        bg-transparent hover:bg-surface-hover text-text-muted hover:text-text-main
        border border-transparent
        active:scale-[0.98]
    `,
    icon: `
        bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main
        border border-border/80
        active:scale-[0.98]
    `,
};

export const ActionButton = memo(({
    variant = 'secondary',
    icon: Icon,
    children,
    onClick,
    disabled,
    className = '',
    title,
    type = 'button',
    block,
}: ActionButtonProps) => {
    const isIconOnly = variant === 'icon' || (!children && Icon);
    
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`
                ${variantClasses[variant]}
                ${isIconOnly ? 'w-12 h-12 p-0 justify-center' : 'px-6 py-3 min-h-[48px] gap-2.5'}
                rounded-2xl font-black text-sm select-none
                flex items-center justify-center tracking-tight
                transition-all duration-150 ease-out
                touch-target outline-none cursor-pointer
                disabled:opacity-40 disabled:pointer-events-none
                ${block ? 'w-full' : ''}
                ${className}
            `}
        >
            {Icon && <Icon size={isIconOnly ? 22 : 18} className="shrink-0" />}
            {children}
        </button>
    );
});
ActionButton.displayName = 'ActionButton';
