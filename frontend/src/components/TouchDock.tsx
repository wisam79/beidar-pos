import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    LayoutDashboard,
    ShoppingBag,
    Package,
    Layers,
    BarChart3,
    Settings,
    FileText,
    UserCircle2,
    Wallet2,
    Sparkles,
    LogOut,
    Clock,
    LucideIcon,
} from '../lib/icons';
import { View } from '../core/types';
import { useAuth, Permissions } from '../core/AuthContext';
import { Tooltip } from './ds/Tooltip';
import { cn } from '../theme/cn';

interface NavItem {
    id: View;
    icon: LucideIcon;
    labelKey: string;
    permission?: string | null;
    badge?: number;
    color?: string;
}

interface TouchDockProps {
    active: View;
    setView: (view: View) => void;
    onToggleAI: () => void;
    onLogout?: () => void;
    lowStockCount?: number;
    className?: string;
}

const NAV_ITEMS: NavItem[] = [
    { id: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', color: 'text-success' },
    { id: 'sales', icon: ShoppingBag, labelKey: 'nav.sales', permission: Permissions.SALES, color: 'text-primary' },
    { id: 'products', icon: Package, labelKey: 'nav.products', permission: Permissions.PRODUCTS, color: 'text-primary' },
    { id: 'inventory', icon: Layers, labelKey: 'nav.inventory', permission: Permissions.INVENTORY, color: 'text-warning' },
    { id: 'invoices', icon: FileText, labelKey: 'nav.invoices', permission: Permissions.INVOICES, color: 'text-success' },
    { id: 'customers', icon: UserCircle2, labelKey: 'nav.customers', permission: Permissions.CUSTOMERS, color: 'text-primary' },
    { id: 'finance', icon: Wallet2, labelKey: 'nav.finance', permission: Permissions.FINANCE, color: 'text-success' },
    { id: 'shifts', icon: Clock, labelKey: 'nav.shifts', permission: Permissions.FINANCE, color: 'text-primary' },
    { id: 'reports', icon: BarChart3, labelKey: 'nav.reports', permission: Permissions.REPORTS, color: 'text-primary' },
    { id: 'settings', icon: Settings, labelKey: 'nav.settings', permission: Permissions.SETTINGS, color: 'text-slate-400' },
];

export const TouchDock: React.FC<TouchDockProps> = React.memo(({
    active,
    setView,
    onToggleAI,
    onLogout,
    lowStockCount = 0,
    className = '',
}) => {
    const { t } = useTranslation();
    const { hasPermission, isAdmin } = useAuth();

    const isAllowed = (permission: string | null | undefined): boolean =>
        !permission || isAdmin || hasPermission(permission);

    return (
        <nav
            aria-label="Touch Navigation Dock"
            className={cn(
                'relative z-30 flex items-center justify-between gap-1.5 px-3 py-1.5 bg-sidebar/95 backdrop-blur-md border-t border-border/80 shadow-lg select-none',
                className
            )}
        >
            {/* Main Navigation Items - Horizontal Touch Friendly Bar */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {NAV_ITEMS.filter((item) => isAllowed(item.permission)).map((item) => {
                    const Icon = item.icon;
                    const isActive = active === item.id;
                    const label = t(item.labelKey);
                    const badge = item.id === 'inventory' ? lowStockCount : undefined;

                    return (
                        <Tooltip key={item.id} side="top" content={label}>
                            <button
                                type="button"
                                onClick={() => setView(item.id)}
                                className={cn(
                                    'group relative flex items-center gap-2 h-11 px-3.5 rounded-xl font-bold text-xs transition-all duration-150 active:scale-95 touch-target outline-none',
                                    isActive
                                        ? 'bg-primary text-primary-fg shadow-md shadow-primary/20 scale-[1.02]'
                                        : 'bg-surface/60 hover:bg-surface-hover text-text-muted hover:text-text-main border border-border/50'
                                )}
                                aria-label={label}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <Icon
                                    size={18}
                                    strokeWidth={isActive ? 2.4 : 2}
                                    className={cn('shrink-0 transition-transform group-hover:scale-110', !isActive && item.color)}
                                />
                                <span className={cn('whitespace-nowrap font-bold', isActive ? 'text-primary-fg' : 'text-text-main')}>
                                    {label}
                                </span>

                                {/* Low Stock / Notification Badge */}
                                {badge !== undefined && badge > 0 && (
                                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-black text-white shadow-sm animate-pulse">
                                        {badge > 9 ? '9+' : badge}
                                    </span>
                                )}

                                {/* Bottom active glow line */}
                                {isActive && (
                                    <span className="absolute -bottom-1 left-3 right-3 h-0.5 rounded-full bg-black/40" />
                                )}
                            </button>
                        </Tooltip>
                    );
                })}
            </div>

            {/* Quick Actions (AI Assistant & Logout) */}
            <div className="flex items-center gap-1.5 shrink-0 pl-1 border-r border-border/60 mr-1">
                {/* AI Assistant Quick Button */}
                <Tooltip side="top" content="المستشار الذكي (AI)">
                    <button
                        type="button"
                        onClick={onToggleAI}
                        className="flex items-center gap-1.5 h-11 px-3 rounded-xl bg-primary/15 hover:from-primary/25 hover:to-primary/25 border border-primary/30 text-primary font-bold text-xs transition-all active:scale-95 touch-target"
                        aria-label="المستشار الذكي"
                    >
                        <Sparkles size={16} className="text-primary animate-pulse" />
                        <span className="hidden sm:inline">الذكاء الاصطناعي</span>
                    </button>
                </Tooltip>

                {/* Logout Button */}
                {onLogout && (
                    <Tooltip side="top" content="تسجيل الخروج">
                        <button
                            type="button"
                            onClick={onLogout}
                            className="flex items-center justify-center w-11 h-11 rounded-xl bg-surface/60 hover:bg-danger/15 hover:text-danger hover:border-danger/30 border border-border/50 text-text-muted transition-all active:scale-95 touch-target"
                            aria-label="تسجيل الخروج"
                        >
                            <LogOut size={17} />
                        </button>
                    </Tooltip>
                )}
            </div>
        </nav>
    );
});

TouchDock.displayName = 'TouchDock';
