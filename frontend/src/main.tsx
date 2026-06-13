import React, { useEffect, useState } from 'react';
import { HashRouter, useNavigate, useLocation } from 'react-router-dom';
import { AppRoutes } from './routes';
import { useAppStore } from './store/appStore';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './core/queryClient';
import './i18n';
// Local fonts for offline usage
import '@fontsource-variable/readex-pro';
import '@fontsource/lemonada';
import '@fontsource/jetbrains-mono';
import './index.css';
import { View, AppPreferences, Product } from './core/types';
import { safeJSONParse, playBeep } from './core/utils';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SplashScreen } from './components/SplashScreen';
import { LicenseScreen } from './components/LicenseScreen';
import { LoginScreen } from './components/LoginScreen';
import { CloudLoginScreen } from './components/CloudLoginScreen';
import { NativeTitleBar } from './components/NativeTitleBar';
import { AuthProvider } from './core/AuthContext';
import { MainLayout } from './layouts/MainLayout';
import { DEFAULT_PREFS } from './core/constants';

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 APP - Lean Entry Point (Refactored)
// ═══════════════════════════════════════════════════════════════════════════════

const App = () => {
  const appState = useAppStore(state => state.appState);
  const setAppState = useAppStore(state => state.setAppState);
  const notify = useAppStore(state => state.notify);
  const setActiveView = useAppStore(state => state.setActiveView);
  const isCommandPaletteOpen = useAppStore(state => state.isCommandPaletteOpen);
  const setCommandPaletteOpen = useAppStore(state => state.setCommandPaletteOpen);
  const isShortcutsOpen = useAppStore(state => state.isShortcutsOpen);
  const setShortcutsOpen = useAppStore(state => state.setShortcutsOpen);
  const setOnlineStatus = useAppStore(state => state.setOnlineStatus);

  const navigate = useNavigate();
  const location = useLocation();

  const [appVersion, setAppVersion] = useState('...');
  const [aiContext, setAiContext] = useState<{ revenue: number; orders: number; lowStock: number }>({ revenue: 0, orders: 0, lowStock: 0 });

  // ─────────────────────────────────────────────────────────────────────────────
  // Preferences (persisted in localStorage)
  // ─────────────────────────────────────────────────────────────────────────────
  const [prefs, setPrefs] = useState<AppPreferences>(() => {
    const saved = safeJSONParse('beidar_preferences', DEFAULT_PREFS);
    return { ...DEFAULT_PREFS, ...saved };
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Theme & Font Application
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const sizeMap: Record<string, string> = { 'normal': '15px', 'large': '16px', 'xl': '17px' };
    document.documentElement.style.fontSize = sizeMap[prefs.fontSize || 'normal'] || '15px';
    document.documentElement.setAttribute('data-theme', prefs.theme || 'dark');
    document.documentElement.style.setProperty('--color-primary', prefs.accentColor);
    const r = parseInt(prefs.accentColor.slice(1, 3), 16);
    const g = parseInt(prefs.accentColor.slice(3, 5), 16);
    const b = parseInt(prefs.accentColor.slice(5, 7), 16);
    document.documentElement.style.setProperty('--color-primary-rgb', `${r},${g},${b}`);
    document.documentElement.style.setProperty('--color-primary-dim', `rgba(${r},${g},${b},0.25)`);
  }, [prefs.fontSize, prefs.theme, prefs.accentColor]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Initialization & Auth Flow
  // ─────────────────────────────────────────────────────────────────────────────
  const checkAuthStatus = async () => {
    // 1. Check LAN Client
    let isLanClient = false;
    try {
      const status = await import('./core/api').then(m => m.api.lan.getClientStatus());
      if (status?.connected) isLanClient = true;
    } catch (e) { console.error('LAN check failed', e); }

    if (isLanClient) {
      setAppState('login');
      return;
    }

    // 2. Check License (Priority for Offline Support)
    let licensed = false;
    try {
      const result = await import('./core/api').then(m => m.desktopApi.license.getUserLicenseStatus());
      licensed = result?.licensed ?? false;
    } catch (e) { console.error('License check failed', e); }

    if (licensed) {
      setAppState('login');
      return;
    }

    // 3. Check Cloud Login (Only if not licensed)
    let isLoggedIn = false;
    try {
      isLoggedIn = await import('./core/api').then(m => m.api.cloud.isLoggedIn());
    } catch (e) { console.error('Cloud check failed', e); }

    if (!isLoggedIn) {
      setAppState('cloud-auth');
      return;
    }

    // 4. Fallback: Logged in to Cloud but not licensed -> Show License Screen
    setAppState('license');
  };

  useEffect(() => { checkAuthStatus(); }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Online/Offline Status
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnlineStatus]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-Select Input Text
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleInputFocus = (e: FocusEvent) => {
      const target = e.target as HTMLInputElement;
      if (!target) return;
      if (['text', 'number', 'email', 'password'].includes(target.type)) {
        setTimeout(() => target.select(), 0);
      }
      if (target.type === 'number' && ['0', '0.00', '0.0'].includes(target.value)) {
        target.value = '';
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    document.addEventListener('focusin', handleInputFocus);
    return () => document.removeEventListener('focusin', handleInputFocus);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // App Version
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    import('./core/api').then(({ desktopApi }) => {
      // Get version
      desktopApi.update.getCurrentVersion()
        .then(v => setAppVersion(v || 'dev'))
        .catch(() => setAppVersion('dev'));

      // Check for updates silently
      if (appState === 'app') {
        desktopApi.update.checkForUpdates().then(info => {
          if (info && info.update_available) {
            notify(`🚀 تحديث جديد متوفر: v${info.version} - يرجى التوجه للإعدادات للتحديث`, 'info');
            playBeep('success');
          }
        }).catch(err => console.error('Silent update check failed', err));
      }
    });
  }, [appState, notify]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Keyboard Shortcuts
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (appState !== 'app') return;
      if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) { e.preventDefault(); return; }
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I'))) { e.preventDefault(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCommandPaletteOpen(!isCommandPaletteOpen); return; }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault(); setShortcutsOpen(!isShortcutsOpen); return;
      }
      const viewMap: Record<string, View> = { F1: 'dashboard', F2: 'sales', F3: 'products', F4: 'inventory', F5: 'invoices', F6: 'customers', F7: 'finance', F8: 'reports' };
      if (viewMap[e.key]) { e.preventDefault(); handleSetView(viewMap[e.key]); playBeep('success'); }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [appState, isCommandPaletteOpen, isShortcutsOpen, setCommandPaletteOpen, setShortcutsOpen]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Navigation Helpers
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const path = location.pathname.substring(1) || 'dashboard';
    const view = path.split('/')[0] as View;
    if (view && view !== useAppStore.getState().activeView) setActiveView(view);
  }, [location.pathname, setActiveView]);

  const handleSetView = (view: View) => navigate('/' + view);
  const toggleTheme = () => {
    setPrefs(prev => {
      const newTheme = prev.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('beidar_preferences', JSON.stringify({ ...prev, theme: newTheme }));
      return { ...prev, theme: newTheme };
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Load Global Data (for AI Context)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (appState !== 'app') return;
    const loadData = async () => {
      await new Promise(r => setTimeout(r, 1000)); // Delay to prioritize UI
      try {
        const stats = await import('./core/api').then(m => m.api.stats.getDashboard());
        setAiContext({ revenue: stats.totalRevenue || 0, orders: Number(stats.totalOrders || 0), lowStock: Number(stats.lowStockCount || 0) });
      } catch (e) { console.error('Failed to load AI context', e); }
    };
    loadData();
  }, [appState]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto Backup
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (appState !== 'app' || !prefs.autoBackup) return;

    const today = new Date().toISOString().split('T')[0];
    // Check if backup already done today (using broad check to handle ISO Full strings)
    if (prefs.lastBackupDate && prefs.lastBackupDate.startsWith(today)) return;

    const performBackup = async () => {
      // 5 second delay to let app settle and not block initial render
      await new Promise(r => setTimeout(r, 5000));

      try {
        const { api } = await import('./core/api');
        await api.db.createBackup();

        // Update state
        const now = new Date().toISOString();
        setPrefs(prev => {
          const next = { ...prev, lastBackupDate: now };
          localStorage.setItem('beidar_preferences', JSON.stringify(next));
          api.prefs.set(next).catch(console.error); // Best effort sync
          return next;
        });

        notify('تم إجراء النسخ الاحتياطي التلقائي بنجاح ✅', 'success');
        playBeep('success');
      } catch (e) {
        console.error('Auto backup failed', e);
        notify('فشل النسخ الاحتياطي التلقائي', 'error');
      }
    };

    performBackup();
  }, [appState, prefs.autoBackup, prefs.lastBackupDate, notify, setPrefs]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render States
  // ─────────────────────────────────────────────────────────────────────────────
  if (appState === 'splash') return <SplashScreen />;
  if (appState === 'cloud-auth') return <><NativeTitleBar theme="dark" /><CloudLoginScreen onSuccess={() => checkAuthStatus()} /></>;
  if (appState === 'license') return <><NativeTitleBar theme="dark" /><LicenseScreen onSuccess={() => checkAuthStatus()} /></>;
  if (appState === 'login') return <LoginScreen onLoginSuccess={() => setAppState('app')} />;

  // ─────────────────────────────────────────────────────────────────────────────
  // Main App
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <MainLayout
      prefs={prefs}
      onToggleTheme={toggleTheme}
      onNavigate={handleSetView}
      onLogout={() => setAppState('login')}
      aiContext={aiContext}
      appVersion={appVersion}
    >
      <AppRoutes prefs={prefs} setPrefs={setPrefs} notify={notify} setView={handleSetView} />
    </MainLayout>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Root Render
// ═══════════════════════════════════════════════════════════════════════════════
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