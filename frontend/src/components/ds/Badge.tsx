import React from 'react';
import { cn } from '../../theme/cn';
import { Check, AlertTriangle, Info, X } from '../../lib/icons';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface text-text-muted border-border',
  primary: 'bg-primary-dim text-primary border-primary/15',
  success: 'bg-success-dim text-success border-success/20',
  danger: 'bg-danger-dim text-danger border-danger/20',
  warning: 'bg-warning-dim text-warning border-warning/25',
  info: 'bg-info-dim text-info border-info/20',
  neutral: 'bg-bg text-text-muted border-border',
};

const iconByVariant: Record<Exclude<BadgeVariant, 'default' | 'neutral'>, React.ElementType> = {
  primary: Info,
  success: Check,
  danger: X,
  warning: AlertTriangle,
  info: Info,
};

export const Badge = ({ children, variant = 'default', className }: BadgeProps) => {
  const Icon = iconByVariant[variant as Exclude<BadgeVariant, 'default' | 'neutral'>];
  return (
    <span className={cn('inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black whitespace-nowrap', variants[variant], className)}>
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </span>
  );
};
