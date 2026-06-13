/**
 * LoadingState — حالة التحميل الموحدة
 * يستبدل 5 تصاميم loading مختلفة
 */
import React, { memo } from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

interface LoadingStateProps {
    icon?: LucideIcon;
    title?: string;
    subtitle?: string;
}

export const LoadingState = memo(({
    icon: Icon = Loader2,
    title = 'جاري التحميل...',
    subtitle = 'يرجى الانتظار',
}: LoadingStateProps) => (
    <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
                <Icon size={32} className="text-primary" />
            </div>
            <div className="text-center">
                <p className="text-text-main font-bold text-sm">{title}</p>
                <p className="text-text-muted text-xs mt-1">{subtitle}</p>
            </div>
        </div>
    </div>
));
LoadingState.displayName = 'LoadingState';
