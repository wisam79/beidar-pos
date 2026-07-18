import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../theme/cn';

export interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export const Tooltip = ({ children, content, side = 'top', className }: TooltipProps) => {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let top = 0;
    let left = 0;

    // Calculate position based on side selection
    if (side === 'left') {
      top = rect.top + rect.height / 2;
      left = rect.left;
    } else if (side === 'right') {
      top = rect.top + rect.height / 2;
      left = rect.right;
    } else if (side === 'top') {
      top = rect.top;
      left = rect.left + rect.width / 2;
    } else if (side === 'bottom') {
      top = rect.bottom;
      left = rect.left + rect.width / 2;
    }

    setCoords({ top, left });
    setShow(true);
  };

  const handleMouseLeave = () => {
    setShow(false);
  };

  return (
    <span
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn('inline-flex w-fit', className)}
    >
      {children}
      {show &&
        createPortal(
          <span
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 9999,
              transform:
                side === 'left'
                  ? 'translate(-100%, -50%) translate(-12px, 0)'
                  : side === 'right'
                  ? 'translate(0, -50%) translate(12px, 0)'
                  : side === 'top'
                  ? 'translate(-50%, -100%) translate(0, -12px)'
                  : 'translate(-50%, 0) translate(0, 12px)',
            }}
            className="pointer-events-none"
          >
            <span className="relative block whitespace-nowrap rounded-lg border border-border/80 bg-surface  px-2.5 py-1.5 text-xs font-semibold text-text-main shadow-md animate-in fade-in zoom-in-95 duration-100">
              {content}
              <span
                style={{
                  position: 'absolute',
                  width: '6px',
                  height: '6px',
                  transform: side === 'left' || side === 'right' ? 'translateY(-50%) rotate(45deg)' : 'translateX(-50%) rotate(45deg)',
                  top: side === 'top' ? 'auto' : side === 'bottom' ? '-3px' : '50%',
                  bottom: side === 'top' ? '-3px' : 'auto',
                  left: side === 'left' ? 'auto' : side === 'right' ? '-3px' : '50%',
                  right: side === 'left' ? '-3px' : 'auto',
                }}
                className={cn(
                  "bg-surface pointer-events-none",
                  side === 'left' && "border-t border-r border-border/80",
                  side === 'right' && "border-b border-l border-border/80",
                  side === 'top' && "border-b border-r border-border/80",
                  side === 'bottom' && "border-t border-l border-border/80"
                )}
              />
            </span>
          </span>,
          document.body
        )}
    </span>
  );
};
