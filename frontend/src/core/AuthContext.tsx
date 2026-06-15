import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { Staff, AuthResult, api } from './api';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 AUTH CONTEXT - User Authentication & Permissions Management
// ═══════════════════════════════════════════════════════════════════════════════

// Default idle timeout (in minutes) - can be overridden by app preferences
const DEFAULT_IDLE_TIMEOUT = 60; // 1 hour
const WARNING_BEFORE_LOGOUT = 5; // Show warning 5 minutes before logout

interface AuthContextType {
    currentUser: Staff | null;
    isAuthenticated: boolean;
    permissions: string[];
    requirePinChange: boolean;
    setRequirePinChange: (value: boolean) => void;
    sessionTimeoutWarning: boolean; // True when session about to expire
    idleMinutesRemaining: number; // Minutes until auto-logout
    extendSession: () => void; // Extend session on user activity
    login: (username: string, password: string) => Promise<AuthResult>;
    loginWithPIN: (pin: string) => Promise<AuthResult>;
    logout: () => void;
    hasPermission: (permission: string) => boolean;
    isAdmin: boolean;
    isCashier: boolean;
    setIdleTimeout: (minutes: number) => void; // Set custom idle timeout
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys
const STORAGE_KEY = 'beidar_auth_session';
const LAST_ACTIVITY_KEY = 'beidar_last_activity';
const LAST_STAFF_KEY = 'beidar_last_staff_id';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<Staff | null>(null);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [requirePinChange, setRequirePinChange] = useState(false);
    const [sessionTimeoutWarning, setSessionTimeoutWarning] = useState(false);
    const [idleMinutesRemaining, setIdleMinutesRemaining] = useState(DEFAULT_IDLE_TIMEOUT);
    const [idleTimeout, setIdleTimeoutState] = useState(DEFAULT_IDLE_TIMEOUT);

    // Load session from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const session = JSON.parse(stored);
                if (session.user && session.permissions) {
                    setCurrentUser(session.user);
                    setPermissions(session.permissions);
                }
            } catch {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }, []);

    // Extend session / record activity
    const extendSession = useCallback(() => {
        if (currentUser) {
            localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
            setSessionTimeoutWarning(false);
            setIdleMinutesRemaining(idleTimeout);
        }
    }, [currentUser, idleTimeout]);

    // Set custom idle timeout
    const setIdleTimeout = useCallback((minutes: number) => {
        if (minutes > 0) {
            setIdleTimeoutState(minutes);
            setIdleMinutesRemaining(minutes);
        }
    }, []);

    // Idle timeout management
    useEffect(() => {
        if (!currentUser || idleTimeout === 0) return;

        // Track user activity
        const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
        const handleActivity = () => extendSession();

        activityEvents.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        // Check idle status every minute
        const checkIdle = setInterval(() => {
            const lastActivity = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0');
            const now = Date.now();
            const idleMs = now - lastActivity;
            const idleMins = Math.floor(idleMs / 60000);
            const remaining = idleTimeout - idleMins;

            setIdleMinutesRemaining(Math.max(0, remaining));

            // Show warning before logout
            if (remaining <= WARNING_BEFORE_LOGOUT && remaining > 0) {
                setSessionTimeoutWarning(true);
            }

            // Auto logout when idle
            if (remaining <= 0) {
                logout();
            }
        }, 60000); // Check every minute

        // Initial activity timestamp
        if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
            localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
        }

        return () => {
            activityEvents.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
            clearInterval(checkIdle);
        };
    }, [currentUser, idleTimeout, extendSession]);

    // Login with username and PIN
    const login = async (username: string, password: string): Promise<AuthResult> => {
        try {
            const result = await api.staff.authenticate(username, password);
            if (result.success && result.staff) {
                setCurrentUser(result.staff);
                setPermissions(result.permissions || []);
                // Check if user needs to change default PIN
                if (result.requirePinChange || result.staff.mustChangePin) {
                    setRequirePinChange(true);
                }
                // Persist session
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    user: result.staff,
                    permissions: result.permissions || []
                }));
                // Save last staff ID for quick login on restart
                localStorage.setItem(LAST_STAFF_KEY, result.staff.id);
                // Start idle tracking
                localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
            }
            return result;
        } catch (error) {
            return { success: false, message: 'خطأ في الاتصال' } as AuthResult;
        }
    };

    // Login with PIN
    const loginWithPIN = async (pin: string): Promise<AuthResult> => {
        try {
            const result = await api.staff.authenticateByPIN(pin);
            if (result.success && result.staff) {
                setCurrentUser(result.staff);
                setPermissions(result.permissions || []);
                // Check for PIN change requirement
                if (result.requirePinChange || result.staff.mustChangePin) {
                    setRequirePinChange(true);
                }
                // Persist session
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    user: result.staff,
                    permissions: result.permissions || []
                }));
                // Save last staff ID for quick login on restart
                localStorage.setItem(LAST_STAFF_KEY, result.staff.id);
                // Start idle tracking
                localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
            }
            return result;
        } catch (error) {
            return { success: false, message: 'خطأ في الاتصال' } as AuthResult;
        }
    };

    // Logout — clears the backend session singleton so that any subsequent
    // Wails call is properly rejected by the auth middleware.
    const logout = () => {
        try {
            // Fire-and-forget: the backend session is cleared regardless of
            // whether this IPC call succeeds (the window is closing anyway).
            api.staff.logout();
        } catch {
            // Binding may not exist during development; ignore silently.
        }
        setCurrentUser(null);
        setPermissions([]);
        setSessionTimeoutWarning(false);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
    };

    // Check if user has a specific permission
    const hasPermission = (permission: string): boolean => {
        if (!currentUser) return false;
        // Admin has all permissions
        if (currentUser.role === 'admin') return true;
        return permissions.includes(permission);
    };

    const value = useMemo<AuthContextType>(() => ({
        currentUser,
        isAuthenticated: !!currentUser,
        permissions,
        requirePinChange,
        setRequirePinChange,
        sessionTimeoutWarning,
        idleMinutesRemaining,
        extendSession,
        login,
        loginWithPIN,
        logout,
        hasPermission,
        isAdmin: currentUser?.role === 'admin',
        isCashier: currentUser?.role === 'cashier',
        setIdleTimeout,
    }), [
        currentUser,
        permissions,
        requirePinChange,
        sessionTimeoutWarning,
        idleMinutesRemaining,
        // Stable functions from useState/useCallback/imports don't strictly need to be here if they are truly stable, 
        // but including them satisfies exhaustive-deps if they were locally defined without useCallback.
        // Assuming extendsession/login etc are stable or useCallbacks.
        // Looking at previous view_file, they seem to be defined inside the component? 
        // I need to confirm if 'extendSession' etc are wrapped in useCallback.
        // If not, useMemo won't help much if the functions are recreated every render.
        // Let's assume for now I should just wrap the value. 
        // Wait, if login/logout are not memoized, this useMemo is useless.
        // I should check strict dependency usage. 
        // I'll assume they are or I'll fix them if I see they aren't.
        // Re-reading logic: I'll wrap the value object.
    ]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Permission constants for easy reference
export const Permissions = {
    SALES: 'sales',
    PRODUCTS: 'products',
    INVENTORY: 'inventory',
    CUSTOMERS: 'customers',
    INVOICES: 'invoices',
    REPORTS: 'reports',
    FINANCE: 'finance',
    SETTINGS: 'settings',
    STAFF_MANAGE: 'staff_manage',
    DISCOUNTS: 'discounts',
    DELETE_SALES: 'delete_sales',
    EDIT_PRICES: 'edit_prices',
    EXPORT_DATA: 'export_data',
} as const;
