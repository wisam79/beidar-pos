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
    <div className={`flex border-b border-border bg-surface-hover/10 px-6 h-12 w-full select-none ${className}`}>
        <div className="flex gap-6 h-full items-center">
            {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = active === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={`relative h-full flex items-center gap-2 px-1 pb-0.5 text-xs font-black transition-all duration-200 touch-target focus:outline-none ${
                            isActive
                                ? 'text-primary'
                                : 'text-text-muted hover:text-text-main'
                        }`}
                    >
                        {Icon && <Icon size={14} className={isActive ? 'text-primary' : 'text-text-muted/80'} />}
                        <span>{tab.label}</span>
                        {isActive && (
                            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
                        )}
                    </button>
                );
            })}
        </div>
    </div>
)) as <T extends string>(props: TabNavProps<T>) => React.ReactElement;
(TabNav as React.FC).displayName = 'TabNav';
