/**
 * Settings UI Components - Premium Touch-Optimized Design
 */
import React, { memo } from 'react';
import { Check, X, ChevronLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPONENT INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface SidebarItemProps {
    active: boolean;
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    badge?: string;
}



interface SettingInputProps {
    label: string;
    value: string | number;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    icon?: LucideIcon;
    suffix?: string;
    help?: string;
    error?: string;
}

interface SettingToggleProps {
    label: string;
    description?: string;
    value: boolean;
    onChange: (value: boolean) => void;
    icon?: LucideIcon;
}

interface FeatureCardProps {
    icon: LucideIcon;
    title: string;
    color?: string;
}

interface InfoRowProps {
    label: string;
    value: React.ReactNode;
    last?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 UI COMPONENTS - Simplified Desktop Touch Standard
// ═══════════════════════════════════════════════════════════════════════════════

export const SidebarItem = memo(({ active, icon: Icon, label, onClick, badge }: SidebarItemProps) => (
    <button
        type="button"
        onClick={onClick}
        className={`
            w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-xl 
            transition-all duration-150 font-bold text-xs group 
            border relative overflow-hidden select-none cursor-pointer active:scale-[0.98]
            ${active
                ? 'bg-primary/10 text-primary border-primary/30 font-black shadow-3xs'
                : 'bg-transparent text-text-muted border-transparent hover:border-border/60 hover:bg-surface-hover/80 hover:text-text-main'
            }
        `}
    >
        {/* Active Indicator Bar (RTL Start / Right Side) */}
        {active && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-l-full shadow-sm shadow-primary/40" />
        )}

        {/* Icon */}
        {Icon && (
            <div className={`
                p-1.5 rounded-lg transition-all shrink-0
                ${active
                    ? 'bg-primary text-primary-fg shadow-sm shadow-primary/30'
                    : 'bg-surface-hover/80 text-text-muted group-hover:text-primary group-hover:bg-primary/10'
                }
            `}>
                <Icon size={15} />
            </div>
        )}

        {/* Label */}
        <span className="flex-1 text-right truncate font-bold text-xs">{label}</span>

        {/* Chevron for active */}
        {active && <ChevronLeft size={14} className="text-primary shrink-0 opacity-80" strokeWidth={2.5} />}

        {/* Badge */}
        {badge && (
            <span className="bg-danger text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                {badge}
            </span>
        )}
    </button>
));
SidebarItem.displayName = 'SidebarItem';

export const SettingInput = memo(({ label, value, onChange, type = "text", placeholder, icon: Icon, suffix, help, error }: SettingInputProps) => (
    <div className="group space-y-1.5">
        {/* Label Row */}
        <label className="flex items-center gap-2 text-text-muted text-xs font-bold px-1">
            {Icon && <Icon size={14} className="text-primary" />}
            <span>{label}</span>
            {help && <span className="opacity-60 font-semibold text-[10px]">({help})</span>}
        </label>

        {/* Input Container */}
        <div className="relative">
            <input
                type={type}
                className={`
                    w-full min-h-[46px] bg-bg/80 dark:bg-black/30 border rounded-xl py-2.5 px-3.5 
                    outline-none transition-all duration-150
                    font-bold text-xs sm:text-sm text-text-main
                    placeholder:text-text-muted/40
                    focus:border-primary focus:ring-2 focus:ring-primary/15 focus:bg-surface
                    touch-target
                    ${error ? 'border-danger bg-danger/5' : 'border-border/80 hover:border-border'}
                    ${suffix ? 'pl-16' : ''}
                `}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
            />

            {/* Suffix Badge */}
            {suffix && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs font-bold bg-surface-hover px-2 py-0.5 rounded-lg border border-border/80">
                    {suffix}
                </span>
            )}
        </div>

        {/* Error Message */}
        {error && (
            <p className="text-danger text-xs font-bold flex items-center gap-1 px-1 mt-1">
                <X size={12} />
                {error}
            </p>
        )}
    </div>
));
SettingInput.displayName = 'SettingInput';

export const SettingToggle = memo(({ label, description, value, onChange, icon: Icon }: SettingToggleProps) => (
    <div
        className={`
            flex justify-between items-center p-3.5 sm:p-4 rounded-xl border 
            transition-all duration-150 cursor-pointer group 
            active:scale-[0.99] touch-target select-none shadow-3xs
            ${value
                ? 'bg-primary/5 border-primary/30 shadow-sm shadow-primary/5'
                : 'bg-surface border-border/80 hover:border-border hover:bg-surface-hover/80'
            }
        `}
        onClick={() => onChange(!value)}
    >
        <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Icon Container */}
            {Icon && (
                <div className={`
                    p-2 rounded-xl transition-all shrink-0
                    ${value
                        ? 'bg-primary text-primary-fg shadow-sm shadow-primary/20'
                        : 'bg-surface-hover text-text-muted group-hover:text-primary group-hover:bg-primary/10'
                    }
                `}>
                    <Icon size={18} />
                </div>
            )}

            {/* Text */}
            <div className="min-w-0 flex-1">
                <h4 className={`font-bold text-xs transition-colors ${value ? 'text-primary' : 'text-text-main'}`}>
                    {label}
                </h4>
                {description && (
                    <p className="text-[11px] text-text-muted font-medium mt-0.5 leading-tight truncate">{description}</p>
                )}
            </div>
        </div>

        {/* Toggle Switch (Modern WinUI 3 / iOS Pill) */}
        <div className={`
            relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 border ml-2
            ${value ? 'bg-primary border-primary' : 'bg-surface-active border-border/80'}
        `}>
            <div
                className={`
                    absolute top-0.5 w-4.5 h-4.5 rounded-full 
                    transition-all duration-200 ease-out 
                    flex items-center justify-center shadow-sm
                    ${value ? 'right-0.5 bg-primary-fg' : 'right-[calc(100%-20px)] bg-white dark:bg-text-muted'}
                `}
            >
                {value ? (
                    <Check size={11} className="text-primary" strokeWidth={3.5} />
                ) : (
                    <X size={9} className="text-text-muted" strokeWidth={3} />
                )}
            </div>
        </div>
    </div>
));
SettingToggle.displayName = 'SettingToggle';

export const FeatureCard = memo(({ icon: Icon, title }: FeatureCardProps) => (
    <div className="bg-surface border border-border/80 p-4 rounded-2xl text-center hover:border-primary/40 transition-all cursor-default group shadow-3xs">
        <Icon size={22} className="text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
        <h6 className="font-bold text-text-main text-xs">{title}</h6>
    </div>
));
FeatureCard.displayName = 'FeatureCard';

export const InfoRow = memo(({ label, value, last }: InfoRowProps) => (
    <div className={`flex justify-between items-center py-3 px-2 rounded-xl transition-colors hover:bg-surface-hover/60 ${!last ? 'border-b border-border/40' : ''}`}>
        <span className="text-text-muted text-xs font-bold">{label}</span>
        <span className="text-text-main font-mono font-bold text-xs">{value}</span>
    </div>
));
InfoRow.displayName = 'InfoRow';
