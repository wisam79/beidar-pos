/**
 * AuthStore Unit Tests
 * Tests the authentication state management in Zustand store
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAuthStore, type CurrentUser } from '../store/authStore';

// Helper to reset the store state before each test
function resetAuthStore() {
    useAuthStore.setState({
        currentUser: null,
        isAuthenticated: false,
        requirePinChange: false,
        lastActivity: Date.now(),
    });
}

const mockAdminUser: CurrentUser = {
    id: 'admin-001',
    username: 'admin',
    name: 'Admin User',
    role: 'admin',
    permissions: [],
};

const mockCashierUser: CurrentUser = {
    id: 'cashier-001',
    username: 'karrar',
    name: 'Karrar Cashier',
    role: 'cashier',
    permissions: ['sales', 'products', 'customers'],
};

describe('useAuthStore', () => {
    beforeEach(() => {
        resetAuthStore();
    });

    describe('Initial State', () => {
        it('should start with no user logged in', () => {
            const { result } = renderHook(() => useAuthStore());
            expect(result.current.currentUser).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.requirePinChange).toBe(false);
        });
    });

    describe('login()', () => {
        it('should set currentUser and isAuthenticated on login', () => {
            const { result } = renderHook(() => useAuthStore());

            act(() => {
                result.current.login(mockAdminUser);
            });

            expect(result.current.currentUser).toEqual(mockAdminUser);
            expect(result.current.isAuthenticated).toBe(true);
        });

        it('should update lastActivity on login', () => {
            const { result } = renderHook(() => useAuthStore());
            const before = Date.now();

            act(() => {
                result.current.login(mockCashierUser);
            });

            expect(result.current.lastActivity).toBeGreaterThanOrEqual(before);
        });
    });

    describe('logout()', () => {
        it('should clear user and reset auth state on logout', () => {
            const { result } = renderHook(() => useAuthStore());

            act(() => {
                result.current.login(mockAdminUser);
            });
            expect(result.current.isAuthenticated).toBe(true);

            act(() => {
                result.current.logout();
            });

            expect(result.current.currentUser).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.requirePinChange).toBe(false);
        });
    });

    describe('setCurrentUser()', () => {
        it('should update currentUser and sync isAuthenticated', () => {
            const { result } = renderHook(() => useAuthStore());

            act(() => {
                result.current.setCurrentUser(mockCashierUser);
            });

            expect(result.current.currentUser?.username).toBe('karrar');
            expect(result.current.isAuthenticated).toBe(true);
        });

        it('should set isAuthenticated to false when passing null', () => {
            const { result } = renderHook(() => useAuthStore());

            act(() => {
                result.current.login(mockAdminUser);
                result.current.setCurrentUser(null);
            });

            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.currentUser).toBeNull();
        });
    });

    describe('setRequirePinChange()', () => {
        it('should update requirePinChange flag', () => {
            const { result } = renderHook(() => useAuthStore());

            act(() => {
                result.current.setRequirePinChange(true);
            });
            expect(result.current.requirePinChange).toBe(true);

            act(() => {
                result.current.setRequirePinChange(false);
            });
            expect(result.current.requirePinChange).toBe(false);
        });
    });

    describe('updateLastActivity()', () => {
        it('should update lastActivity timestamp', async () => {
            const { result } = renderHook(() => useAuthStore());

            const initial = result.current.lastActivity;
            // Wait a tiny bit to ensure timestamp difference
            await new Promise(r => setTimeout(r, 5));

            act(() => {
                result.current.updateLastActivity();
            });

            expect(result.current.lastActivity).toBeGreaterThan(initial);
        });
    });

    describe('hasPermission()', () => {
        it('should return true for admin regardless of permission', () => {
            const { result } = renderHook(() => useAuthStore());

            act(() => {
                result.current.login(mockAdminUser);
            });

            expect(result.current.hasPermission('sales')).toBe(true);
            expect(result.current.hasPermission('settings')).toBe(true);
            expect(result.current.hasPermission('any_random_perm')).toBe(true);
        });

        it('should return true only for cashier\'s granted permissions', () => {
            const { result } = renderHook(() => useAuthStore());

            act(() => {
                result.current.login(mockCashierUser);
            });

            expect(result.current.hasPermission('sales')).toBe(true);
            expect(result.current.hasPermission('products')).toBe(true);
            expect(result.current.hasPermission('customers')).toBe(true);
            expect(result.current.hasPermission('settings')).toBe(false);
            expect(result.current.hasPermission('finance')).toBe(false);
        });

        it('should return false when no user is logged in', () => {
            const { result } = renderHook(() => useAuthStore());
            expect(result.current.hasPermission('sales')).toBe(false);
        });
    });
});
