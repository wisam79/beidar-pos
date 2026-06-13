import React, { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CheckCircle2, AlertTriangle, XCircle, Info, LucideIcon } from 'lucide-react';

// ============ Interfaces ============
interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

interface SpotlightCardProps extends CardProps {
    spotlightColor?: string;
}

interface PageHeaderProps {
    title: string;
    icon: LucideIcon;
    description?: string;
    actions?: React.ReactNode;
    children?: React.ReactNode;
}

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

interface ModalProps {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

type BadgeType = 'success' | 'error' | 'warning' | 'info' | 'default' | 'completed' | 'returned' | 'pending';

// ============ Components ============

export const BeidarLogo = ({ className = "" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
);

export const Kbd = ({ children }: { children?: React.ReactNode }) => (
    <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded-md border border-border bg-white/5 px-1.5 font-mono text-[10px] font-bold text-text-muted shadow-sm">
        {children}
    </kbd>
);

export const useScanDetection = ({ onScan }: { onScan: (code: string) => void | Promise<unknown> }) => {
    useEffect(() => {
        let buffer = ""; let lastTime = 0;
        const onKeyDown = (e: KeyboardEvent) => {
            const now = Date.now();
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (now - lastTime > 50) buffer = "";
            lastTime = now;
            if (e.key === 'Enter') { if (buffer.length >= 3) { onScan(buffer); buffer = ""; } }
            else if (e.key.length === 1) { buffer += e.key; }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onScan]);
};

// Modern Glass Card with Native Depth
export const Card = memo(({ children, className = "", onClick }: CardProps) => (
    <div onClick={onClick} className={`card-native ${onClick ? 'cursor-pointer hover:border-primary/40' : ''} ${className}`}>
        {children}
    </div>
));
Card.displayName = 'Card';

// Spotlight Card - Premium Hover Effect
export const SpotlightCard = memo(({ children, className = "", spotlightColor = "rgba(255, 255, 255, 0.05)", onClick }: SpotlightCardProps) => {
    const divRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!divRef.current) return;
        const rect = divRef.current.getBoundingClientRect();
        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setOpacity(1);
    };

    return (
        <div
            ref={divRef}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setOpacity(0)}
            className={`relative bg-surface border border-border rounded-2xl transition-all duration-500 hover:shadow-2xl ${onClick ? 'cursor-pointer' : ''} ${className}`}
        >
            <div
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-500 rounded-2xl"
                style={{ opacity, background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)` }}
            />
            <div className="relative z-10 h-full">{children}</div>
        </div>
    );
});
SpotlightCard.displayName = 'SpotlightCard';

const badgeStyles: Record<BadgeType, string> = {
    success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
    error: 'bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
    info: 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]',
    default: 'bg-surface text-text-muted border-border',
    completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    returned: 'bg-red-500/10 text-red-500 border-red-500/20',
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
};

export const Badge = memo(({ type, text }: { type: BadgeType | string, text: string }) => {
    const styleClass = badgeStyles[type as BadgeType] || badgeStyles.info;
    return (
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1.5 w-fit select-none backdrop-blur-sm ${styleClass}`}>
            {type.includes('success') || type === 'completed' ? <CheckCircle2 size={12} /> : type.includes('warn') || type === 'pending' ? <AlertTriangle size={12} /> : type.includes('err') || type === 'returned' ? <XCircle size={12} /> : <Info size={12} />}
            {text}
        </span>
    );
});
Badge.displayName = 'Badge';

export const PageHeader = memo(({ title, icon: Icon, description, actions, children }: PageHeaderProps) => (
    <header className="shrink-0 flex flex-col gap-3 bg-surface/80 backdrop-blur-sm border border-border rounded-2xl p-3 lg:p-4 shadow-sm mb-4 w-full text-right">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
            {/* Right-to-Left (Arabic friendly) layout: Icon & Title */}
            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                    <Icon size={22} />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-text-main leading-tight">{title}</h1>
                    {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
                </div>
            </div>

            {/* Actions Section */}
            {actions && (
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    {actions}
                </div>
            )}
        </div>
        {children && <div className="w-full mt-1 border-t border-border/40 pt-3">{children}</div>}
    </header>
));
PageHeader.displayName = 'PageHeader';



export const EmptyState = memo(({ icon: Icon, title, description, action }: EmptyStateProps) => (
    <div className="flex flex-col items-center justify-center py-20 text-center h-full animate-fade-in">
        <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center text-text-muted mb-6 border border-border shadow-inner relative">
            <Icon size={40} strokeWidth={1.5} className="opacity-40" />
            <div className="absolute inset-0 border border-white/5 rounded-full"></div>
        </div>
        <h3 className="text-text-main font-bold text-lg mb-2">{title}</h3>
        <p className="text-text-muted text-sm max-w-xs mb-8 leading-relaxed font-medium opacity-70">{description}</p>
        {action}
    </div>
));
EmptyState.displayName = 'EmptyState';

export const Modal = memo(({ title, onClose, children, size = 'md' }: ModalProps) => {
    const maxWidth = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-4xl' : size === 'xl' ? 'max-w-6xl' : 'max-w-2xl';

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-lg transition-opacity duration-300 animate-in fade-in" />
            <div
                className={`
                    relative w-full ${maxWidth} 
                    bg-surface border border-border
                    rounded-3xl
                    flex flex-col max-h-[90vh] 
                    animate-scale-in
                    overflow-hidden
                `}
                style={{ boxShadow: 'var(--shadow-xl)' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="px-8 py-6 border-b border-border flex justify-between items-center shrink-0 bg-surface/98">
                    <h2 className="text-lg font-bold text-text-main tracking-tight">{title}</h2>
                    <div className="flex items-center gap-3">
                        <Kbd>ESC</Kbd>
                        <button onClick={onClose} title="إغلاق" aria-label="إغلاق" className="hover:bg-bg rounded-full p-1.5 text-text-muted hover:text-text-main transition-colors"><X size={20} /></button>
                    </div>
                </div>
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">{children}</div>
            </div>
        </div>,
        document.body
    );
});
Modal.displayName = 'Modal';

export const CountUp = ({ end }: { end: number }) => <span>{end}</span>;

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 PREMIUM DASHBOARD COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Animated Number Counter - Optimized for CPU performance
export const AnimatedNumber = memo(({ value, duration = 800, prefix = '', suffix = '' }: {
    value: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
}) => {
    const [displayValue, setDisplayValue] = useState(value);
    const animationRef = useRef<number | null>(null);
    const prevValue = useRef(value);

    useEffect(() => {
        // Skip animation if value hasn't changed or difference is negligible
        if (prevValue.current === value) {
            return;
        }

        const startValue = prevValue.current;
        const difference = value - startValue;

        // Skip animation for very small changes
        if (Math.abs(difference) < 1) {
            setDisplayValue(value);
            prevValue.current = value;
            return;
        }

        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out-expo)
            const eased = 1 - Math.pow(2, -10 * progress);
            const current = startValue + difference * eased;

            setDisplayValue(Math.round(current));

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                prevValue.current = value;
                animationRef.current = null;
            }
        };

        // Cancel any running animation before starting new one
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }

        animationRef.current = requestAnimationFrame(animate);

        // Cleanup on unmount
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [value, duration]);

    return (
        <span className="tabular-nums font-mono">
            {prefix}{displayValue.toLocaleString()}{suffix}
        </span>
    );
});
AnimatedNumber.displayName = 'AnimatedNumber';

// Glow Card with Animated Border
export const GlowCard = memo(({
    children,
    className = '',
    glowColor = 'var(--color-primary)',
    intensity = 'medium'
}: {
    children: React.ReactNode;
    className?: string;
    glowColor?: string;
    intensity?: 'low' | 'medium' | 'high';
}) => {
    const glowIntensity = {
        low: '0 0 20px',
        medium: '0 0 40px',
        high: '0 0 60px'
    };

    return (
        <div
            className={`relative rounded-2xl overflow-hidden group ${className}`}
            style={{
                boxShadow: `${glowIntensity[intensity]} ${glowColor}20`
            }}
        >
            {/* Animated gradient border */}
            <div
                className="absolute inset-0 rounded-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                    background: `linear-gradient(135deg, ${glowColor}40, transparent, ${glowColor}40)`,
                    padding: '1px'
                }}
            />
            <div className="absolute inset-[1px] rounded-2xl bg-surface" />
            <div className="relative z-10">{children}</div>
        </div>
    );
});
GlowCard.displayName = 'GlowCard';

// Shimmer Progress Bar - Optimized: stops animation at 100%
export const ShimmerBar = memo(({ progress, height = 8 }: { progress: number; height?: number }) => {
    const isComplete = progress >= 100;

    return (
        <div
            className="w-full rounded-full overflow-hidden relative"
            style={{ height, background: 'var(--color-bg)' }}
        >
            <div
                className="h-full rounded-full relative overflow-hidden transition-all duration-500 ease-out"
                style={{
                    width: `${Math.min(100, progress)}%`,
                    background: isComplete
                        ? 'var(--color-primary)'
                        : 'linear-gradient(90deg, var(--color-primary), #10b981, var(--color-primary))',
                    backgroundSize: isComplete ? 'auto' : '200% 100%',
                    animation: isComplete ? 'none' : 'shimmer 2s linear'
                }}
            >
                {/* Shimmer overlay - only animate when not complete */}
                {!isComplete && (
                    <div
                        className="absolute inset-0"
                        style={{
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                            animation: 'shimmer-slide 1.5s linear'
                        }}
                    />
                )}
            </div>
        </div>
    );
});
ShimmerBar.displayName = 'ShimmerBar';

// Pulse Indicator (Live/Active Status)
export const PulseIndicator = memo(({
    active = true,
    color = 'emerald',
    size = 'md',
    label
}: {
    active?: boolean;
    color?: 'emerald' | 'blue' | 'amber' | 'red';
    size?: 'sm' | 'md' | 'lg';
    label?: string;
}) => {
    const colors = {
        emerald: 'bg-emerald-500',
        blue: 'bg-blue-500',
        amber: 'bg-amber-500',
        red: 'bg-red-500'
    };

    const sizes = {
        sm: 'w-2 h-2',
        md: 'w-3 h-3',
        lg: 'w-4 h-4'
    };

    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <div className={`${sizes[size]} ${colors[color]} rounded-full`} />
                {active && (
                    <div
                        className={`absolute inset-0 ${colors[color]} rounded-full opacity-75`}
                        style={{
                            animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) 3',  // Only 3 pulses then stop
                        }}
                    />
                )}
            </div>
            {label && <span className="text-xs font-medium text-text-muted">{label}</span>}
        </div>
    );
});
PulseIndicator.displayName = 'PulseIndicator';

// Glass Panel
export const GlassPanel = memo(({
    children,
    className = '',
    blur = 'md',
    onClick
}: {
    children: React.ReactNode;
    className?: string;
    blur?: 'sm' | 'md' | 'lg';
    onClick?: () => void;
}) => {
    const blurClass = {
        sm: 'backdrop-blur-sm',
        md: 'backdrop-blur-md',
        lg: 'backdrop-blur-lg'
    };

    return (
        <div
            onClick={onClick}
            className={`
            ${blurClass[blur]}
            bg-surface/80
            border border-border/50
            rounded-2xl
            ${onClick ? 'cursor-pointer' : ''}
            ${className}
        `}>
            {children}
        </div>
    );
});
GlassPanel.displayName = 'GlassPanel';
