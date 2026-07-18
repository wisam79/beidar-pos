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
    description: string;
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
// 🎨 PREMIUM UI COMPONENTS - Touch Optimized
// ═══════════════════════════════════════════════════════════════════════════════

export const SidebarItem = memo(({ active, icon: Icon, label, onClick, badge }: SidebarItemProps) => (
    <button
        onClick={onClick}
        className={`
            w-full flex items-center gap-2 px-3 py-2.5 rounded-lg 
            transition-all duration-200 font-bold text-xs group 
            border relative overflow-hidden
            ${active
                ? 'bg-gradient-to-r from-primary to-emerald-500 text-black shadow-md shadow-primary/20 border-primary'
                : 'bg-surface text-text-muted border-transparent hover:border-primary/20 hover:bg-surface-hover hover:text-text-main active:scale-[0.98]'
            }
        `}
    >
        {/* Active Indicator Glow */}
        {active && (
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent pointer-events-none" />
        )}

        {/* Chevron for active */}
        {active && <ChevronLeft size={14} className="text-black shrink-0" strokeWidth={3} />}

        {/* Label */}
        <span className="flex-1 text-right truncate">{label}</span>

        {/* Icon */}
        {Icon && (
            <div className={`
                p-1.5 rounded-md transition-all shrink-0
                ${active
                    ? 'bg-black/20 text-black'
                    : 'bg-surface-hover text-text-muted group-hover:text-primary group-hover:bg-primary/10'
                }
            `}>
                <Icon size={16} />
            </div>
        )}

        {/* Badge */}
        {badge && (
            <span className="absolute top-1 left-1 bg-red-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-full">
                {badge}
            </span>
        )}
    </button>
));
SidebarItem.displayName = 'SidebarItem';



export const SettingInput = memo(({ label, value, onChange, type = "text", placeholder, icon: Icon, suffix, help, error }: SettingInputProps) => (
    <div className="group">
        {/* Label Row */}
        <label className="flex items-center gap-2 text-text-muted text-xs font-bold mb-2.5 px-1">
            {Icon && <Icon size={14} className="text-primary" />}
            <span>{label}</span>
            {help && <span className="opacity-50 font-medium text-[10px]">({help})</span>}
        </label>

        {/* Input Container */}
        <div className="relative">
            <input
                type={type}
                className={`
                    w-full bg-input-bg border-2 rounded-lg py-4 px-4 
                    outline-none transition-all duration-200
                    font-bold text-sm text-text-main
                    placeholder:text-text-muted/40
                    focus:border-primary focus:shadow-[0_0_20px_rgba(52,211,153,0.15)]
                    touch-target
                    ${error ? 'border-red-500 bg-red-500/5' : 'border-border hover:border-primary/30'}
                    ${suffix ? 'pl-16' : ''}
                `}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
            />

            {/* Suffix Badge */}
            {suffix && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs font-bold bg-surface px-2.5 py-1.5 rounded-lg border border-border">
                    {suffix}
                </span>
            )}
        </div>

        {/* Error Message */}
        {error && (
            <p className="text-red-500 text-xs mt-2 font-bold flex items-center gap-1 px-1">
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
            flex justify-between items-center p-5 rounded-lg border-2 
            transition-all duration-300 cursor-pointer group 
            active:scale-[0.98] touch-target
            ${value
                ? 'bg-primary/5 border-primary/40 shadow-lg shadow-primary/10'
                : 'bg-surface border-border hover:border-primary/30 hover:bg-surface-hover'
            }
        `}
        onClick={() => onChange(!value)}
    >
        <div className="flex items-center gap-4">
            {/* Icon Container */}
            {Icon && (
                <div className={`
                    p-3.5 rounded-lg transition-all duration-300
                    ${value
                        ? 'bg-primary text-primary-fg shadow-lg shadow-primary/30'
                        : 'bg-surface-hover text-text-muted group-hover:bg-primary/10 group-hover:text-primary'
                    }
                `}>
                    <Icon size={22} />
                </div>
            )}

            {/* Text */}
            <div>
                <h4 className={`font-bold text-base mb-1 transition-colors ${value ? 'text-primary' : 'text-text-main'}`}>
                    {label}
                </h4>
                <p className="text-xs text-text-muted leading-relaxed max-w-[280px]">{description}</p>
            </div>
        </div>

        {/* Toggle Switch */}
        <div className={`
            relative w-14 h-8 rounded-full transition-all duration-300 shrink-0
            ${value ? 'bg-primary shadow-lg shadow-primary/40' : 'bg-gray-500/30'}
        `}>
            <div
                className={`
                    absolute top-1 w-6 h-6 bg-white rounded-full 
                    shadow-md transition-all duration-300 ease-out 
                    flex items-center justify-center
                    ${value ? 'right-1' : 'right-[calc(100%-28px)]'}
                `}
            >
                {value ? (
                    <Check size={14} className="text-primary" strokeWidth={3} />
                ) : (
                    <X size={12} className="text-gray-400" strokeWidth={2.5} />
                )}
            </div>
        </div>
    </div>
));
SettingToggle.displayName = 'SettingToggle';

export const FeatureCard = memo(({ icon: Icon, title }: FeatureCardProps) => (
    <div className="bg-surface border border-border p-5 rounded-lg text-center hover:scale-105 hover:border-primary/30 transition-all cursor-default group">
        <Icon size={28} className="text-primary mx-auto mb-2 group-hover:animate-bounce" />
        <h6 className="font-bold text-text-main text-xs">{title}</h6>
    </div>
));
FeatureCard.displayName = 'FeatureCard';

export const InfoRow = memo(({ label, value, last }: InfoRowProps) => (
    <div className={`flex justify-between items-center py-4 px-2 rounded-lg transition-colors hover:bg-surface-hover ${!last ? 'border-b border-border' : ''}`}>
        <span className="text-text-muted text-sm font-bold">{label}</span>
        <span className="text-text-main font-bold">{value}</span>
    </div>
));
InfoRow.displayName = 'InfoRow';
