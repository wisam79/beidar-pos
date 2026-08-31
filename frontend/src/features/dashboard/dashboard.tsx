import React, { memo, useEffect } from 'react';
import { PageShell } from '../../components/blocks';
import { usePreferences } from '../../components/PreferencesContext';
import {
    Pos3DIcon,
    Products3DIcon,
    Invoices3DIcon,
    Vault3DIcon,
    Customers3DIcon,
    Reports3DIcon,
    Inventory3DIcon,
    Finance3DIcon,
    Settings3DIcon,
} from '../../components/icons3d';
import { cn } from '../../theme/cn';
import { Command } from 'lucide-react';

interface TactileButtonProps {
    title: string;
    sublabel: string;
    shortcut: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    onClick: () => void;
}

const TactileButton = memo(({
    title,
    sublabel,
    shortcut,
    icon: Icon3D,
    onClick,
}: TactileButtonProps) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            'group relative flex flex-col justify-between items-center text-center select-none outline-none cursor-pointer',
            'rounded-3xl p-5 sm:p-6 transition-all duration-300 ease-out aspect-square w-full max-w-[270px] mx-auto',
            'bg-surface hover:bg-surface-hover/90 border border-border/80 hover:border-primary/50',
            'shadow-2xs hover:shadow-xl hover:shadow-primary/15 hover:-translate-y-1.5',
            'active:scale-[0.98] active:translate-y-0 overflow-hidden'
        )}
    >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-primary/15 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <div className="w-full flex items-center justify-between relative z-10">
            <span className="px-2.5 py-1 rounded-lg bg-bg/80 dark:bg-black/40 border border-border/80 text-[10px] font-mono font-bold text-text-muted group-hover:text-primary group-hover:border-primary/40 transition-colors shadow-3xs">
                {shortcut}
            </span>
            <span className="text-[10px] font-bold text-text-muted/70 group-hover:text-text-muted transition-colors">
                {sublabel}
            </span>
        </div>

        <div className="relative z-10 flex items-center justify-center my-auto transition-transform duration-300 group-hover:scale-105">
            <Icon3D size={76} />
        </div>

        <div className="relative z-10 w-full mt-2">
            <h3 className="text-xl lg:text-2xl font-black text-text-main group-hover:text-primary transition-colors">
                {title}
            </h3>
        </div>
    </button>
));

TactileButton.displayName = 'TactileButton';

const SECTIONS = [
    { key: 'sales', title: 'المبيعات', sublabel: 'نقطة البيع', shortcut: 'F1', icon: Pos3DIcon },
    { key: 'products', title: 'المنتجات', sublabel: 'إدارة الأصناف', shortcut: 'F2', icon: Products3DIcon },
    { key: 'inventory', title: 'المخزون', sublabel: 'الجرد والتوريد', shortcut: 'F3', icon: Inventory3DIcon },
    { key: 'invoices', title: 'الفواتير', sublabel: 'سجل الفواتير', shortcut: 'F4', icon: Invoices3DIcon },
    { key: 'shifts', title: 'الورديات', sublabel: 'الخزينة والصندوق', shortcut: 'F5', icon: Vault3DIcon },
    { key: 'customers', title: 'العملاء', sublabel: 'الديون والنقاط', shortcut: 'F6', icon: Customers3DIcon },
    { key: 'finance', title: 'المالية', sublabel: 'المصاريف والإيرادات', shortcut: 'F7', icon: Finance3DIcon },
    { key: 'reports', title: 'التقارير', sublabel: 'التحليلات والمحاسبة', shortcut: 'F8', icon: Reports3DIcon },
    { key: 'settings', title: 'الإعدادات', sublabel: 'النظام والخيارات', shortcut: 'F9', icon: Settings3DIcon },
] as const;

export const Dashboard: React.FC = () => {
    const { setView } = usePreferences();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            const section = SECTIONS.find((s) => e.key === s.shortcut);
            if (section) {
                e.preventDefault();
                setView(section.key);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setView]);

    return (
        <PageShell className="p-0 h-full flex flex-col justify-between overflow-hidden select-none">
            <div className="flex-1 flex flex-col justify-center py-4 min-h-0 overflow-y-auto">
                <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 max-w-5xl mx-auto w-full px-6 py-2">
                    {SECTIONS.map((section) => (
                        <TactileButton
                            key={section.key}
                            title={section.title}
                            sublabel={section.sublabel}
                            shortcut={section.shortcut}
                            icon={section.icon}
                            onClick={() => setView(section.key)}
                        />
                    ))}
                </main>
            </div>

            <div className="py-2.5 px-6 border-t border-border/60 bg-surface/60 backdrop-blur-md flex items-center justify-between text-xs text-text-muted font-bold shrink-0">
                <div className="flex items-center gap-2">
                    <Command size={14} className="text-primary" />
                    <span>التنقل السريع عبر اختصارات لوحة المفاتيح</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                    {SECTIONS.map((s, i) => (
                        <React.Fragment key={s.key}>
                            {i > 0 && <span>•</span>}
                            <span>[{s.shortcut}] {s.title}</span>
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </PageShell>
    );
};