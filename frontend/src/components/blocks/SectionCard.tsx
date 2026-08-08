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
    <div className={`bg-surface border border-border/80 rounded-2xl flex flex-col overflow-hidden ${className}`}>
        {/* Optional Header */}
        {(title || headerActions) && (
            <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between shrink-0 bg-surface/50 min-h-[52px]">
                <div className="flex items-center gap-3">
                    {Icon && (
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                            <Icon size={18} />
                        </div>
                    )}
                    <div>
                        {title && <h3 className="text-sm font-extrabold text-text-main tracking-tight">{title}</h3>}
                        {subtitle && <p className="text-xs text-text-muted mt-0.5 font-medium">{subtitle}</p>}
                    </div>
                </div>
                {headerActions}
            </div>
        )}

        {/* Body */}
        <div className={noPadding ? '' : 'p-5 lg:p-6'}>
            {children}
        </div>
    </div>
));
SectionCard.displayName = 'SectionCard';
