/**
 * AvatarPill — شريحة المستخدم أو العميل الموحدة
 * تعرض الحروف الأولى أو الصورة المصغرة مع حالة الاتصال
 */
import React, { memo } from 'react';

interface AvatarPillProps {
    name: string;
    subtext?: string;
    avatarUrl?: string;
    statusDot?: 'online' | 'offline' | 'warning';
    size?: 'sm' | 'md';
    className?: string;
}

export const AvatarPill = memo(({
    name,
    subtext,
    avatarUrl,
    statusDot,
    size = 'md',
    className = '',
}: AvatarPillProps) => {
    const initials = name ? name.substring(0, 2).toUpperCase() : 'US';

    const statusColors = {
        online: 'bg-emerald-500',
        offline: 'bg-text-muted',
        warning: 'bg-amber-500',
    };

    return (
        <div className={`inline-flex items-center gap-2.5 p-1 pr-3 bg-surface border border-border rounded-full shadow-xs ${className}`}>
            <div className={`relative ${size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm'} rounded-full bg-primary/10 border border-primary/20 text-primary font-black flex items-center justify-center shrink-0 overflow-hidden`}>
                {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                    <span>{initials}</span>
                )}
                {statusDot && (
                    <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-surface ${statusColors[statusDot]}`} />
                )}
            </div>
            <div className="text-right min-w-0">
                <span className="block text-xs font-bold text-text-main leading-tight truncate">{name}</span>
                {subtext && <span className="block text-[10px] text-text-muted font-medium truncate">{subtext}</span>}
            </div>
        </div>
    );
});

AvatarPill.displayName = 'AvatarPill';
