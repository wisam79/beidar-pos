
import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, AlertCircle, X, Info, AlertTriangle } from 'lucide-react';
import { Notification } from '../core/types';

interface ToastProps {
  notification: Notification;
  onRemove: (id: number) => void;
}

export const Toast: React.FC<ToastProps> = ({ notification, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);
  const isRemoved = useRef(false);
  const duration = 3000;

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    if (isRemoved.current) return; // Prevent double removal
    isRemoved.current = true;
    setIsExiting(true);
    setTimeout(() => {
      onRemove(notification.id);
    }, 300);
  };

  // Premium styling matching app design
  const styles: Record<string, { bg: string; border: string; iconBg: string; iconColor: string; glow: string }> = {
    success: {
      bg: 'bg-surface/95 backdrop-blur-xl',
      border: 'border-emerald-500/30',
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-500',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]'
    },
    error: {
      bg: 'bg-surface/95 backdrop-blur-xl',
      border: 'border-red-500/30',
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-500',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]'
    },
    warning: {
      bg: 'bg-surface/95 backdrop-blur-xl',
      border: 'border-orange-500/30',
      iconBg: 'bg-orange-500/15',
      iconColor: 'text-orange-500',
      glow: 'shadow-[0_0_20px_rgba(249,115,22,0.15)]'
    },
    info: {
      bg: 'bg-surface/95 backdrop-blur-xl',
      border: 'border-blue-500/30',
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-500',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]'
    }
  };

  const icons: Record<string, JSX.Element> = {
    success: <CheckCircle2 size={20} strokeWidth={2} />,
    error: <AlertCircle size={20} strokeWidth={2} />,
    warning: <AlertTriangle size={20} strokeWidth={2} />,
    info: <Info size={20} strokeWidth={2} />
  };

  const s = styles[notification.type];

  return (
    <div
      className={`
        relative overflow-hidden pointer-events-auto px-5 py-4 rounded-2xl border flex items-center gap-4 
        min-w-[340px] max-w-[440px]
        transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 -translate-y-4 scale-95 max-h-0 py-0 border-0' : 'opacity-100 translate-y-0 scale-100 max-h-24 animate-slide-in-down'}
        ${s.bg} ${s.border} ${s.glow}
      `}
      style={{ boxShadow: 'var(--shadow-lg)' }}
      role="alert"
      dir="rtl"
    >
      {/* Icon Container */}
      <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${s.iconBg} ${s.iconColor}`}>
        {icons[notification.type]}
      </div>

      {/* Message */}
      <span className="font-bold text-sm flex-1 leading-tight text-text-main">{notification.message}</span>

      {/* Close Button */}
      <button
        onClick={handleDismiss}
        className="shrink-0 opacity-50 hover:opacity-100 transition-all p-2 hover:bg-black/10 rounded-xl text-text-muted hover:text-text-main btn-native"
        title="إغلاق"
      >
        <X size={16} />
      </button>

      {/* Animated Progress Bar */}
      <div className="absolute bottom-0 right-0 left-0 h-1 bg-black/5 rounded-b-2xl overflow-hidden">
        <div
          className={`h-full ${s.iconColor.replace('text-', 'bg-')} opacity-70 origin-right`}
          style={{ animation: `progressShrink ${duration}ms linear forwards` }}
        />
      </div>
    </div>
  );
};
