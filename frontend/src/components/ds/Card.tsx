import React from 'react';
import { cn } from '../../theme/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'soft' | 'flat';
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant = 'surface', interactive, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'overflow-hidden rounded-2xl border transition-[background-color,border-color,box-shadow,transform] duration-120 ease-out',
      variant === 'surface' && 'bg-surface border-border shadow-xs',
      variant === 'soft' && 'bg-primary-dim border-primary/10 shadow-xs',
      variant === 'flat' && 'bg-transparent border-transparent shadow-none',
      interactive && 'cursor-pointer hover:border-primary/40 hover:shadow-md active:scale-[0.995]',
      className,
    )}
    {...props}
  >
    {children}
  </div>
));

Card.displayName = 'Card';
