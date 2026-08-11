import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { View } from '../core/types';
import { toast } from 'sonner';

interface AppState {
    // Navigation
    activeView: View;
    setActiveView: (view: View) => void;

    // Theme & Preferences
    theme: 'dark' | 'light';
    toggleTheme: () => void;

    // UI State
    isCommandPaletteOpen: boolean;
    setCommandPaletteOpen: (open: boolean) => void;
    isAiChatOpen: boolean;
    setAiChatOpen: (open: boolean) => void;
    isShortcutsOpen: boolean;
    setShortcutsOpen: (open: boolean) => void;

    // Notifications
    notify: (message: string, type?: 'success' | 'error' | 'info') => void;

    // Online Status
    onlineStatus: boolean;
    setOnlineStatus: (status: boolean) => void;

    // App Lifecycle
    appState: 'splash' | 'cloud-auth' | 'license' | 'login' | 'app';
    setAppState: (state: 'splash' | 'cloud-auth' | 'license' | 'login' | 'app') => void;
    clearAuthSession: () => void;
}

// Track last notification for deduplication
let lastNotify = { message: '', time: 0 };

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            // Navigation
            activeView: 'dashboard',
            setActiveView: (view) => {
                set({ activeView: view });
                localStorage.setItem('beidar_last_view', view);
            },

            // Theme
            theme: 'dark',
            toggleTheme: () => {
                const newTheme = get().theme === 'dark' ? 'light' : 'dark';
                set({ theme: newTheme });
                document.documentElement.setAttribute('data-theme', newTheme);
            },

            // UI State
            isCommandPaletteOpen: false,
            setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
            isAiChatOpen: false,
            setAiChatOpen: (open) => set({ isAiChatOpen: open }),
            isShortcutsOpen: false,
            setShortcutsOpen: (open) => set({ isShortcutsOpen: open }),

            // Notifications
            notify: (message, type = 'info') => {
                const now = Date.now();
                if (lastNotify.message === message && now - lastNotify.time < 2000) return;
                lastNotify = { message, time: now };

                if (type === 'success') toast.success(message);
                else if (type === 'error') toast.error(message);
                else toast.info(message);
            },

            // Online Status
            onlineStatus: navigator.onLine,
            setOnlineStatus: (status) => set({ onlineStatus: status }),

            // App Lifecycle
            appState: 'splash',
            setAppState: (appState) => set({ appState }),
            clearAuthSession: () => {
                localStorage.removeItem('beidar_auth_session');
                localStorage.removeItem('beidar_auth_token');
                localStorage.removeItem('beidar_last_activity');
                set({ appState: 'login' });
            },
        }),
        {
            name: 'beidar-app-store',
            partialize: (state) => ({
                activeView: state.activeView,
                theme: state.theme,
            }),
        }
    )
);
