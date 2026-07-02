import React from 'react';
import { NativeTitleBar } from '../components/NativeTitleBar';
import { Sidebar } from '../components/Sidebar';
import { AppProviders } from '../components/providers';
import { useAppStore } from '../store/appStore';
import { useAuth } from '../core/AuthContext';
import type { AppPreferences, View } from '../core/types';

interface MainLayoutProps {
    children: React.ReactNode;
    prefs: AppPreferences;
    onToggleTheme: () => void;
    onNavigate: (view: View) => void;
    onLogout: () => void;
    aiContext: { revenue: number; orders: number; lowStock: number };
    appVersion: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    prefs,
    onToggleTheme,
    onNavigate,
    onLogout,
    aiContext,
    appVersion,
}) => {
    const activeView = useAppStore((state) => state.activeView);
    const onlineStatus = useAppStore((state) => state.onlineStatus);
    const setAppState = useAppStore((state) => state.setAppState);
    const { currentUser } = useAuth();

    return (
        <div
            className={`flex flex-col h-screen overflow-hidden bg-sidebar text-text-main transition-colors duration-200 ${prefs.compactMode ? 'text-sm' : ''}`}
            dir="rtl"
            onContextMenu={(e) => {
                const target = e.target as HTMLElement;
                if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
                e.preventDefault();
            }}
        >
            <NativeTitleBar
                theme={prefs.theme}
                onToggleTheme={onToggleTheme}
                onlineStatus={onlineStatus}
                currentUser={currentUser}
                appVersion={appVersion}
            />

            <div className="flex flex-1 h-full overflow-hidden relative">
                <AppProviders aiContext={aiContext} onNavigate={onNavigate} onLock={() => setAppState('login')}>
                    <Sidebar
                        active={activeView}
                        setView={onNavigate}
                        isOpen={false}
                        setIsOpen={() => { }}
                        onToggleAI={() => useAppStore.getState().setAiChatOpen(!useAppStore.getState().isAiChatOpen)}
                        onLogout={onLogout}
                    />

                    <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-bg transition-all duration-200">
                        <div className={`w-full h-full animate-fade-in flex flex-col ${activeView === 'sales' ? 'p-0' : 'p-6 max-w-[1920px] mx-auto'}`}>
                            {children}
                        </div>
                    </main>
                </AppProviders>
            </div>
        </div>
    );
};
