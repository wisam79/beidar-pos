
import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Minimize2, Sun, Moon, Wifi, WifiOff, Server, User } from 'lucide-react';
import { WindowMinimise, WindowMaximise, Quit as WindowClose } from '../../wailsjs/runtime/runtime';

interface NativeTitleBarProps {
    theme?: 'light' | 'dark';
    onToggleTheme?: () => void;
    onlineStatus?: boolean;
    currentUser?: { name: string } | null;
    appVersion?: string;
}

export const NativeTitleBar: React.FC<NativeTitleBarProps> = ({
    theme,
    onToggleTheme,
    onlineStatus,
    currentUser,
    appVersion
}) => {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const isMax = window.outerWidth >= window.screen.availWidth && window.outerHeight >= window.screen.availHeight;
            setIsMaximized(isMax);
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleMinimize = () => WindowMinimise();
    const handleMaximize = () => {
        WindowMaximise();
        setIsMaximized(prev => !prev);
    };
    const handleClose = () => WindowClose();

    return (
        <div
            dir="rtl"
            className="title-bar-draggable h-9 bg-sidebar border-b border-border flex items-center justify-between select-none z-[50] shrink-0 w-full relative"
            onDoubleClick={handleMaximize}
        >
            {/* Branding - Right Side (RTL) */}
            <div className="px-4 flex items-center gap-3 h-full basis-1/4">
                {/* App Name in Lemonada Arabic font */}
                <div className="flex items-center gap-1.5">
                    <span className="text-base font-black text-primary font-logo">بيدر</span>
                </div>
            </div>

            {/* Center Info - Integrated Status (Premium Pill Badges) */}
            <div className="title-bar-controls flex items-center justify-center gap-2.5 h-full basis-1/2">
                {/* User Info */}
                {currentUser && (
                    <div 
                        className="flex items-center gap-1.5 h-[22px] text-[11px] font-medium text-text-muted hover:text-text-main bg-surface-hover/60 dark:bg-neutral-800/40 border border-border/40 dark:border-neutral-700/50 px-2.5 rounded-full shadow-xs hover:bg-surface-hover dark:hover:bg-neutral-800/70 hover:border-border/80 dark:hover:border-neutral-600 transition-all duration-200 cursor-default group"
                        title={`المستخدم الحالي: ${currentUser.name}`}
                    >
                        <User size={12} className="text-primary/75 dark:text-primary/90 shrink-0 group-hover:scale-110 transition-transform duration-200" />
                        <span className="font-semibold text-text-main">{currentUser.name}</span>
                    </div>
                )}

                {/* Separator */}
                {currentUser && <div className="w-px h-3 bg-gradient-to-b from-transparent via-border/50 to-transparent hidden md:block" />}

                {/* Online Status */}
                {onlineStatus !== undefined && (
                    <div 
                        className={`flex items-center gap-1.5 h-[22px] text-[11px] font-medium px-2.5 rounded-full border shadow-xs transition-all duration-200 cursor-default ${
                            onlineStatus 
                                ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15 hover:border-emerald-500/30' 
                                : 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20 dark:border-rose-500/25 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 hover:border-rose-500/30'
                        }`}
                        title={onlineStatus ? "متصل بالنظام والسحابة" : "غير متصل بالشبكة"}
                    >
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${onlineStatus ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-rose-400 dark:bg-rose-500'}`} />
                            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${onlineStatus ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        </span>
                        <span className="font-semibold">{onlineStatus ? 'متصل' : 'غير متصل'}</span>
                    </div>
                )}

                {/* Separator */}
                {appVersion && <div className="w-px h-3 bg-gradient-to-b from-transparent via-border/50 to-transparent hidden md:block" />}

                {/* Version */}
                {appVersion && (
                    <div 
                        className="flex items-center gap-1.5 h-[22px] text-[11px] font-medium text-text-muted hover:text-text-main bg-surface-hover/60 dark:bg-neutral-800/40 border border-border/40 dark:border-neutral-700/50 px-2.5 rounded-full shadow-xs hover:bg-surface-hover dark:hover:bg-neutral-800/70 hover:border-border/80 dark:hover:border-neutral-600 transition-all duration-200 cursor-default group"
                        title={`إصدار النظام: ${appVersion}`}
                    >
                        <Server size={11} className="text-text-muted/70 shrink-0 group-hover:scale-105 transition-transform duration-200" />
                        <span>v{appVersion}</span>
                    </div>
                )}
            </div>

            {/* Window Controls */}
            <div className="title-bar-controls flex h-full items-center gap-1 px-2 basis-1/4 justify-end">
                {/* Theme Toggle */}
                {onToggleTheme && (
                    <button
                        className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors duration-100 active:opacity-70 outline-none focus:outline-none mr-1 btn-native"
                        onClick={onToggleTheme}
                        title={theme === 'dark' ? "الوضع الفاتح" : "الوضع الليلي"}
                    >
                        {theme === 'dark' ? (
                            <Sun size={14} strokeWidth={2} />
                        ) : (
                            <Moon size={14} strokeWidth={2} />
                        )}
                    </button>
                )}

                {/* Separator */}
                <div className="w-px h-5 bg-border mx-1" />

                {/* Window Buttons */}
                <button
                    className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors duration-100 active:opacity-70 outline-none focus:outline-none btn-native"
                    onClick={handleMinimize}
                    title="تصغير"
                >
                    <Minus size={14} strokeWidth={1.5} />
                </button>
                <button
                    className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors duration-100 active:opacity-70 outline-none focus:outline-none btn-native"
                    onClick={handleMaximize}
                    title={isMaximized ? "استعادة" : "تكبير"}
                >
                    {isMaximized ? <Minimize2 size={13} strokeWidth={1.5} /> : <Square size={12} strokeWidth={1.5} />}
                </button>
                <button
                    className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:bg-red-500 hover:text-white transition-colors duration-100 active:opacity-70 outline-none focus:outline-none"
                    onClick={handleClose}
                    title="إغلاق"
                >
                    <X size={14} strokeWidth={1.5} />
                </button>
            </div>
        </div>
    );
};
