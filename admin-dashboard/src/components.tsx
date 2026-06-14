import React from 'react';
import { CheckCircle, AlertTriangle, Info } from 'lucide-react';

// Toast Hooks & Component
export const useToast = () => {
  const [toast, setToast] = React.useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' = 'info'
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const ToastComponent = toast && (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl font-bold text-sm shadow-2xl animate-fade-in flex items-center gap-2 ${
        toast.type === 'success'
          ? 'bg-emerald-600 text-white'
          : toast.type === 'error'
            ? 'bg-red-600 text-white'
            : 'bg-slate-800 text-white border border-slate-700'
      }`}
    >
      {toast.type === 'success' && <CheckCircle size={18} />}
      {toast.type === 'error' && <AlertTriangle size={18} />}
      {toast.type === 'info' && <Info size={18} />}
      {toast.message}
    </div>
  );

  return { showToast, ToastComponent };
};

// Stat Card
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  color,
}) => (
  <div className="relative group overflow-hidden rounded-2xl p-5 border border-slate-800 bg-slate-900/50 backdrop-blur-md shadow-xl transition-all duration-300 hover:border-slate-700 hover:shadow-2xl hover:scale-[1.02]">
    <div
      className={`absolute -right-6 -top-6 w-16 h-16 rounded-full ${color} opacity-10 blur-2xl group-hover:opacity-25 transition-opacity duration-300`}
    />
    <div className="relative z-10 flex items-center justify-between gap-3">
      <div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className="text-2xl font-black text-white font-mono tracking-tight">
          {value}
        </p>
      </div>
      <div
        className={`p-3 rounded-xl bg-slate-800 border border-slate-700/50 shadow-inner ${color} group-hover:scale-110 transition-transform duration-300`}
      >
        {icon}
      </div>
    </div>
  </div>
);

// Tab Button
interface TabButtonProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

export const TabButton: React.FC<TabButtonProps> = ({
  active,
  icon,
  label,
  onClick,
}) => (
  <button
    onClick={onClick}
    title={label}
    className={`relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full text-right font-medium text-sm ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

// Filter Button
interface FilterButtonProps {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}

export const FilterButton: React.FC<FilterButtonProps> = ({
  active,
  label,
  count,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
      active
        ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-md shadow-blue-500/5'
        : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    {label}
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] ${
        active ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'
      }`}
    >
      {count}
    </span>
  </button>
);
