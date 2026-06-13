import React from 'react';
import { BeidarLogo } from './ui';

export const LoadingScreen = () => (
    <div className="fixed inset-0 bg-bg z-[9999] flex flex-col items-center justify-center select-none animate-scale-in">
        <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-glow-pulse" />
            <BeidarLogo className="w-24 h-24 text-primary mb-8 relative z-10 drop-shadow-[0_0_20px_var(--color-primary)]" />
        </div>
        <div className="flex flex-col items-center gap-4">
            <h2 className="text-4xl font-bold text-text-main font-logo">بيــــدر</h2>
            <p className="text-text-muted text-sm animate-pulse">جارٍ تحميل النظام...</p>
            <div className="flex gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce-subtle" style={{ animationDelay: '0ms' }} />
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce-subtle" style={{ animationDelay: '150ms' }} />
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce-subtle" style={{ animationDelay: '300ms' }} />
            </div>
        </div>
    </div>
);
