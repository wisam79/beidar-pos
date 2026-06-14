import React from 'react';
import { LucideIcon } from '../../lib/icons';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  right?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader = ({ title, description, icon: Icon, right, children }: PageHeaderProps) => {
  return (
    <header className="shrink-0 rounded-3xl border border-border bg-surface p-4 shadow-xs lg:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3.5">
          {Icon && (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary-dim text-primary">
              <Icon size={20} />
            </div>
          )}
          <div>
            <h1 className="text-xl font-black text-text-main tracking-tight">{title}</h1>
            {description && <p className="text-xs text-text-muted">{description}</p>}
          </div>
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
      {children && <div className="mt-3 border-t border-border/60 pt-3">{children}</div>}
    </header>
  );
};
