import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { View, Notification } from '../core/types';

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
    notifications: Notification[];
    notify: (message: string, type?: 'success' | 'error' | 'info') => void;
    removeNotification: (id: number) => void;

    // Online Status
    onlineStatus: boolean;
    setOnlineStatus: (status: boolean) => void;

    // App Lifecycle
    appState: 'splash' | 'cloud-auth' | 'license' | 'login' | 'app';
    setAppState: (state: 'splash' | 'cloud-auth' | 'license' | 'login' | 'app') => void;
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

            // Notifications with deduplication
            notifications: [],
            notify: (message, type = 'info') => {
                const now = Date.now();
                // Prevent duplicate notifications within 2 seconds
                if (lastNotify.message === message && now - lastNotify.time < 2000) {
                    return;
                }
                lastNotify = { message, time: now };

                set((state) => ({
                    notifications: [
                        ...state.notifications.filter((n) => n.message !== message),
                        { id: now, message, type },
                    ].slice(-3),
                }));
            },
            removeNotification: (id) =>
                set((state) => ({
                    notifications: state.notifications.filter((n) => n.id !== id),
                })),

            // Online Status
            onlineStatus: navigator.onLine,
            setOnlineStatus: (status) => set({ onlineStatus: status }),

            // App Lifecycle
            appState: 'splash',
            setAppState: (appState) => set({ appState }),
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
