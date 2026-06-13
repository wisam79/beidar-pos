import React from 'react';
import { useTranslation } from 'react-i18next';
import { differenceInDays } from 'date-fns';
import {
    LayoutDashboard, ShoppingBag, Package, Layers, BarChart3,
    Settings, FileText, UserCircle2, Wallet2, Sparkles, LogOut, LucideIcon, Clock, AlertCircle
} from 'lucide-react';
import { View } from '../core/types';
import { useAuth, Permissions } from '../core/AuthContext';
import { safeJSONParse } from '../core/utils';
import { AppPreferences } from '../core/types';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 PREMIUM SIDEBAR - Touch-Optimized with Visual Enhancements
// ═══════════════════════════════════════════════════════════════════════════════

interface NavItem {
    id: View | 'ai' | 'logout';
    icon: LucideIcon;
    labelKey: string;
    permission: string | null;
    showBadge?: boolean;
}

interface SidebarProps {
    active: View;
    setView: (view: View) => void;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    onToggleAI: () => void;
    onLogout?: () => void;
    lowStockCount?: number;
}

// Navigation Items
const NAV_ITEMS: NavItem[] = [
    { id: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', permission: null },
    { id: 'sales', icon: ShoppingBag, labelKey: 'nav.sales', permission: Permissions.SALES },
    { id: 'products', icon: Package, labelKey: 'nav.products', permission: Permissions.PRODUCTS },
    { id: 'inventory', icon: Layers, labelKey: 'nav.inventory', permission: Permissions.INVENTORY },
    { id: 'invoices', icon: FileText, labelKey: 'nav.invoices', permission: Permissions.INVOICES },
    { id: 'customers', icon: UserCircle2, labelKey: 'nav.customers', permission: Permissions.CUSTOMERS },
    { id: 'finance', icon: Wallet2, labelKey: 'nav.finance', permission: Permissions.FINANCE },
    { id: 'shifts', icon: Clock, labelKey: 'nav.shifts', permission: Permissions.FINANCE },
    { id: 'reports', icon: BarChart3, labelKey: 'nav.reports', permission: Permissions.REPORTS },
];

// ─────────────────────────────────────────────────────────────────────────────────
// NavButton Component - Premium Design with Animations & Portaled Tooltip
// ─────────────────────────────────────────────────────────────────────────────────

import { createPortal } from 'react-dom';
import { useState, useRef, useEffect, memo } from 'react';

interface NavButtonProps {
    icon: LucideIcon;
    label: string;
    isActive?: boolean;
    onClick: () => void;
    variant?: 'default' | 'ai' | 'danger';
    badge?: number;
}

const NavButton = memo<NavButtonProps>(({ icon: Icon, label, isActive, onClick, variant = 'default', badge }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, right: 0 });

    const handleMouseEnter = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            // RTL Sidebar on Right -> Tooltip on Left
            // Tooltip 'right' should be distance from screen right to button left + margin
            setTooltipPos({
                top: rect.top + (rect.height / 2),
                right: window.innerWidth - rect.left + 10
            });
            setShowTooltip(true);
        }
    };

    const handleMouseLeave = () => {
        setShowTooltip(false);
    };

    const baseClasses = `
        group relative w-[52px] h-[52px] rounded-2xl 
        flex items-center justify-center 
        transition-all duration-150 
        active:scale-90 touch-target
        hover:shadow-lg
    `;

    const variantClasses = {
        default: isActive
            ? 'bg-gradient-to-br from-primary to-emerald-500 text-white shadow-xl shadow-primary/40 scale-105'
            : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:shadow-md active:bg-surface-active',
        ai: 'bg-gradient-to-br from-purple-500/15 to-primary/15 text-purple-500 hover:from-purple-500/30 hover:to-primary/30 border border-purple-500/30 hover:shadow-purple-500/20',
        danger: 'text-text-muted hover:bg-red-500/15 hover:text-red-500 hover:shadow-red-500/10 active:bg-red-500/25',
    };

    return (
        <>
            <button
                ref={buttonRef}
                onClick={onClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={`${baseClasses} ${variantClasses[variant]}`}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
            >
                {/* Icon */}
                <Icon size={24} strokeWidth={isActive ? 2.2 : 1.8} className="transition-transform group-hover:scale-110" />

                {/* Active indicator with glow - Static instead of pulse */}
                {isActive && (
                    <span className="absolute left-0 w-1.5 h-8 bg-white rounded-r-full shadow-[0_0_15px_var(--color-primary)]" />
                )}

                {/* Notification Badge - Static instead of pulse */}
                {badge !== undefined && badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg shadow-red-500/50">
                        {badge > 9 ? '9+' : badge}
                    </span>
                )}
            </button>

            {/* Portaled Tooltip */}
            {showTooltip && createPortal(
                <div
                    className="fixed z-[9999] px-4 py-2.5 bg-surface/95 backdrop-blur-xl text-text-main text-sm font-bold border border-border rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-100 pointer-events-none"
                    style={{
                        top: tooltipPos.top,
                        right: tooltipPos.right,
                        transform: 'translateY(-50%)',
                        direction: 'rtl'
                    }}
                >
                    {label}
                    {/* Tooltip arrow pointing right (towards button) */}
                    <span className="absolute top-1/2 -right-1.5 w-3 h-3 bg-surface border-r border-t border-border rotate-45 -translate-y-1/2" />
                </div>,
                document.body
            )}
        </>
    );
});

// ─────────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────────

export const Sidebar = memo<SidebarProps>(({
    active,
    setView,
    isOpen,
    setIsOpen,
    onToggleAI,
    onLogout,
    lowStockCount = 0
}) => {
    const { t } = useTranslation();
    const { currentUser, logout, hasPermission, isAdmin } = useAuth();

    const isAllowed = (permission: string | null): boolean => {
        return !permission || isAdmin || hasPermission(permission);
    };



    const handleLogout = () => {
        logout();
        onLogout?.();
    };

    const handleNavClick = (id: View) => {
        setView(id);
        setIsOpen(false);
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90] lg:hidden"
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar - Premium Design */}
            <aside
                className={`
                    fixed lg:static inset-y-0 right-0 z-[100]
                    w-[76px] h-full
                    bg-sidebar border-l border-border
                    flex flex-col items-center py-3
                    transition-all duration-300
                    ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
                `}
                role="navigation"
                aria-label="القائمة الرئيسية"
            >
                {/* Top Gradient Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-emerald-400 to-cyan-400" />

                {/* Navigation - Standard Top Alignment */}
                <nav className="flex-1 flex flex-col items-center gap-2.5 w-full px-3 pt-4 overflow-y-auto no-scrollbar">
                    {NAV_ITEMS.filter(item => isAllowed(item.permission)).map(item => (
                        <NavButton
                            key={item.id}
                            icon={item.icon}
                            label={t(item.labelKey)}
                            isActive={active === item.id}
                            onClick={() => handleNavClick(item.id as View)}
                            badge={item.showBadge && lowStockCount > 0 ? lowStockCount : undefined}
                        />
                    ))}
                </nav>

                {/* Separator Line */}
                <div className="w-10 h-px bg-gradient-to-r from-transparent via-border to-transparent my-2 shrink-0" />

                {/* Bottom Section */}
                <div className="flex flex-col items-center gap-2.5 w-full px-3 pb-3">
                    {/* AI Button */}
                    <NavButton
                        icon={Sparkles}
                        label={t('common.aiAssistant', 'المساعد الذكي')}
                        onClick={onToggleAI}
                        variant="ai"
                    />

                    {/* Settings */}
                    {isAllowed(Permissions.SETTINGS) && (
                        <NavButton
                            icon={Settings}
                            label={t('nav.settings')}
                            isActive={active === 'settings'}
                            onClick={() => handleNavClick('settings')}
                        />
                    )}

                    {/* Logout */}
                    <NavButton
                        icon={LogOut}
                        label={t('auth.logout')}
                        onClick={handleLogout}
                        variant="danger"
                    />
                </div>
            </aside>
        </>
    );
});