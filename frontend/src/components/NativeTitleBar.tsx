import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Sun,
    Moon,
    Sparkles,
    LogOut,
} from 'lucide-react';
import { WindowMinimise, WindowToggleMaximise, WindowIsMaximised, Quit as WindowClose } from '../../wailsjs/runtime/runtime';
import { View } from '../core/types';
import { useAuth, Permissions } from '../core/AuthContext';
import { Tooltip } from './ds/Tooltip';
import { cn } from '../theme/cn';

interface NativeTitleBarProps {
    theme?: 'light' | 'dark';
    onToggleTheme?: () => void;
    currentUser?: { name: string; username?: string } | null;
    appVersion?: string;
    activeView?: View;
    onNavigate?: (view: View) => void;
    onToggleAI?: () => void;
    onLogout?: () => void;
    lowStockCount?: number;
}

interface NavItem {
    id: View;
    labelKey: string;
    permission?: string | null;
}

const NAV_ITEMS: NavItem[] = [
    { id: 'dashboard', labelKey: 'nav.dashboard' },
    { id: 'sales', labelKey: 'nav.sales', permission: Permissions.SALES },
    { id: 'products', labelKey: 'nav.products', permission: Permissions.PRODUCTS },
    { id: 'inventory', labelKey: 'nav.inventory', permission: Permissions.INVENTORY },
    { id: 'invoices', labelKey: 'nav.invoices', permission: Permissions.INVOICES },
    { id: 'customers', labelKey: 'nav.customers', permission: Permissions.CUSTOMERS },
    { id: 'finance', labelKey: 'nav.finance', permission: Permissions.FINANCE },
    { id: 'shifts', labelKey: 'nav.shifts', permission: Permissions.FINANCE },
    { id: 'reports', labelKey: 'nav.reports', permission: Permissions.REPORTS },
    { id: 'settings', labelKey: 'nav.settings', permission: Permissions.SETTINGS },
];

export const NativeTitleBar: React.FC<NativeTitleBarProps> = ({
    theme,
    onToggleTheme,
    appVersion,
    activeView,
    onNavigate,
    onToggleAI,
    onLogout,
    lowStockCount = 0
}) => {
    const { t } = useTranslation();
    const { hasPermission, isAdmin } = useAuth();
    const [isMaximized, setIsMaximized] = useState(false);

    const checkMaximizedState = useCallback(async () => {
        try {
            if (typeof WindowIsMaximised === 'function') {
                const max = await WindowIsMaximised();
                setIsMaximized(max);
                return;
            }
        } catch {
            // fallback to screen comparison
        }
        const isMax = window.outerWidth >= window.screen.availWidth && window.outerHeight >= window.screen.availHeight;
        setIsMaximized(isMax);
    }, []);

    useEffect(() => {
        checkMaximizedState();
        window.addEventListener('resize', checkMaximizedState);
        return () => window.removeEventListener('resize', checkMaximizedState);
    }, [checkMaximizedState]);

    const handleMinimize = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        try {
            WindowMinimise();
        } catch (err) {
            console.error('Failed to minimize window:', err);
        }
    };

    const handleMaximize = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        try {
            WindowToggleMaximise();
            setTimeout(checkMaximizedState, 120);
        } catch (err) {
            console.error('Failed to toggle maximize window:', err);
        }
    };

    const handleClose = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        try {
            WindowClose();
        } catch (err) {
            console.error('Failed to close window:', err);
        }
    };

    const isAllowed = (permission: string | null | undefined): boolean =>
        !permission || isAdmin || hasPermission(permission);

    return (
        <header
            dir="rtl"
            className={cn(
                "title-bar-draggable bg-surface/95 backdrop-blur-md border-b border-border/70 flex items-center justify-between select-none z-[50] shrink-0 w-full relative text-sm pr-4 pl-0 transition-all duration-200 shadow-2xs",
                onNavigate ? "h-14" : "h-10"
            )}
            onDoubleClick={handleMaximize}
        >
            {/* 1. App Navigation / Brand Content (RTL Right Side) */}
            <div className="flex items-center gap-3 h-full min-w-0 flex-1 overflow-hidden">
                {onNavigate ? (
                    /* Segmented Navigation Tab Control */
                    <nav className="flex items-center gap-1.5 h-full title-bar-controls overflow-x-auto no-scrollbar py-1">
                        {NAV_ITEMS.filter((item) => isAllowed(item.permission)).map((item) => {
                            const isActive = activeView === item.id;
                            const label = t(item.labelKey);
                            const badge = item.id === 'inventory' ? lowStockCount : undefined;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onNavigate(item.id);
                                    }}
                                    className={cn(
                                        'relative flex items-center justify-center h-10 px-4 rounded-xl font-bold text-xs transition-all shrink-0 active:scale-95 touch-target outline-none shadow-3xs',
                                        isActive
                                            ? 'bg-primary text-primary-fg font-black text-sm shadow-sm shadow-primary/20 ring-1 ring-white/20'
                                            : 'text-text-muted hover:text-text-main hover:bg-surface-hover/90'
                                    )}
                                    title={label}
                                >
                                    <span>{label}</span>

                                    {/* Low Stock Badge */}
                                    {badge !== undefined && badge > 0 && (
                                        <span className="absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-black text-white shadow-sm animate-pulse">
                                            {badge > 9 ? '9+' : badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                ) : (
                    /* Brand Identity Header when no navigation tabs exist (Login/License/CloudAuth) */
                    <div className="flex items-center gap-2.5 px-1 title-bar-draggable">
                        <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xs shadow-3xs">
                            B
                        </div>
                        <span className="font-bold text-xs text-text-main tracking-tight">Beidar POS</span>
                        <span className="text-[10px] font-mono text-text-muted bg-surface-active/80 px-2 py-0.5 rounded-full border border-border/50">
                            {appVersion || 'v2.0.8'}
                        </span>
                    </div>
                )}
            </div>

            {/* 2. Action Buttons & Windows 11 Caption Controls (RTL Left Side) */}
            <div className="flex items-center h-full shrink-0 title-bar-controls">
                
                {/* Action Icons (Theme, AI, Logout) */}
                <div className="flex items-center gap-1.5 px-2">
                    {onToggleAI && (
                        <Tooltip side="bottom" content="المستشار الذكي (AI)">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleAI();
                                }}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface border border-border/80 text-text-muted hover:bg-surface-hover hover:text-success transition-all shadow-3xs outline-none active:scale-95 touch-target"
                                aria-label="المستشار الذكي"
                            >
                                <Sparkles size={16} className="text-success" />
                            </button>
                        </Tooltip>
                    )}

                    {onToggleTheme && (
                        <button
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface border border-border/80 text-text-muted hover:bg-surface-hover hover:text-text-main transition-all shadow-3xs outline-none active:scale-95"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleTheme();
                            }}
                            title={theme === 'dark' ? "الوضع الفاتح" : "الوضع الداكن"}
                            aria-label="تبديل المظهر"
                        >
                            {theme === 'dark' ? (
                                <Sun size={16} className="text-warning" />
                            ) : (
                                <Moon size={16} className="text-primary" />
                            )}
                        </button>
                    )}

                    {onLogout && (
                        <Tooltip side="bottom" content="تسجيل الخروج">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onLogout();
                                }}
                                className="flex items-center justify-center w-9 h-9 rounded-xl bg-surface/80 hover:bg-danger/15 hover:text-danger hover:border-danger/30 border border-border/60 text-text-muted transition-all active:scale-95 touch-target"
                                aria-label="تسجيل الخروج"
                            >
                                <LogOut size={16} />
                            </button>
                        </Tooltip>
                    )}
                </div>

                {/* Windows 11 Native Height Caption Controls (Close X at Outer Corner Edge) */}
                <div dir="ltr" className="title-bar-controls flex items-center h-full border-r border-border/40 select-none">
                    {/* Close Button (X - Far Corner Edge) */}
                    <button
                        className="w-[46px] h-full flex items-center justify-center text-text-muted hover:text-white hover:bg-[#c42b1c] active:bg-[#982318] transition-colors duration-150 outline-none"
                        onClick={handleClose}
                        title="إغلاق"
                        aria-label="إغلاق"
                    >
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                    </button>

                    {/* Maximize / Restore Button */}
                    <button
                        className="w-[46px] h-full flex items-center justify-center text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15 transition-colors duration-150 outline-none"
                        onClick={handleMaximize}
                        title={isMaximized ? "استعادة للأسفل" : "تكبير"}
                        aria-label={isMaximized ? "استعادة للأسفل" : "تكبير"}
                    >
                        {isMaximized ? (
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                <path d="M2.5 2.5V0.5H10.5V8.5H8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
                                <rect x="0.5" y="2.5" width="8" height="8" stroke="currentColor" strokeWidth="1" />
                            </svg>
                        ) : (
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                <rect x="0.5" y="0.5" width="10" height="10" stroke="currentColor" strokeWidth="1" />
                            </svg>
                        )}
                    </button>

                    {/* Minimize Button */}
                    <button
                        className="w-[46px] h-full flex items-center justify-center text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15 transition-colors duration-150 outline-none"
                        onClick={handleMinimize}
                        title="تصغير"
                        aria-label="تصغير"
                    >
                        <svg width="11" height="1" viewBox="0 0 11 1" fill="currentColor">
                            <rect width="11" height="1" rx="0.5" />
                        </svg>
                    </button>
                </div>
            </div>
        </header>
    );
};

