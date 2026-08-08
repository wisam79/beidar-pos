/**
 * MetricProgressCard — بطاقة مقياس التقدم وإكمال الهدف الموحدة
 */
import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from '../ds/Card';

interface MetricProgressCardProps {
    title: string;
    value: string | number;
    targetValue?: string | number;
    progress: number; // 0 to 100
    icon?: LucideIcon;
    subtitle?: string;
    className?: string;
}

export const MetricProgressCard = memo(({
    title,
    value,
    targetValue,
    progress,
    icon: Icon,
    subtitle,
    className = '',
}: MetricProgressCardProps) => {
    const clampedProgress = Math.min(100, Math.max(0, progress));

    return (
        <Card className={`p-5 flex flex-col justify-between ${className}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="text-right min-w-0">
                    <span className="text-[11px] font-bold text-text-muted uppercase block tracking-wider leading-tight">{title}</span>
                    <span className="font-mono font-black text-xl text-text-main block mt-1 leading-none">{value}</span>
                </div>
                {Icon && (
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                        <Icon size={20} />
                    </div>
                )}
            </div>

            {/* Progress Bar */}
            <div className="w-full mt-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-text-muted mb-1.5">
                    <span>نسبة الإنجاز: {clampedProgress.toFixed(0)}%</span>
                    {targetValue && <span>الهدف: {targetValue}</span>}
                </div>
                <div className="w-full h-2 rounded-full bg-surface-hover border border-border overflow-hidden relative">
                    <div
                        className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${clampedProgress}%` }}
                    />
                </div>
            </div>

            {subtitle && <p className="text-[10px] font-semibold text-text-muted mt-2 text-right">{subtitle}</p>}
        </Card>
    );
});

MetricProgressCard.displayName = 'MetricProgressCard';
