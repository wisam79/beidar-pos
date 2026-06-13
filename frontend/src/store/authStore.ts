import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CurrentUser {
    id: string;
    username: string;
    name: string;
    role: 'admin' | 'manager' | 'cashier' | 'viewer';
    permissions: string[];
}

interface AuthState {
    // Current User
    currentUser: CurrentUser | null;
    setCurrentUser: (user: CurrentUser | null) => void;

    // Auth Status
    isAuthenticated: boolean;
    requirePinChange: boolean;
    setRequirePinChange: (require: boolean) => void;

    // Session
    lastActivity: number;
    updateLastActivity: () => void;

    // Actions
    login: (user: CurrentUser) => void;
    logout: () => void;

    // Permission Check
    hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            // Current User
            currentUser: null,
            setCurrentUser: (user) =>
                set({ currentUser: user, isAuthenticated: !!user }),

            // Auth Status
            isAuthenticated: false,
            requirePinChange: false,
            setRequirePinChange: (require) => set({ requirePinChange: require }),

            // Session
            lastActivity: Date.now(),
            updateLastActivity: () => set({ lastActivity: Date.now() }),

            // Actions
            login: (user) =>
                set({
                    currentUser: user,
                    isAuthenticated: true,
                    lastActivity: Date.now(),
                }),
            logout: () =>
                set({
                    currentUser: null,
                    isAuthenticated: false,
                    requirePinChange: false,
                }),

            // Permission Check
            hasPermission: (permission) => {
                const user = get().currentUser;
                if (!user) return false;
                if (user.role === 'admin') return true;
                return user.permissions.includes(permission);
            },
        }),
        {
            name: 'beidar-auth-store',
            partialize: (state) => ({
                // Don't persist sensitive data
                lastActivity: state.lastActivity,
            }),
        }
    )
);
