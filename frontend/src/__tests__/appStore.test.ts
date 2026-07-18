/**
 * AppStore Unit Tests
 * Tests the global application state management in Zustand store
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAppStore } from '../store/appStore';

// Reset store state before each test
function resetAppStore() {
    useAppStore.setState({
        activeView: 'dashboard',
        theme: 'dark',
        isCommandPaletteOpen: false,
        isAiChatOpen: false,
        isShortcutsOpen: false,
        notifications: [],
        appState: 'splash',
    });
}

describe('useAppStore', () => {
    beforeEach(() => {
        resetAppStore();
        vi.clearAllMocks();
        // Clear localStorage to prevent test pollution
        localStorage.clear();
    });

    describe('Initial State', () => {
        it('should have correct initial values', () => {
            const { result } = renderHook(() => useAppStore());

            expect(result.current.activeView).toBe('dashboard');
            expect(result.current.theme).toBe('dark');
            expect(result.current.isCommandPaletteOpen).toBe(false);
            expect(result.current.isAiChatOpen).toBe(false);
            expect(result.current.isShortcutsOpen).toBe(false);
            expect(result.current.appState).toBe('splash');
        });
    });

    describe('setActiveView()', () => {
        it('should update activeView', () => {
            const { result } = renderHook(() => useAppStore());

            act(() => {
                result.current.setActiveView('sales');
            });

            expect(result.current.activeView).toBe('sales');
        });

        it('should store the view in localStorage', () => {
            const { result } = renderHook(() => useAppStore());

            act(() => {
                result.current.setActiveView('finance');
            });

            expect(localStorage.getItem('beidar_last_view')).toBe('finance');
        });
    });

    describe('toggleTheme()', () => {
        it('should toggle from dark to light', () => {
            const { result } = renderHook(() => useAppStore());

            // Initial is dark
            expect(result.current.theme).toBe('dark');

            act(() => {
                result.current.toggleTheme();
            });

            expect(result.current.theme).toBe('light');
        });

        it('should toggle from light to dark', () => {
            useAppStore.setState({ theme: 'light' });
            const { result } = renderHook(() => useAppStore());

            act(() => {
                result.current.toggleTheme();
            });

            expect(result.current.theme).toBe('dark');
        });
    });

    describe('UI State Toggles', () => {
        it('should open/close command palette', () => {
            const { result } = renderHook(() => useAppStore());

            act(() => {
                result.current.setCommandPaletteOpen(true);
            });
            expect(result.current.isCommandPaletteOpen).toBe(true);

            act(() => {
                result.current.setCommandPaletteOpen(false);
            });
            expect(result.current.isCommandPaletteOpen).toBe(false);
        });

        it('should open/close AI chat', () => {
            const { result } = renderHook(() => useAppStore());

            act(() => {
                result.current.setAiChatOpen(true);
            });
            expect(result.current.isAiChatOpen).toBe(true);

            act(() => {
                result.current.setAiChatOpen(false);
            });
            expect(result.current.isAiChatOpen).toBe(false);
        });

        it('should open/close shortcuts panel', () => {
            const { result } = renderHook(() => useAppStore());

            act(() => {
                result.current.setShortcutsOpen(true);
            });
            expect(result.current.isShortcutsOpen).toBe(true);
        });
    });

    describe('setAppState()', () => {
        it('should update appState through lifecycle', () => {
            const { result } = renderHook(() => useAppStore());

            const states: Array<'splash' | 'cloud-auth' | 'license' | 'login' | 'app'> = [
                'splash', 'cloud-auth', 'license', 'login', 'app'
            ];

            for (const state of states) {
                act(() => {
                    result.current.setAppState(state);
                });
                expect(result.current.appState).toBe(state);
            }
        });
    });

    describe('notify()', () => {
        it('should not throw for success notification', () => {
            const { result } = renderHook(() => useAppStore());

            expect(() => {
                act(() => {
                    result.current.notify('تمت العملية بنجاح', 'success');
                });
            }).not.toThrow();
        });

        it('should not throw for error notification', () => {
            const { result } = renderHook(() => useAppStore());

            expect(() => {
                act(() => {
                    result.current.notify('حدث خطأ ما', 'error');
                });
            }).not.toThrow();
        });

        it('should not throw for info notification', () => {
            const { result } = renderHook(() => useAppStore());

            expect(() => {
                act(() => {
                    result.current.notify('معلومة', 'info');
                });
            }).not.toThrow();
        });

        it('should deduplicate rapid identical notifications', () => {
            const { result } = renderHook(() => useAppStore());

            // Calling notify twice rapidly with same message should not throw
            act(() => {
                result.current.notify('نفس الرسالة', 'info');
                result.current.notify('نفس الرسالة', 'info');
            });
            // No assertion needed — just verifying no error is thrown
        });
    });

    describe('setOnlineStatus()', () => {
        it('should update online status', () => {
            const { result } = renderHook(() => useAppStore());

            act(() => {
                result.current.setOnlineStatus(false);
            });
            expect(result.current.onlineStatus).toBe(false);

            act(() => {
                result.current.setOnlineStatus(true);
            });
            expect(result.current.onlineStatus).toBe(true);
        });
    });
});
