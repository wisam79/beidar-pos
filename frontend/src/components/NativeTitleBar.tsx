
import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Minimize2, Sun, Moon, Wifi, WifiOff, Server } from 'lucide-react';
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
            className="title-bar-draggable h-11 bg-sidebar border-b border-border flex items-center justify-between select-none z-[50] shrink-0 w-full relative transition-colors duration-300 shadow-sm"
            onDoubleClick={handleMaximize}
        >
            {/* Branding - Left Side with App Icon */}
            <div className="px-4 flex items-center gap-3 h-full basis-1/4">
                {/* App Name with subtle gradient */}
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-text-main font-logo tracking-tight">Beidar</span>
                </div>
            </div>

            {/* Center Info - Integrated Status */}
            <div className="flex items-center justify-center gap-4 h-full basis-1/2 opacity-80 hover:opacity-100 transition-opacity">
                {/* User Info */}
                {currentUser && (
                    <div className="flex items-center gap-2 text-[11px] font-bold text-text-muted hidden md:flex">
                        <div className="w-4 h-4 rounded-md bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center text-white text-[9px] shadow-sm">
                            {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{currentUser.name}</span>
                    </div>
                )}

                {/* Separator */}
                {currentUser && <div className="w-px h-3 bg-border hidden md:block" />}

                {/* Online Status */}
                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                    {onlineStatus !== undefined && (
                        <>
                            {onlineStatus ? <Wifi size={12} className="text-emerald-500" /> : <WifiOff size={12} className="text-red-500" />}
                            <span className={onlineStatus ? 'text-emerald-500' : 'text-red-500'}>{onlineStatus ? 'ONLINE' : 'OFFLINE'}</span>
                        </>
                    )}
                </div>

                {/* Separator */}
                {appVersion && <div className="w-px h-3 bg-border hidden md:block" />}

                {/* Version */}
                {appVersion && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-muted hidden md:flex">
                        <span>v{appVersion}</span>
                    </div>
                )}
            </div>

            {/* Window Controls */}
            <div className="title-bar-controls flex h-full items-center gap-1 px-2 basis-1/4 justify-end">
                {/* Theme Toggle */}
                {onToggleTheme && (
                    <button
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-surface-hover hover:text-text-main transition-all duration-200 active:scale-90 outline-none focus:outline-none mr-2 btn-native touch-target"
                        onClick={onToggleTheme}
                        title={theme === 'dark' ? "الوضع الفاتح" : "الوضع الليلي"}
                    >
                        {theme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
                    </button>
                )}

                {/* Separator */}
                <div className="w-px h-5 bg-border mx-1" />

                {/* Window Buttons */}
                <button
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-surface-hover hover:text-text-main transition-all duration-200 active:scale-90 outline-none focus:outline-none btn-native touch-target"
                    onClick={handleMinimize}
                    title="تصغير"
                >
                    <Minus size={16} strokeWidth={1.5} />
                </button>
                <button
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-surface-hover hover:text-text-main transition-all duration-200 active:scale-90 outline-none focus:outline-none btn-native touch-target"
                    onClick={handleMaximize}
                    title={isMaximized ? "استعادة" : "تكبير"}
                >
                    {isMaximized ? <Minimize2 size={16} strokeWidth={1.5} /> : <Square size={14} strokeWidth={1.5} />}
                </button>
                <button
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-red-500/20 hover:text-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all duration-200 active:scale-90 outline-none focus:outline-none touch-target"
                    onClick={handleClose}
                    title="إغلاق"
                >
                    <X size={16} strokeWidth={1.5} />
                </button>
            </div>
        </div>
    );
};
