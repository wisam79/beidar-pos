import React, { useState, useEffect } from 'react';
import { HashRouter, useNavigate, useLocation } from 'react-router-dom';
import { AppRoutes } from './routes';
import { useAppStore } from './store/appStore';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './core/queryClient';
import './i18n';
import '@fontsource-variable/readex-pro';
import '@fontsource/lemonada';
import '@fontsource/jetbrains-mono';
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
      } catch {}
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
    setPrefs((prev) => {
      const theme = prev.theme === 'dark' ? 'light' : 'dark';
      const next = { ...prev, theme };
      localStorage.setItem('beidar_preferences', JSON.stringify(next));
      return next;
    });
  };

  if (appState === 'splash') return <SplashScreen />;
  if (appState === 'cloud-auth')
    return (
      <>
        <NativeTitleBar theme="dark" />
        <CloudLoginScreen onSuccess={() => checkAuthStatus()} />
      </>
    );
  if (appState === 'license')
    return (
      <>
        <NativeTitleBar theme="dark" />
        <LicenseScreen onSuccess={() => checkAuthStatus()} />
      </>
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

const MainRoot = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  </QueryClientProvider>
);

const root = createRoot(document.getElementById('root')!);
root.render(<MainRoot />);
