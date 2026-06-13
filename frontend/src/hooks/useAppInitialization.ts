import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';

export type AppState = 'splash' | 'cloud-auth' | 'license' | 'login' | 'app';

export function useAppInitialization() {
  const appState = useAppStore((s) => s.appState);
  const setAppState = useAppStore((s) => s.setAppState);

  const checkAuthStatus = useCallback(async () => {
    // 1. Check LAN Client
    try {
      const status = await import('../core/api').then((m) => m.api.lan.getClientStatus());
      if (status?.connected) {
        setAppState('login');
        return;
      }
    } catch {
      console.error('LAN check failed');
    }

    // 2. Check License
    try {
      const result = await import('../core/api').then((m) => m.desktopApi.license.getUserLicenseStatus());
      if (result?.licensed) {
        setAppState('login');
        return;
      }
    } catch {
      console.error('License check failed');
    }

    // 3. Check Cloud Login
    try {
      const isLoggedIn = await import('../core/api').then((m) => m.api.cloud.isLoggedIn());
      if (!isLoggedIn) {
        setAppState('cloud-auth');
        return;
      }
    } catch {
      console.error('Cloud check failed');
    }

    // 4. Fallback: Show License Screen
    setAppState('license');
  }, [setAppState]);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  return { appState, setAppState, checkAuthStatus };
}
