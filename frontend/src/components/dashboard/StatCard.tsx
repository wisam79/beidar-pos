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
    // تنسيقات بسيطة بدون تدرجات مفرطة
    const iconBgColors = {
        default: 'bg-primary/10 text-primary',
        primary: 'bg-primary/15 text-primary',
        danger: 'bg-red-500/10 text-red-500',
    };

    const borderColors = {
        default: 'border-border hover:border-primary/30',
        primary: 'border-primary/20 hover:border-primary/40',
        danger: 'border-red-500/20 hover:border-red-500/40',
    };

    return (
        <div
            onClick={onClick}
            className={`
                bg-surface border rounded-xl p-3 
                flex flex-col justify-between 
                cursor-pointer transition-all duration-200
                hover:shadow-sm
                ${borderColors[variant]}
            `}
        >
            {/* أيقونة بسيطة */}
            <div className={`p-1.5 rounded-lg w-fit ${iconBgColors[variant]}`}>
                {icon}
            </div>

            {/* المحتوى */}
            <div className="mt-2">
                <p className="text-[11px] text-text-muted font-bold mb-1">{label}</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-text-main font-mono leading-none">
                        {value}
                    </span>
                    {subtext && (
                        <span className="text-[11px] text-text-muted">{subtext}</span>
                    )}
                </div>
            </div>
        </div>
    );
};
