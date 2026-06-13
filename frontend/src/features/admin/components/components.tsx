// Dashboard UI Components - Extracted from DeveloperDashboard.tsx

import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────────
// Toast Hook
// ─────────────────────────────────────────────────────────────────────────────────
export const useToast = () => {
    const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const ToastComponent = toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl font-bold text-sm shadow-2xl animate-in slide-in-from-bottom-4 fade-in flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-500 text-white' :
            toast.type === 'error' ? 'bg-red-500 text-white' :
                'bg-surface text-text-main border border-border shadow-lg'
            }`}>
            {toast.type === 'success' && <CheckCircle size={18} />}
            {toast.type === 'error' && <AlertTriangle size={18} />}
            {toast.message}
        </div>
    );

    return { showToast, ToastComponent };
};

// ─────────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────────
interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number | string;
    color: string;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
    <div className="relative group overflow-hidden rounded-xl p-3 border border-white/5 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-md shadow-2xl transition-all hover:scale-[1.02] hover:shadow-primary/20 hover:border-white/10">
        <div className={`absolute -right-6 -top-6 w-16 h-16 rounded-full ${color} opacity-20 blur-2xl group-hover:opacity-30 transition-opacity`} />

        <div className="relative z-10 flex items-center justify-between gap-3">
            <div>
                <p className="text-text-muted text-[8px] font-bold uppercase tracking-widest mb-0.5">{label}</p>
                <p className="text-xl font-black text-white font-mono tracking-tight">{value}</p>
            </div>
            <div className={`p-2 rounded-lg bg-white/5 border border-white/5 shadow-inner ${color.replace('bg-', 'text-')} group-hover:scale-110 transition-transform duration-500`}>
                {React.cloneElement(icon as React.ReactElement, { size: 18 })}
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────────
// Tab Button
// ─────────────────────────────────────────────────────────────────────────────────
interface TabButtonProps {
    active: boolean;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}

export const TabButton: React.FC<TabButtonProps> = ({ active, icon, label, onClick }) => (
    <button
        onClick={onClick}
        title={label}
        className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 overflow-hidden ${active
            ? 'bg-primary text-primary-fg shadow-lg shadow-primary/25'
            : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
            }`}
    >
        {active && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />}
        <span className="relative z-10">
            {icon}
        </span>
    </button>
);

// ─────────────────────────────────────────────────────────────────────────────────
// Filter Button
// ─────────────────────────────────────────────────────────────────────────────────
interface FilterButtonProps {
    active: boolean;
    label: string;
    count: number;
    onClick: () => void;
    color?: string;
}

export const FilterButton: React.FC<FilterButtonProps> = ({ active, label, count, onClick, color = 'primary' }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${active
            ? `bg-primary/10 text-primary border-primary/20 shadow-lg shadow-primary/5`
            : 'text-text-muted border-transparent hover:bg-surface-hover hover:text-text-main'
            }`}
    >
        {label}
        <span className={`px-1.5 py-0.5 rounded text-[10px] ${active ? `bg-primary/20 text-primary` : 'bg-surface-active'
            }`}>
            {count}
        </span>
    </button>
);
