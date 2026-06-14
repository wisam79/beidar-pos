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
    <div className={`p-1.5 flex gap-1.5 bg-surface-active/30 border border-border/80 rounded-full flex-wrap w-fit ${className}`}>
        {tabs.map(tab => {
            const Icon = tab.icon;
            return (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-black transition-all duration-300 ease-[var(--ease-spring)] touch-target active:scale-95 ${
                        active === tab.id
                            ? 'bg-primary text-primary-fg shadow-md shadow-primary/25'
                            : 'bg-transparent text-text-muted hover:text-text-main hover:bg-surface-hover'
                    }`}
                >
                    {Icon && <Icon size={16} />}
                    {tab.label}
                </button>
            );
        })}
    </div>
)) as <T extends string>(props: TabNavProps<T>) => React.ReactElement;
(TabNav as React.FC).displayName = 'TabNav';
