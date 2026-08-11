import React from 'react';
import { BeidarLogo } from './ui';
import { Sparkles } from 'lucide-react';

export const SplashScreen = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-bg flex flex-col items-center justify-center overflow-hidden animate-scale-in" data-theme="dark">
      <div className="relative z-10 flex flex-col items-center">
        <BeidarLogo className="w-24 h-24 text-primary" />

        <h1 className="mt-8 text-4xl font-black text-text-main tracking-tight flex items-center gap-3">
          BEIDAR <span className="text-primary font-mono text-3xl bg-primary/10 px-3 py-1 rounded-xl border border-primary/20">OS</span>
        </h1>

        <div className="mt-8 flex items-center gap-3 px-5 py-2.5 bg-surface rounded-full border border-border">
          <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
          <span className="text-sm text-text-muted font-medium">جاري تهيئة النظام...</span>
        </div>
      </div>

      <div className="absolute bottom-10 text-center">
        <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] mb-1">Designed & Developed by</p>
        <p className="text-sm font-bold text-text-main flex items-center justify-center gap-2">
          <Sparkles size={12} className="text-primary" /> WISAM SAMIR
        </p>
      </div>
    </div>
  );
};
