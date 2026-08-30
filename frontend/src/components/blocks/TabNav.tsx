import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';

interface TabItem<T extends string = string> {
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
    <div className={`flex border-b border-border/80 bg-surface/60 px-3 h-13 w-full select-none shrink-0 overflow-x-auto no-scrollbar items-center ${className}`}>
        <div className="flex gap-2 h-full items-center">
            {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = active === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl text-xs md:text-sm font-extrabold transition-all pressable touch-target outline-none cursor-pointer ${
                            isActive
                                ? 'bg-primary text-primary-fg font-black shadow-sm'
                                : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                        }`}
                    >
                        {Icon && <Icon size={16} className={isActive ? 'text-primary-fg' : 'text-text-muted'} />}
                        <span>{tab.label}</span>
                    </button>
                );
            })}
        </div>
    </div>
)) as <T extends string>(props: TabNavProps<T>) => React.ReactElement;
(TabNav as React.FC).displayName = 'TabNav';
