/**
 * Dashboard.tsx - Beidar POS Tactile 3D Launcher (لوحة تحكم الأزرار اللمسية المجسمة)
 * 
 * - Compact, centered 3x2 tactile push-button control grid
 * - Realistic 3D hardware button depth (bevel top, shadow bottom, active press)
 * - Prominent glowing 3D icon pods
 * - Pure Beidar Emerald identity
 */
import React, { memo } from 'react';
import { PageShell } from '../../components/blocks';
import { usePreferences } from '../../components/PreferencesContext';
import {
    Pos3DIcon,
    Products3DIcon,
    Invoices3DIcon,
    Vault3DIcon,
    Customers3DIcon,
    Reports3DIcon,
} from '../../components/icons3d';
import { cn } from '../../theme/cn';

interface TactileButtonProps {
    title: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    onClick: () => void;
    hero?: boolean;
}

const TactileButton = memo(({
    title,
    icon: Icon3D,
    onClick,
    hero = false,
}: TactileButtonProps) => {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                // 3D Push Button Tactile Feel
                'group relative flex flex-col justify-center items-center text-center select-none outline-none cursor-pointer',
                'rounded-3xl p-6 lg:p-8 transition-all duration-150 ease-out',
                'bg-surface hover:bg-surface-hover',
                'border-t-[1.5px] border-t-white/60 dark:border-t-white/10 border-x border-x-border/60 border-b-[4px] border-b-border dark:border-b-black/80',
                'shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1',
                'active:translate-y-1.5 active:border-b-[2px] active:shadow-inner',
                hero && 'border-t-emerald-500/40 shadow-emerald-500/10'
            )}
        >
            {/* Center: Large Floating 3D Icon */}
            <div className="relative z-10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1.5">
                <Icon3D size={220} />
            </div>

            {/* Directly Below Icon: Main Card Title */}
            <div className="relative z-10 w-full mt-2">
                <h3 className="text-2xl lg:text-3xl font-extrabold text-text-main group-hover:text-emerald-400 transition-colors">
                    {title}
                </h3>
            </div>
        </button>
    );
});

TactileButton.displayName = 'TactileButton';

export const Dashboard: React.FC = () => {
    const { setView } = usePreferences();

    return (
        <PageShell className="p-0 h-full flex flex-col justify-center overflow-hidden">
            {/* ═══════════════════════════════════════════════════════════════
                CENTERED 3D TACTILE BUTTONS GRID
            ═══════════════════════════════════════════════════════════════ */}
            <div className="flex-1 flex flex-col justify-center py-6 min-h-0">
                <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto w-full px-6">

                    {/* ─── BUTTON 1: Quick POS Sales ─── */}
                    <TactileButton
                        title="المبيعات"
                        icon={Pos3DIcon}
                        onClick={() => setView('sales')}
                        hero={true}
                    />

                    {/* ─── BUTTON 2: Products & Inventory ─── */}
                    <TactileButton
                        title="المخزون"
                        icon={Products3DIcon}
                        onClick={() => setView('products')}
                    />

                    {/* ─── BUTTON 3: Invoices & Orders ─── */}
                    <TactileButton
                        title="الفواتير"
                        icon={Invoices3DIcon}
                        onClick={() => setView('invoices')}
                    />

                    {/* ─── BUTTON 4: Shift & Cash Vault ─── */}
                    <TactileButton
                        title="الخزينة"
                        icon={Vault3DIcon}
                        onClick={() => setView('shifts')}
                    />

                    {/* ─── BUTTON 5: Customers & Debts ─── */}
                    <TactileButton
                        title="العملاء"
                        icon={Customers3DIcon}
                        onClick={() => setView('customers')}
                    />

                    {/* ─── BUTTON 6: Financial Reports & Analytics ─── */}
                    <TactileButton
                        title="التقارير"
                        icon={Reports3DIcon}
                        onClick={() => setView('reports')}
                    />

                </main>
            </div>
        </PageShell>
    );
};
