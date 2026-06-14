import React from 'react';
import { LucideIcon } from '../../lib/icons';
import { cn } from '../../theme/cn';

interface StatItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  variant?: 'default' | 'success' | 'danger' | 'warning';
}

interface StatsGridProps {
  items: StatItem[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

const variantClass: Record<string, string> = {
  default: 'border-border bg-surface text-text-main',
  success: 'border-success/20 bg-success-dim text-success',
  danger: 'border-danger/20 bg-danger-dim text-danger',
  warning: 'border-warning/20 bg-warning-dim text-warning',
};

export const StatsGrid = ({ items, columns = 4, className }: StatsGridProps) => {
  const cols = { 1: 'grid-cols-1', 2: 'grid-cols-1 md:grid-cols-2', 3: 'grid-cols-1 md:grid-cols-3', 4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4' }[columns];
  return (
    <div className={cn('grid gap-3', cols, className)}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className={cn('rounded-2xl border p-4 shadow-xs', variantClass[item.variant || 'default'])}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black text-text-muted">{item.label}</p>
                <p className="mt-0.5 truncate text-2xl font-black tracking-tight">{item.value}</p>
                {item.hint && <p className="mt-0.5 text-[11px] text-text-muted">{item.hint}</p>}
              </div>
              <Icon className="h-5 w-5 shrink-0 opacity-70" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
