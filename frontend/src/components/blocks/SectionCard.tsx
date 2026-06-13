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
    <div className={`bg-surface border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden ${className}`}>
        {/* Optional Header */}
        {(title || headerActions) && (
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0 bg-bg/30">
                <div className="flex items-center gap-2">
                    {Icon && (
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <Icon size={16} />
                        </div>
                    )}
                    <div>
                        {title && <h3 className="text-sm font-bold text-text-main">{title}</h3>}
                        {subtitle && <p className="text-[10px] text-text-muted">{subtitle}</p>}
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
