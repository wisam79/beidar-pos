
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
            dir="ltr"
            className="title-bar-draggable h-9 bg-sidebar border-b border-border flex items-center justify-between select-none z-[50] shrink-0 w-full relative"
            onDoubleClick={handleMaximize}
        >
            {/* Branding - Left Side with App Icon */}
            <div className="px-4 flex items-center gap-3 h-full basis-1/4">
                {/* App Name with subtle gradient */}
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-text-main font-logo tracking-tight">Beidar</span>
                </div>
            </div>

            {/* Center Info - Integrated Status (Premium Pill Badges) */}
            <div className="flex items-center justify-center gap-2 h-full basis-1/2">
                {/* User Info */}
                {currentUser && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted hidden md:flex bg-surface-hover/80 border border-border/50 px-2.5 py-0.5 rounded-full shadow-xs">
                        <User size={12} className="text-primary shrink-0" />
                        <span className="text-text-main font-semibold">{currentUser.name}</span>
                    </div>
                )}

                {/* Separator */}
                {currentUser && <div className="w-px h-3 bg-border/60 hidden md:block" />}

                {/* Online Status */}
                {onlineStatus !== undefined && (
                    <div className={`flex items-center gap-1.5 text-[9px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs ${
                        onlineStatus 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${onlineStatus ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <span>{onlineStatus ? 'متصل' : 'غير متصل'}</span>
                    </div>
                )}

                {/* Separator */}
                {appVersion && <div className="w-px h-3 bg-border/60 hidden md:block" />}

                {/* Version */}
                {appVersion && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted hidden md:flex bg-surface-hover/80 border border-border/50 px-2.5 py-0.5 rounded-full shadow-xs">
                        <Server size={11} className="text-text-muted/60 shrink-0" />
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
