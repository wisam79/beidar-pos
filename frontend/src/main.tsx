import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { HashRouter, useNavigate, useLocation } from 'react-router-dom';
import { AppRoutes } from './routes';
import { useAppStore } from './store/appStore';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './core/queryClient';
import './i18n';
import '@fontsource-variable/readex-pro';
import './index.css';
import { type View, type AppPreferences } from './core/types';
import { safeJSONParse } from './core/utils';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SplashScreen } from './components/SplashScreen';
import { LicenseScreen } from './components/LicenseScreen';
import { LoginScreen } from './components/LoginScreen';
import { CloudLoginScreen } from './components/CloudLoginScreen';
import { NativeTitleBar } from './components/NativeTitleBar';
import { AuthProvider } from './core/AuthContext';
import { MainLayout } from './layouts/MainLayout';
import { DEFAULT_PREFS } from './core/constants';
import { PreferencesProvider } from './components/PreferencesContext';
import { useTheme } from './hooks/useTheme';
import { useAutoSelectInput } from './hooks/useAutoSelectInput';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts';
import { useAutoBackup } from './hooks/useAutoBackup';
import { useAppInitialization } from './hooks/useAppInitialization';
import { AppCloseDialog } from './components/AppCloseDialog';

const App = () => {
  const appState = useAppStore((s) => s.appState);
  const setAppState = useAppStore((s) => s.setAppState);
  const notify = useAppStore((s) => s.notify);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const isCommandPaletteOpen = useAppStore((s) => s.isCommandPaletteOpen);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const isShortcutsOpen = useAppStore((s) => s.isShortcutsOpen);
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen);

  const navigate = useNavigate();
  const location = useLocation();

  const [appVersion, setAppVersion] = useState('...');
  const [aiContext, setAiContext] = useState({ revenue: 0, orders: 0, lowStock: 0 });
  const [prefs, setPrefs] = useState<AppPreferences>(() => ({
    ...DEFAULT_PREFS,
    ...safeJSONParse('beidar_preferences', DEFAULT_PREFS),
  }));

  // Hooks
  useTheme(prefs);
  useAutoSelectInput();
  useOnlineStatus();

  // Global native desktop hardening
  useEffect(() => {
    // 1. Block right click globally except for input text selection
    const preventContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener('contextmenu', preventContextMenu);

    // 2. Block pinch-to-zoom and Ctrl+Wheel zoom gestures
    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    document.addEventListener('wheel', preventZoom, { passive: false });

    // 3. Block browser hotkeys: F5, Ctrl+R (Reload), Ctrl+Shift+I, F12 (DevTools), Ctrl+P (Print), Ctrl+S (Save), Ctrl+F (Find)
    const preventKeys = (e: KeyboardEvent) => {
      const isReload = e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'));
      const isDevTools = e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I'));
      const isPrint = e.ctrlKey && (e.key === 'p' || e.key === 'P');
      const isSave = e.ctrlKey && (e.key === 's' || e.key === 'S');
      const isFind = e.ctrlKey && (e.key === 'f' || e.key === 'F');
      const isZoom = e.ctrlKey && (e.key === '=' || e.key === '+' || e.key === '-' || e.key === '0');

      if (isReload || isDevTools || isPrint || isSave || isFind || isZoom) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', preventKeys);

    // 4. Block Backspace back-navigation
    const preventBackspace = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (!['INPUT', 'TEXTAREA'].includes(target.tagName) && !target.isContentEditable) {
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', preventBackspace);

    // 5. Block dragging images/files into the window
    const preventDragOver = (e: DragEvent) => e.preventDefault();
    const preventDrop = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', preventDragOver);
    window.addEventListener('drop', preventDrop);

    // 6. Disable browser autocomplete, autocorrect, and spellcheck globally for native feel
    const disableInputAssist = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        if (!target.hasAttribute('autocomplete')) {
          target.setAttribute('autocomplete', 'off');
        }
        if (!target.hasAttribute('autocorrect')) {
          target.setAttribute('autocorrect', 'off');
        }
        if (!target.hasAttribute('spellcheck')) {
          target.setAttribute('spellcheck', 'false');
        }
      }
    };
    document.addEventListener('focusin', disableInputAssist);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('wheel', preventZoom);
      window.removeEventListener('keydown', preventKeys);
      window.removeEventListener('keydown', preventBackspace);
      window.removeEventListener('dragover', preventDragOver);
      window.removeEventListener('drop', preventDrop);
      document.removeEventListener('focusin', disableInputAssist);
    };
  }, []);

  // Init: auth flow + version check + AI context
  const { checkAuthStatus } = useAppInitialization();

  useEffect(() => {
    import('./core/api').then(({ desktopApi }) => {
      desktopApi.update
        .getCurrentVersion()
        .then((v) => setAppVersion(v || 'dev'))
        .catch(() => setAppVersion('dev'));

      if (appState === 'app') {
        desktopApi.update
          .checkForUpdates()
          .then((info) => {
            if (info?.update_available) {
              notify(`🚀 تحديث جديد متوفر: v${info.version}`, 'info');
            }
          })
          .catch(() => {});
      }
    });
  }, [appState, notify]);

  useEffect(() => {
    if (appState !== 'app') return;
    const load = async () => {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const stats = await import('./core/api').then((m) => m.api.stats.getDashboard());
        setAiContext({
          revenue: stats.totalRevenue || 0,
          orders: Number(stats.totalOrders || 0),
          lowStock: Number(stats.lowStockCount || 0),
        });
      } catch { /* preload is best-effort */ }
    };
    load();
  }, [appState]);

  useAutoBackup(appState, prefs, setPrefs, notify);

  useGlobalKeyboardShortcuts(
    appState,
    isCommandPaletteOpen,
    isShortcutsOpen,
    () => setCommandPaletteOpen(!isCommandPaletteOpen),
    () => setShortcutsOpen(!isShortcutsOpen),
    (view: View) => navigate('/' + view),
  );

  useEffect(() => {
    const path = location.pathname.substring(1) || 'dashboard';
    const view = path.split('/')[0] as View;
    if (view && view !== useAppStore.getState().activeView) setActiveView(view);
  }, [location.pathname, setActiveView]);

  const toggleTheme = () => {
    setPrefs((prev: AppPreferences) => {
      const theme: AppPreferences['theme'] = prev.theme === 'dark' ? 'light' : 'dark';
      const next: AppPreferences = { ...prev, theme };
      localStorage.setItem('beidar_preferences', JSON.stringify(next));
      return next;
    });
  };

  if (appState === 'splash') return <SplashScreen />;
  if (appState === 'cloud-auth')
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-bg">
        <NativeTitleBar theme="dark" />
        <div className="flex-1 overflow-auto">
          <CloudLoginScreen onSuccess={() => checkAuthStatus()} />
        </div>
      </div>
    );
  if (appState === 'license')
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-bg">
        <NativeTitleBar theme="dark" />
        <div className="flex-1 overflow-auto">
          <LicenseScreen onSuccess={() => checkAuthStatus()} />
        </div>
      </div>
    );
  if (appState === 'login') return <LoginScreen onLoginSuccess={() => setAppState('app')} />;

  return (
    <PreferencesProvider prefs={prefs} setPrefs={setPrefs} notify={notify} setView={(v: View) => navigate('/' + v)}>
      <MainLayout
        prefs={prefs}
        onToggleTheme={toggleTheme}
        onNavigate={(v: View) => navigate('/' + v)}
        onLogout={() => setAppState('login')}
        aiContext={aiContext}
        appVersion={appVersion}
      >
        <AppRoutes />
      </MainLayout>
    </PreferencesProvider>
  );
};

import { TooltipProvider } from '@/components/shadcn/tooltip';

const MainRoot = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster position="top-center" dir="rtl" />
            <AppCloseDialog />
            <App />
          </TooltipProvider>
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  </QueryClientProvider>
);

const root = createRoot(document.getElementById('root')!);
root.render(<MainRoot />);
