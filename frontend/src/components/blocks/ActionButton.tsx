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
        bg-primary text-primary-fg hover:brightness-[1.03]
        shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30
        border border-primary/10
    `,
    secondary: `
        bg-surface hover:bg-surface-hover text-text-main
        border border-border
        shadow-sm hover:shadow-md
    `,
    danger: `
        bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white
        border border-red-500/20 shadow-sm
    `,
    ghost: `
        bg-transparent hover:bg-surface-hover text-text-muted hover:text-text-main
        border border-transparent
    `,
    icon: `
        bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main
        border border-border shadow-sm
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
                ${isIconOnly ? 'w-11 h-11 p-0 justify-center' : 'px-5 py-2.5 gap-2'}
                rounded-full font-black text-sm
                flex items-center justify-center
                transition-all duration-300 ease-[var(--ease-spring)]
                active:scale-95 touch-target
                disabled:opacity-40 disabled:pointer-events-none
                ${block ? 'w-full' : ''}
                ${className}
            `}
        >
            {Icon && <Icon size={isIconOnly ? 20 : 16} />}
            {children}
        </button>
    );
});
ActionButton.displayName = 'ActionButton';
