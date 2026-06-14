import React from 'react';
import { cn } from '../../theme/cn';
import { X } from '../../lib/icons';

export interface ModalProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  open: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const sizes: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-[92vw]',
};

export const Modal = ({ title, description, children, footer, open, onClose, size = 'md', className }: ModalProps) => {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={onClose}>
      <div
        className={cn('relative w-full max-h-[92vh] overflow-hidden rounded-3xl border border-border bg-surface shadow-xl', sizes[size], className)}
        onMouseDown={event => event.stopPropagation()}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div>
              {title && <h2 className="text-lg font-black text-text-main">{title}</h2>}
              {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-text-muted transition hover:bg-surface-hover hover:text-text-main" aria-label="إغلاق">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="max-h-[68vh] overflow-y-auto p-5 custom-scrollbar">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border p-4 bg-surface-hover">{footer}</div>}
      </div>
    </div>
  );
};
