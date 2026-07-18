import React from 'react';
import { cn } from '../../theme/cn';
import { Loader2 } from '../../lib/icons';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'soft' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ElementType;
  isLoading?: boolean;
  block?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg border-primary hover:brightness-[1.04] shadow-sm',
  secondary: 'bg-surface text-text-main border-border hover:bg-surface-hover hover:border-primary/40 shadow-xs',
  danger: 'bg-danger-dim text-danger border-danger/30 hover:bg-danger hover:text-white',
  ghost: 'bg-transparent text-text-muted border-transparent hover:bg-surface-hover hover:text-text-main',
  soft: 'bg-primary-dim text-primary border-primary/15 hover:bg-primary/15',
  icon: 'bg-surface text-text-muted border-border hover:bg-surface-hover hover:text-text-main shadow-xs',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', icon: Icon, isLoading, block, children, disabled, type = 'button', ...props }, ref) => {
    const iconOnly = variant === 'icon' || (!children && Icon);
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex select-none items-center justify-center gap-2 rounded-xl border font-black transition-[background-color,border-color,color,transform,box-shadow] duration-120 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45',
          iconOnly 
            ? (size === 'sm' ? 'w-9 h-9 p-0' : size === 'lg' ? 'w-12 h-12 p-0' : 'w-11 h-11 p-0') 
            : sizes[size],
          variants[variant],
          block && 'w-full',
          className,
        )}
        {...props}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
