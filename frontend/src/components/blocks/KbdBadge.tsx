/**
 * KbdBadge — شارة اختصارات الكيبورد الموحدة لسطح المكتب
 * تعرض اختصارات المفاتيح (مثل F1, ESC, Ctrl+K) بنمط محاكي لسطح المكتب
 */
import React, { memo } from 'react';

interface KbdBadgeProps {
    keys: string | string[];
    size?: 'sm' | 'md';
    className?: string;
}

export const KbdBadge = memo(({ keys, size = 'sm', className = '' }: KbdBadgeProps) => {
    const keyList = Array.isArray(keys) ? keys : [keys];

    return (
        <span className={`inline-flex items-center gap-1 select-none ${className}`}>
            {keyList.map((k, idx) => (
                <kbd
                    key={idx}
                    className={`inline-flex items-center justify-center font-mono font-bold text-text-muted bg-surface-hover border border-border rounded-md shadow-xs ${
                        size === 'sm' ? 'h-5 min-w-[20px] px-1.5 text-[10px]' : 'h-6 min-w-[24px] px-2 text-xs'
                    }`}
                >
                    {k}
                </kbd>
            ))}
        </span>
    );
});

KbdBadge.displayName = 'KbdBadge';
