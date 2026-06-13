/**
 * TabNav — التنقل بين التبويبات الموحد
 * يستبدل tabs في Finance, Inventory, Invoices
 */
import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';

export interface TabItem<T extends string = string> {
    id: T;
    label: string;
    icon?: LucideIcon;
}

interface TabNavProps<T extends string = string> {
    tabs: TabItem<T>[];
    active: T;
    onChange: (tab: T) => void;
    className?: string;
}

export const TabNav = memo(<T extends string>({
    tabs,
    active,
    onChange,
    className = '',
}: TabNavProps<T>) => (
    <div className={`border-b border-border p-2.5 flex gap-2 bg-bg/50 flex-wrap ${className}`}>
        {tabs.map(tab => {
            const Icon = tab.icon;
            return (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all touch-target active:scale-95 ${
                        active === tab.id
                            ? 'bg-primary text-primary-fg shadow-lg shadow-primary/20'
                            : 'bg-surface text-text-muted hover:text-text-main hover:bg-surface-hover border border-border'
                    }`}
                >
                    {Icon && <Icon size={18} />}
                    {tab.label}
                </button>
            );
        })}
    </div>
)) as <T extends string>(props: TabNavProps<T>) => React.ReactElement;
(TabNav as React.FC).displayName = 'TabNav';
