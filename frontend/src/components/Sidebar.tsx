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
    Menu,
    LucideIcon,
} from '../lib/icons';
import { View } from '../core/types';
import { useAuth, Permissions } from '../core/AuthContext';
import { Tooltip } from './ds/Tooltip';
import { Badge } from './ds/Badge';

interface NavItem {
    id: View | 'ai';
    icon: LucideIcon;
    labelKey: string;
    permission?: string | null;
    badge?: number;
}

interface SidebarProps {
    active: View;
    setView: (view: View) => void;
    isOpen?: boolean;
    setIsOpen?: (open: boolean) => void;
    onToggleAI: () => void;
    onLogout?: () => void;
    lowStockCount?: number;
}

const NAV_ITEMS: NavItem[] = [
    { id: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    { id: 'sales', icon: ShoppingBag, labelKey: 'nav.sales', permission: Permissions.SALES },
    { id: 'products', icon: Package, labelKey: 'nav.products', permission: Permissions.PRODUCTS },
    { id: 'inventory', icon: Layers, labelKey: 'nav.inventory', permission: Permissions.INVENTORY, badge: 0 },
    { id: 'invoices', icon: FileText, labelKey: 'nav.invoices', permission: Permissions.INVOICES },
    { id: 'customers', icon: UserCircle2, labelKey: 'nav.customers', permission: Permissions.CUSTOMERS },
    { id: 'finance', icon: Wallet2, labelKey: 'nav.finance', permission: Permissions.FINANCE },
    { id: 'shifts', icon: Clock, labelKey: 'nav.shifts', permission: Permissions.FINANCE },
    { id: 'reports', icon: BarChart3, labelKey: 'nav.reports', permission: Permissions.REPORTS },
];

interface NavButtonProps {
    icon: LucideIcon;
    label: string;
    isActive?: boolean;
    onClick: () => void;
    variant?: 'default' | 'ai' | 'danger';
    badge?: number;
    isExpanded?: boolean;
}

const NavButton = React.memo(({ icon: Icon, label, isActive, onClick, variant = 'default', badge, isExpanded }: NavButtonProps) => {
    const base = 'relative flex items-center rounded-xl border transition-all duration-120 ease-out active:scale-95 touch-target';
    const size = isExpanded ? 'h-11 w-full px-3 justify-start gap-3' : 'h-11 w-11 justify-center';
    const variants = {
        default: isActive
            ? 'border-primary/15 bg-primary-dim text-primary shadow-xs'
            : 'border-transparent bg-transparent text-text-muted hover:border-border/80 hover:bg-surface-hover hover:text-text-main',
        ai: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 hover:border-indigo-500/35 hover:bg-indigo-500/20',
        danger: 'border-transparent bg-transparent text-text-muted hover:border-danger/20 hover:bg-danger-dim hover:text-danger',
    };

    const content = (
        <button
            type="button"
            onClick={onClick}
            className={`${base} ${size} ${variants[variant]}`}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
        >
            <Icon size={22} strokeWidth={isActive ? 2.2 : 1.9} className="shrink-0" />
            
            {isExpanded && (
                <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis text-right leading-none pt-1">
                    {label}
                </span>
            )}

            {isActive && !isExpanded && (
                <span className="absolute right-0 top-3 bottom-3 w-1 rounded-l bg-primary" />
            )}
            
            {badge !== undefined && badge > 0 && (
                <span className={`absolute flex h-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black text-white shadow-sm ${isExpanded ? 'left-3 top-1/2 -translate-y-1/2 min-w-5' : '-left-1 -top-1 min-w-5'}`}>
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
        </button>
    );

    if (isExpanded) {
        return content;
    }

    return (
        <Tooltip side="left" content={label}>
            {content}
        </Tooltip>
    );
});

NavButton.displayName = 'NavButton';

export const Sidebar = React.memo(({
    active,
    setView,
    onToggleAI,
    onLogout,
    lowStockCount = 0,
}: SidebarProps) => {
    const { t } = useTranslation();
    const { logout, hasPermission, isAdmin } = useAuth();
    const [isExpanded, setIsExpanded] = React.useState(false);

    const isAllowed = (permission: string | null | undefined): boolean => !permission || isAdmin || hasPermission(permission);

    const handleNavClick = (id: View) => setView(id);

    return (
        <aside className={`relative z-[40] flex h-full shrink-0 flex-col bg-sidebar border-l border-border py-3 transition-all duration-150 ease-out ${isExpanded ? 'w-56 items-stretch' : 'w-20 items-center'}`}>
            <div className={`flex w-full mb-2 ${isExpanded ? 'px-4 justify-end' : 'justify-center'}`}>
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors"
                    aria-label="Toggle Sidebar"
                >
                    <Menu size={20} />
                </button>
            </div>

            <nav className={`flex w-full flex-col gap-2 overflow-y-auto no-scrollbar py-2 ${isExpanded ? 'px-4' : 'px-3 items-center'}`}>
                {NAV_ITEMS.filter((item) => isAllowed(item.permission)).map((item) => (
                    <NavButton
                        key={item.id}
                        icon={item.icon}
                        label={t(item.labelKey)}
                        isActive={active === item.id}
                        onClick={() => handleNavClick(item.id as View)}
                        badge={item.id === 'inventory' ? lowStockCount : undefined}
                        isExpanded={isExpanded}
                    />
                ))}
            </nav>

            <div className={`mt-auto mb-2 h-px bg-border transition-all duration-150 ease-out ${isExpanded ? 'w-48 mx-auto' : 'w-10'}`} />

            <nav className={`flex w-full flex-col gap-2 pb-3 ${isExpanded ? 'px-4' : 'px-3 items-center'}`}>
                <NavButton
                    icon={Sparkles}
                    label={t('common.aiAssistant', 'المساعد الذكي')}
                    onClick={onToggleAI}
                    variant="ai"
                    isExpanded={isExpanded}
                />
                {isAllowed(Permissions.SETTINGS) && (
                    <NavButton
                        icon={Settings}
                        label={t('nav.settings')}
                        isActive={active === 'settings'}
                        onClick={() => handleNavClick('settings')}
                        isExpanded={isExpanded}
                    />
                )}
                <NavButton icon={LogOut} label={t('auth.logout')} onClick={() => { logout(); onLogout?.(); }} variant="danger" isExpanded={isExpanded} />
            </nav>
        </aside>
    );
});

Sidebar.displayName = 'Sidebar';
