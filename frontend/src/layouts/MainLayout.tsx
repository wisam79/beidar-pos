import React from 'react';
import { NativeTitleBar } from '../components/NativeTitleBar';
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
    const setAppState = useAppStore((state) => state.setAppState);
    const { currentUser } = useAuth();

    return (
        <div
            className={`flex flex-col h-screen overflow-hidden bg-bg text-text-main transition-colors duration-200 ${prefs.compactMode ? 'text-sm' : ''}`}
            dir="rtl"
        >
            <NativeTitleBar
                theme={prefs.theme}
                onToggleTheme={onToggleTheme}
                currentUser={currentUser}
                appVersion={appVersion}
                activeView={activeView}
                onNavigate={onNavigate}
                onToggleAI={() => useAppStore.getState().setAiChatOpen(!useAppStore.getState().isAiChatOpen)}
                onLogout={onLogout}
                lowStockCount={aiContext.lowStock}
            />

            <div className="flex flex-col flex-1 h-full overflow-hidden relative">
                <AppProviders aiContext={aiContext} onNavigate={onNavigate} onLock={() => setAppState('login')}>
                    <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-bg transition-all duration-200">
                        <div className={`w-full h-full animate-fade-in flex flex-col ${activeView === 'sales' ? 'p-0' : 'px-4 py-3'}`}>
                            {children}
                        </div>
                    </main>
                </AppProviders>
            </div>
        </div>
    );
};
