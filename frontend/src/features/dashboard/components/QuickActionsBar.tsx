/**
 * QuickActionsBar - شريط الإجراءات السريعة
 * 
 * تصميم احترافي متوافق مع الوضع الفاتح والداكن:
 * - استخدام متغيرات الألوان من النظام
 * - تأثيرات تعمل في كلا الوضعين
 */
import React, { memo } from 'react';
import {
    Zap,
    Plus,
    UserPlus,
    Package,
    FileText,
    CreditCard,
    LucideIcon
} from 'lucide-react';
import type { View } from '../../../core/types';

interface QuickAction {
    id: string;
    label: string;
    icon: LucideIcon;
    shortcut?: string;
    view: string;
    pendingAction?: string;
    hasBadge?: boolean;
}

const actions: QuickAction[] = [
    { id: 'sale', label: 'بيع سريع', icon: Zap, shortcut: 'F1', view: 'sales' },
    { id: 'product', label: 'منتج جديد', icon: Plus, shortcut: 'F2', view: 'products', pendingAction: 'openAddModal' },
    { id: 'customer', label: 'عميل جديد', icon: UserPlus, shortcut: 'F3', view: 'customers', pendingAction: 'openAddModal' },
    { id: 'inventory', label: 'المخزون', icon: Package, view: 'inventory', hasBadge: true },
    { id: 'reports', label: 'التقارير', icon: FileText, view: 'reports' },
    { id: 'finance', label: 'المالية', icon: CreditCard, view: 'finance' },
];

interface QuickActionsBarProps {
    setView: (view: View) => void;
}

export const QuickActionsBar = memo(({ setView }: QuickActionsBarProps) => {
    const handleActionClick = (action: QuickAction) => {
        if (action.pendingAction) {
            sessionStorage.setItem('pendingAction', action.pendingAction);
        }
        setView(action.view as View);
    };

    return (
        <div className="relative">
            {/* الخلفية مع التدرج - يعمل في كلا الوضعين */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-2xl" />

            {/* الشريط الرئيسي */}
            <div className="relative bg-surface border border-border rounded-2xl p-2 shadow-sm">
                {/* خط علوي مضيء */}
                <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

                <div className="grid grid-cols-6 gap-2">
                    {actions.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => handleActionClick(action)}
                            className="
                                relative group flex flex-col items-center justify-center gap-2 
                                p-3 rounded-xl 
                                bg-bg/50 dark:bg-bg/30
                                border border-border/50 hover:border-primary/40
                                hover:bg-primary/10
                                hover:shadow-md hover:shadow-primary/5
                                active:scale-[0.97]
                                transition-all duration-200
                            "
                        >
                            {/* أيقونة مع خلفية متدرجة - متوافق مع الوضعين */}
                            <div className="
                                relative p-3 rounded-xl 
                                bg-primary/10
                                border border-primary/20
                                group-hover:bg-primary/20
                                group-hover:border-primary/30
                                group-hover:shadow-lg group-hover:shadow-primary/10
                                transition-all duration-200
                            ">
                                <action.icon
                                    size={28}
                                    className="text-primary"
                                    strokeWidth={1.5}
                                />
                            </div>

                            {/* اسم الإجراء */}
                            <span className="text-[11px] font-bold text-text-muted group-hover:text-primary transition-colors">
                                {action.label}
                            </span>

                            {/* اختصار لوحة المفاتيح - متوافق مع الوضعين */}
                            {action.shortcut && (
                                <div className="
                                    absolute top-1.5 right-1.5 
                                    px-1.5 py-0.5 rounded-md
                                    bg-bg border border-border
                                    opacity-50 group-hover:opacity-100 
                                    transition-opacity
                                ">
                                    <span className="text-[9px] font-mono font-bold text-text-muted">
                                        {action.shortcut}
                                    </span>
                                </div>
                            )}

                            {/* شارة التنبيه */}
                            {action.hasBadge && (
                                <span className="
                                    absolute top-2 left-2 
                                    w-2 h-2 
                                    bg-red-500 rounded-full 
                                    animate-pulse 
                                    shadow-lg shadow-red-500/50
                                " />
                            )}

                            {/* تأثير الحافة السفلية عند التحويم */}
                            <div className="
                                absolute bottom-0 left-2 right-2 h-0.5 
                                bg-gradient-to-r from-transparent via-primary to-transparent
                                opacity-0 group-hover:opacity-60
                                transition-opacity
                                rounded-full
                            " />
                        </button>
                    ))}
                </div>

                {/* خط سفلي */}
                <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>
        </div>
    );
});

QuickActionsBar.displayName = 'QuickActionsBar';
