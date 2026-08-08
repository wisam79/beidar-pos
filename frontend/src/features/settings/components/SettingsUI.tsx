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
            w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl 
            transition-colors duration-150 font-black text-xs group 
            border relative overflow-hidden select-none cursor-pointer active:scale-[0.98]
            ${active
                ? 'bg-emerald-500 text-black border-emerald-400 font-black'
                : 'bg-surface text-text-muted border-border/60 hover:border-border hover:bg-surface-hover hover:text-text-main'
            }
        `}
    >
        {/* Icon */}
        {Icon && (
            <div className={`
                p-1.5 rounded-lg transition-colors shrink-0
                ${active
                    ? 'bg-black/15 text-black'
                    : 'bg-surface-hover text-text-muted group-hover:text-emerald-400'
                }
            `}>
                <Icon size={16} />
            </div>
        )}

        {/* Label */}
        <span className="flex-1 text-right truncate font-extrabold">{label}</span>

        {/* Chevron for active */}
        {active && <ChevronLeft size={16} className="text-black shrink-0" strokeWidth={3} />}

        {/* Badge */}
        {badge && (
            <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                {badge}
            </span>
        )}
    </button>
));
SidebarItem.displayName = 'SidebarItem';

export const SettingInput = memo(({ label, value, onChange, type = "text", placeholder, icon: Icon, suffix, help, error }: SettingInputProps) => (
    <div className="group">
        {/* Label Row */}
        <label className="flex items-center gap-2 text-text-muted text-xs font-extrabold mb-2 px-1">
            {Icon && <Icon size={14} className="text-emerald-400" />}
            <span>{label}</span>
            {help && <span className="opacity-60 font-semibold text-[10px]">({help})</span>}
        </label>

        {/* Input Container */}
        <div className="relative">
            <input
                type={type}
                className={`
                    w-full min-h-[48px] bg-input-bg border rounded-xl py-3 px-4 
                    outline-none transition-colors duration-150
                    font-black text-sm text-text-main
                    placeholder:text-text-muted/40
                    focus:border-emerald-400
                    touch-target
                    ${error ? 'border-red-500 bg-red-500/5' : 'border-border/80 hover:border-border'}
                    ${suffix ? 'pl-16' : ''}
                `}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
            />

            {/* Suffix Badge */}
            {suffix && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs font-black bg-surface px-2.5 py-1 rounded-lg border border-border/80">
                    {suffix}
                </span>
            )}
        </div>

        {/* Error Message */}
        {error && (
            <p className="text-red-400 text-xs mt-1.5 font-bold flex items-center gap-1 px-1">
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
            flex justify-between items-center p-4 sm:p-5 rounded-2xl border 
            transition-colors duration-150 cursor-pointer group 
            active:scale-[0.98] touch-target select-none
            ${value
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-surface border-border/80 hover:border-border hover:bg-surface-hover'
            }
        `}
        onClick={() => onChange(!value)}
    >
        <div className="flex items-center gap-3.5">
            {/* Icon Container */}
            {Icon && (
                <div className={`
                    p-3 rounded-xl transition-colors shrink-0
                    ${value
                        ? 'bg-emerald-500 text-black'
                        : 'bg-surface-hover text-text-muted group-hover:text-emerald-400'
                    }
                `}>
                    <Icon size={20} />
                </div>
            )}

            {/* Text */}
            <div>
                <h4 className={`font-black text-sm mb-0.5 transition-colors ${value ? 'text-emerald-400' : 'text-text-main'}`}>
                    {label}
                </h4>
                <p className="text-xs text-text-muted leading-relaxed font-semibold max-w-[280px] sm:max-w-md">{description}</p>
            </div>
        </div>

        {/* Toggle Switch */}
        <div className={`
            relative w-12 h-7 rounded-full transition-colors duration-200 shrink-0 border
            ${value ? 'bg-emerald-500 border-emerald-400' : 'bg-surface-hover border-border/80'}
        `}>
            <div
                className={`
                    absolute top-0.5 w-5 h-5 rounded-full 
                    transition-all duration-200 ease-out 
                    flex items-center justify-center
                    ${value ? 'right-0.5 bg-black' : 'right-[calc(100%-22px)] bg-text-muted'}
                `}
            >
                {value ? (
                    <Check size={12} className="text-emerald-400" strokeWidth={3.5} />
                ) : (
                    <X size={10} className="text-black" strokeWidth={3} />
                )}
            </div>
        </div>
    </div>
));
SettingToggle.displayName = 'SettingToggle';

export const FeatureCard = memo(({ icon: Icon, title }: FeatureCardProps) => (
    <div className="bg-surface border border-border/80 p-4 rounded-2xl text-center hover:border-emerald-500/40 transition-colors cursor-default group">
        <Icon size={24} className="text-emerald-400 mx-auto mb-2" />
        <h6 className="font-extrabold text-text-main text-xs">{title}</h6>
    </div>
));
FeatureCard.displayName = 'FeatureCard';

export const InfoRow = memo(({ label, value, last }: InfoRowProps) => (
    <div className={`flex justify-between items-center py-3.5 px-2 rounded-xl transition-colors hover:bg-surface-hover ${!last ? 'border-b border-border/40' : ''}`}>
        <span className="text-text-muted text-xs font-extrabold">{label}</span>
        <span className="text-text-main font-black text-xs">{value}</span>
    </div>
));
InfoRow.displayName = 'InfoRow';
