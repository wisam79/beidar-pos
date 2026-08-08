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
    currentUser,
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
            className="title-bar-draggable h-18 bg-surface/95 backdrop-blur-md border-b border-border/80 flex items-center justify-between select-none z-[50] shrink-0 w-full relative text-sm pr-4 pl-0 transition-colors shadow-2xs"
            onDoubleClick={handleMaximize}
        >
            {/* 1. Main Navigation Segment (RTL Right) */}
            <div className="flex items-center gap-2.5 h-full min-w-0 flex-1 overflow-x-auto no-scrollbar py-2 title-bar-controls">
                
                {/* Segmented Navigation Tab Control - Large Spacious Pills */}
                {onNavigate && (
                    <nav className="flex items-center gap-2">
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
                                        'relative flex items-center justify-center h-12 px-5 rounded-2xl font-bold text-sm transition-all shrink-0 active:scale-95 touch-target outline-none shadow-3xs',
                                        isActive
                                            ? 'bg-primary text-black font-black text-base shadow-md shadow-emerald-500/20 ring-1 ring-white/20'
                                            : 'text-text-muted hover:text-text-main hover:bg-surface-hover/90'
                                    )}
                                    title={label}
                                >
                                    <span>{label}</span>

                                    {/* Low Stock Badge */}
                                    {badge !== undefined && badge > 0 && (
                                        <span className="absolute -top-1.5 -left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-black text-white shadow-sm animate-pulse">
                                            {badge > 9 ? '9+' : badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                )}
            </div>

            {/* 2. Action Indicators & Full-Height Caption Controls (RTL Left) */}
            <div className="flex items-center gap-3 shrink-0 h-full title-bar-controls">
                
                {/* AI Assistant Quick Button - Large Icon */}
                {onToggleAI && (
                    <Tooltip side="bottom" content="المستشار الذكي (AI)">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleAI();
                            }}
                            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-surface border border-border/80 text-text-muted hover:bg-surface-hover hover:text-emerald-400 transition-all shadow-3xs outline-none active:scale-95 touch-target"
                            aria-label="المستشار الذكي"
                        >
                            <Sparkles size={20} className="text-emerald-400" />
                        </button>
                    </Tooltip>
                )}

                {/* Theme Toggle Button - Large */}
                {onToggleTheme && (
                    <button
                        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-surface border border-border/80 text-text-muted hover:bg-surface-hover hover:text-text-main transition-all shadow-3xs outline-none active:scale-95"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleTheme();
                        }}
                        title={theme === 'dark' ? "الوضع الفاتح" : "الوضع الداكن"}
                        aria-label="تبديل المظهر"
                    >
                        {theme === 'dark' ? (
                            <Sun size={20} className="text-amber-400" />
                        ) : (
                            <Moon size={20} className="text-primary" />
                        )}
                    </button>
                )}

                {/* Logout Button - Large */}
                {onLogout && (
                    <Tooltip side="bottom" content="تسجيل الخروج">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onLogout();
                            }}
                            className="flex items-center justify-center w-12 h-12 rounded-2xl bg-surface/80 hover:bg-danger/15 hover:text-danger hover:border-danger/30 border border-border/60 text-text-muted transition-all active:scale-95 touch-target mr-1"
                            aria-label="تسجيل الخروج"
                        >
                            <LogOut size={20} />
                        </button>
                    </Tooltip>
                )}

                {/* Windows 11 Native Height Caption Controls */}
                <div className="title-bar-controls flex items-center h-full border-r border-border/80 ml-0 pl-0">
                    {/* Minimize */}
                    <button
                        className="w-14 h-full flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors duration-100 outline-none"
                        onClick={handleMinimize}
                        title="تصغير"
                        aria-label="تصغير"
                    >
                        <svg width="14" height="2" viewBox="0 0 14 2" fill="currentColor">
                            <rect width="14" height="2" rx="1" />
                        </svg>
                    </button>

                    {/* Maximize / Restore */}
                    <button
                        className="w-14 h-full flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors duration-100 outline-none"
                        onClick={handleMaximize}
                        title={isMaximized ? "استعادة للأسفل" : "تكبير"}
                        aria-label={isMaximized ? "استعادة للأسفل" : "تكبير"}
                    >
                        {isMaximized ? (
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
                                <rect x="3.5" y="1.5" width="8" height="8" rx="1" />
                                <polyline points="1.5,4.5 1.5,11.5 8.5,11.5" />
                            </svg>
                        ) : (
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
                                <rect x="1.5" y="1.5" width="10" height="10" rx="1.5" />
                            </svg>
                        )}
                    </button>

                    {/* Close */}
                    <button
                        className="w-14 h-full flex items-center justify-center text-text-muted hover:bg-danger hover:text-white transition-colors duration-100 outline-none"
                        onClick={handleClose}
                        title="إغلاق"
                        aria-label="إغلاق"
                    >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <line x1="1.5" y1="1.5" x2="11.5" y2="11.5" />
                            <line x1="11.5" y1="1.5" x2="1.5" y2="11.5" />
                        </svg>
                    </button>
                </div>
            </div>
        </header>
    );
};

