/**
 * PageShell — الهيكل الأساسي الموحد لكل صفحة
 * يوحد: gap, padding, animation, overflow
 */
import React, { memo } from 'react';

interface PageShellProps {
    children: React.ReactNode;
    className?: string;
}

export const PageShell = memo(({ children, className = '' }: PageShellProps) => (
    <div className={`flex flex-col h-full gap-4 animate-in fade-in overflow-hidden ${className}`}>
        {children}
    </div>
));
PageShell.displayName = 'PageShell';
