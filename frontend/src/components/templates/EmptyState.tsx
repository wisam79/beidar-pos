import React from 'react';
import { LucideIcon } from '../../lib/icons';
import { Button } from '../ds/Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = ({ title, description, icon: Icon, actionLabel, onAction }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {Icon && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface text-text-muted">
          <Icon size={26} />
        </div>
      )}
      <h3 className="text-lg font-black text-text-main">{title}</h3>
      {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction} className="mt-6">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
