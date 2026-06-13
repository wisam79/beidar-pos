import React from 'react';
import { Server, Wifi, WifiOff } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Sidebar } from '../components/Sidebar';
import { CommandPalette } from '../components/CommandPalette';
import { AIChatWindow } from '../components/AIChatWindow';
import { ToastContainer } from '../components/ToastContainer';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { NativeTitleBar } from '../components/NativeTitleBar';
import { UtilitiesDock } from '../components/UtilitiesDock';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { SessionTimeoutWarning } from '../components/SessionTimeoutWarning';
import { useAuth } from '../core/AuthContext';
import { View, AppPreferences } from '../core/types';

// ═══════════════════════════════════════════════════════════════════════════════
// 🏗️ MAIN LAYOUT - Extracted from App.tsx for cleaner architecture
// ═══════════════════════════════════════════════════════════════════════════════

interface MainLayoutProps {
    children: React.ReactNode;
    prefs: AppPreferences;
    onToggleTheme: () => void;
    onNavigate: (view: View) => void;
    onLogout: () => void;
    aiContext: { revenue: number; orders: number; lowStock: number };
    appVersion: string;
}

// Wrapper for forced password change
const ChangePasswordModalWrapper = () => {
    const { currentUser, requirePinChange, setRequirePinChange } = useAuth();
    if (!requirePinChange || !currentUser) return null;
    return (
        <ChangePasswordModal
            isOpen={true}
            staffId={currentUser.id}
            staffName={currentUser.username}
            isForced={true}
            onSuccess={() => setRequirePinChange(false)}
        />
    );
};

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    prefs,
    onToggleTheme,
    onNavigate,
    onLogout,
    aiContext,
    appVersion,
}) => {
    const activeView = useAppStore(state => state.activeView);
    const notifications = useAppStore(state => state.notifications);
    const removeNotification = useAppStore(state => state.removeNotification);
    const isAiChatOpen = useAppStore(state => state.isAiChatOpen);
    const setAiChatOpen = useAppStore(state => state.setAiChatOpen);
    const isCommandPaletteOpen = useAppStore(state => state.isCommandPaletteOpen);
    const setCommandPaletteOpen = useAppStore(state => state.setCommandPaletteOpen);
    const isShortcutsOpen = useAppStore(state => state.isShortcutsOpen);
    const setShortcutsOpen = useAppStore(state => state.setShortcutsOpen);
    const onlineStatus = useAppStore(state => state.onlineStatus);
    const setAppState = useAppStore(state => state.setAppState);

    const { currentUser } = useAuth();

    return (
        <div
            className={`flex flex-col h-screen font-sans overflow-hidden bg-bg text-text-main transition-colors duration-500 bg-mesh ${prefs.compactMode ? 'text-sm' : ''}`}
            dir="rtl"
            onContextMenu={(e) => {
                const target = e.target as HTMLElement;
                if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
                e.preventDefault();
            }}
        >
            {/* 1. Window Title Bar */}
            {/* 1. Window Title Bar */}
            <NativeTitleBar
                theme={prefs.theme}
                onToggleTheme={onToggleTheme}
                onlineStatus={onlineStatus}
                currentUser={currentUser}
                appVersion={appVersion}
            />

            {/* 2. Main Layout */}
            <div className="flex flex-1 h-full overflow-hidden relative">
                {/* Global Overlays */}
                <ChangePasswordModalWrapper />
                <SessionTimeoutWarning />
                <CommandPalette
                    isOpen={isCommandPaletteOpen}
                    onClose={() => setCommandPaletteOpen(false)}
                    onNavigate={onNavigate}
                />
                <AIChatWindow isOpen={isAiChatOpen} onClose={() => setAiChatOpen(false)} contextData={aiContext} />
                <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setShortcutsOpen(false)} />
                <ToastContainer notifications={notifications} onRemove={removeNotification} />
                <UtilitiesDock onLock={() => setAppState('login')} />

                {/* 3. Sidebar Navigation */}
                <Sidebar
                    active={activeView}
                    setView={onNavigate}
                    isOpen={false}
                    setIsOpen={() => { }}
                    onToggleAI={() => setAiChatOpen(!isAiChatOpen)}
                    onLogout={onLogout}
                />

                {/* 4. Content Area */}
                <main className={`flex-1 flex flex-col h-full relative overflow-hidden bg-surface/95 border-t border-l border-white/5 shadow-2xl mr-0 my-0 ${activeView === 'sales' ? 'rounded-none' : 'rounded-tl-3xl'}`}>
                    <div className="flex-1 w-full h-full relative overflow-hidden">
                        <div className={`w-full h-full animate-fade-in flex flex-col ${activeView === 'sales' ? 'max-w-none p-0' : 'max-w-[1920px] mx-auto p-2'}`}>
                            {children}
                        </div>
                    </div>


                </main>
            </div>
        </div>
    );
};
