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
    online: { bg: 'bg-success', text: 'text-success dark:text-success', defaultLabel: 'متصل' },
    offline: { bg: 'bg-danger', text: 'text-danger dark:text-danger', defaultLabel: 'غير متصل' },
    busy: { bg: 'bg-warning', text: 'text-warning dark:text-warning', defaultLabel: 'مشغول' },
    idle: { bg: 'bg-primary', text: 'text-primary dark:text-primary', defaultLabel: 'خامل' },
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
