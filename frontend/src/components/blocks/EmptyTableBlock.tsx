/**
 * EmptyTableBlock — مكون الحالة الفارغة المخصص لصفوف الجداول والقوائم
 */
import React, { memo } from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyTableBlockProps {
    icon?: LucideIcon;
    title?: string;
    description?: string;
    action?: React.ReactNode;
    colSpan?: number;
    className?: string;
}

export const EmptyTableBlock = memo(({
    icon: Icon = Inbox,
    title = 'لا توجد بيانات للعرض',
    description = 'لم يتم العثور على أي عناصر مطابقة في الوقت الحالي',
    action,
    colSpan,
    className = '',
}: EmptyTableBlockProps) => {
    const content = (
        <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
            <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center text-text-muted mb-3 shadow-xs">
                <Icon size={26} strokeWidth={1.5} className="opacity-60" />
            </div>
            <h4 className="text-sm font-bold text-text-main mb-1">{title}</h4>
            {description && <p className="text-xs text-text-muted max-w-xs mb-4 leading-relaxed font-medium">{description}</p>}
            {action}
        </div>
    );

    if (colSpan !== undefined) {
        return (
            <tr>
                <td colSpan={colSpan} className="p-0">
                    {content}
                </td>
            </tr>
        );
    }

    return content;
});

EmptyTableBlock.displayName = 'EmptyTableBlock';
