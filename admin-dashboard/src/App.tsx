import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { supabase } from './supabase';
import { useToast } from './components';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './pages/Login';
import { Licenses } from './pages/Licenses';
import { CreateLicense } from './pages/CreateLicense';
import { Settings } from './pages/Settings';
import { AuditLogs } from './pages/AuditLogs';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Theme application
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [theme]);

  const handleSession = async (session: any) => {
    setSession(session);
    if (session?.user) {
      setLoadingAuth(true);
      try {
        const { data, error } = await supabase
          .from('app_admins')
          .select('*')
          .eq('user_id', session.user.id);

        if (error || !data || data.length === 0) {
          throw new Error('أنت لا تملك صلاحيات مسؤول النظام في Beidar.');
        }

        setIsAdmin(true);
      } catch (err: any) {
        showToast(err.message || 'الدخول مرفوض: لست مسؤولاً.', 'error');
        setIsAdmin(false);
        supabase.auth.signOut();
      } finally {
        setLoadingAuth(false);
      }
    } else {
      setIsAdmin(false);
      setLoadingAuth(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const logAdminAction = async (action: string, targetLicense: string, details: string) => {
    if (!session?.user?.email) return;
    try {
      await supabase.from('admin_logs').insert({
        admin_username: session.user.email,
        action,
        target_license: targetLicense,
        details,
      });
    } catch (err) {
      console.error('Failed to log admin action:', err);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090d16] text-[#f8fafc]">
        <div className="flex flex-col items-center">
          <RefreshCw className="animate-spin text-blue-500 mb-4" size={40} />
          <span className="text-sm font-semibold tracking-wider text-slate-400">
            جاري التحقق من التراخيص الأمنية...
          </span>
        </div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <>
        <Login />
        {ToastComponent}
      </>
    );
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col md:flex-row bg-bg text-text-main" dir="rtl">
        {/* Sidebar */}
        <Sidebar
          session={session}
          handleLogout={handleLogout}
          theme={theme}
          setTheme={setTheme}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Header */}
          <Header loadingData={loadingGlobal} />

          {/* View Areas */}
          <div className="p-6 flex-1">
            <Routes>
              <Route
                path="/"
                element={
                  <Licenses
                    showToast={showToast}
                    setLoadingGlobal={setLoadingGlobal}
                    logAdminAction={logAdminAction}
                  />
                }
              />
              <Route
                path="/create"
                element={
                  <CreateLicense
                    showToast={showToast}
                    setLoadingGlobal={setLoadingGlobal}
                    logAdminAction={logAdminAction}
                  />
                }
              />
              <Route
                path="/keys"
                element={
                  <Settings
                    showToast={showToast}
                    setLoadingGlobal={setLoadingGlobal}
                    logAdminAction={logAdminAction}
                  />
                }
              />
              <Route
                path="/logs"
                element={
                  <AuditLogs
                    showToast={showToast}
                    setLoadingGlobal={setLoadingGlobal}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>

        {/* Toast rendering */}
        {ToastComponent}
      </div>
    </Router>
  );
}
