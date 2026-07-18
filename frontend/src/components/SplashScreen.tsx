
import React from 'react';
import { BeidarLogo } from './ui';
import { Sparkles } from 'lucide-react';

export const SplashScreen = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-bg flex flex-col items-center justify-center overflow-hidden animate-scale-in" data-theme="dark">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50 blur-3xl" />

      {/* Animated Glow Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '3s' }} />
        <div className="absolute w-48 h-48 rounded-full border border-primary/30 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center animate-slide-in-up">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/25 blur-3xl rounded-full animate-glow-pulse" />
          <BeidarLogo className="w-36 h-36 text-primary drop-shadow-[0_0_40px_rgba(16,185,129,0.6)] relative z-10" />
        </div>

        <h1 className="mt-10 text-5xl font-black text-text-main tracking-tight flex items-center gap-3">
          BEIDAR <span className="text-primary font-mono text-4xl bg-primary/10 px-3 py-1 rounded-xl border border-primary/20">OS</span>
        </h1>

        <div className="mt-10 flex items-center gap-3 px-5 py-2.5 bg-surface rounded-full border border-border ">
          <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce-subtle" />
          <span className="text-sm text-text-muted font-medium">جاري تهيئة النظام...</span>
        </div>
      </div>

      <div className="absolute bottom-10 text-center animate-slide-in-up" style={{ animationDelay: '0.5s' }}>
        <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] mb-1">Designed & Developed by</p>
        <p className="text-sm font-bold text-text-main flex items-center justify-center gap-2">
          <Sparkles size={12} className="text-primary animate-wiggle" /> WISAM SAMIR
        </p>
      </div>
    </div>
  );
};


