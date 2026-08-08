import React from 'react';

/**
 * StatCard - بطاقة إحصائية للوحة التحكم
 * 
 * تصميم بسيط واحترافي:
 * - لا تدرجات لونية مفرطة
 * - لون Primary موحد للأيقونة
 * - خلفية نظيفة
 */

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    subtext?: string;
    onClick?: () => void;
    variant?: 'default' | 'primary' | 'danger';
}

export const StatCard: React.FC<StatCardProps> = ({
    icon,
    label,
    value,
    subtext,
    onClick,
    variant = 'default',
}) => {
    const iconBgColors = {
        default: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        primary: 'bg-primary/10 border-primary/20 text-primary',
        danger: 'bg-red-500/10 border-red-500/20 text-red-400',
    };

    const borderColors = {
        default: 'border-border/80 hover:border-emerald-500/30',
        primary: 'border-border/80 hover:border-primary/40',
        danger: 'border-red-500/30 hover:border-red-500/50',
    };

    return (
        <div
            onClick={onClick}
            className={`
                bg-surface border rounded-2xl p-4 sm:p-4.5 
                flex flex-col justify-between select-none
                transition-transform duration-150
                ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
                ${borderColors[variant]}
            `}
        >
            <div className={`p-2.5 rounded-xl border w-fit ${iconBgColors[variant]}`}>
                {icon}
            </div>

            <div className="mt-3">
                <p className="text-[11px] text-text-muted font-extrabold mb-1">{label}</p>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-text-main font-mono leading-none tracking-tight">
                        {value}
                    </span>
                    {subtext && (
                        <span className="text-[10px] text-text-muted font-bold">{subtext}</span>
                    )}
                </div>
            </div>
        </div>
    );
};
