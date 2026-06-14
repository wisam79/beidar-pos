import React from 'react';
import { cn } from '../../theme/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ElementType;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon: Icon, left, right, type, ...props }, ref) => (
    <label className={cn('grid gap-1.5 text-sm font-bold text-text-main', className)}>
      {label && <span className="text-xs text-text-muted">{label}</span>}
      <div className={cn('relative flex items-center rounded-xl border bg-input-bg transition-[border-color,box-shadow] duration-120 ease-out', error ? 'border-danger/50' : 'border-border focus-within:border-primary/70 focus-within:shadow-[0_0_0_4px_var(--color-primary-dim)]')}>
        {left && <span className="mr-3 text-text-muted">{left}</span>}
        {Icon && <Icon className="mr-3 h-4 w-4 shrink-0 text-text-muted" />}
        <input
          ref={ref}
          type={type}
          className="min-h-11 w-full bg-transparent px-3 py-2 text-sm font-medium text-text-main outline-none placeholder:text-text-muted/70"
          {...props}
        />
        {right && <span className="ml-3 text-text-muted">{right}</span>}
      </div>
      {error && <span className="text-xs font-bold text-danger">{error}</span>}
    </label>
  ),
);

Input.displayName = 'Input';
