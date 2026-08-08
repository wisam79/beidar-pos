/**
 * StatusIndicator — مؤشر حالة الاتصال أو العتاد أو الوردية الموحد
 */
import React, { memo } from 'react';

export type StatusState = 'online' | 'offline' | 'busy' | 'idle';

interface StatusIndicatorProps {
    status: StatusState;
    label?: string;
    pulse?: boolean;
    size?: 'sm' | 'md';
    className?: string;
}

const statusMap: Record<StatusState, { bg: string; text: string; defaultLabel: string }> = {
    online: { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', defaultLabel: 'متصل' },
    offline: { bg: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', defaultLabel: 'غير متصل' },
    busy: { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', defaultLabel: 'مشغول' },
    idle: { bg: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', defaultLabel: 'خامل' },
};

export const StatusIndicator = memo(({
    status,
    label,
    pulse: _pulse = true,
    size: _size = 'md',
    className = '',
}: StatusIndicatorProps) => {
    const s = statusMap[status];
    const displayLabel = label || s.defaultLabel;

    return (
        <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border bg-surface-hover shadow-xs ${className}`}>
            <span className="relative flex h-2 w-2 shrink-0">
                <span className={`relative inline-flex rounded-full h-2 w-2 ${s.bg}`} />
            </span>
            {displayLabel && (
                <span className={`text-[11px] font-bold leading-none ${s.text}`}>
                    {displayLabel}
                </span>
            )}
        </div>
    );
});

StatusIndicator.displayName = 'StatusIndicator';
