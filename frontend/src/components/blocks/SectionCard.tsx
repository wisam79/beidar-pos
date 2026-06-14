/**
 * SectionCard — كارد القسم الموحد
 * يستبدل divs متعددة بأنماط مختلفة للأقسام
 */
import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';

interface SectionCardProps {
    children: React.ReactNode;
    title?: string;
    icon?: LucideIcon;
    /** Small description text next to title */
    subtitle?: string;
    /** Actions in the header (right side for LTR, left for RTL) */
    headerActions?: React.ReactNode;
    /** Remove padding from body */
    noPadding?: boolean;
    className?: string;
}

export const SectionCard = memo(({
    children,
    title,
    icon: Icon,
    subtitle,
    headerActions,
    noPadding,
    className = '',
}: SectionCardProps) => (
    <div className={`bg-surface border border-border rounded-3xl shadow-sm flex flex-col overflow-hidden ${className}`}>
        {/* Optional Header */}
        {(title || headerActions) && (
            <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between shrink-0 bg-surface-hover">
                <div className="flex items-center gap-2.5">
                    {Icon && (
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <Icon size={16} />
                        </div>
                    )}
                    <div>
                        {title && <h3 className="text-sm font-black text-text-main tracking-tight">{title}</h3>}
                        {subtitle && <p className="text-[10px] text-text-muted mt-0.5">{subtitle}</p>}
                    </div>
                </div>
                {headerActions}
            </div>
        )}

        {/* Body */}
        <div className={noPadding ? '' : 'p-4'}>
            {children}
        </div>
    </div>
));
SectionCard.displayName = 'SectionCard';
