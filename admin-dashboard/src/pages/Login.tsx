import React, { useState } from 'react';
import { Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLoginError('يرجى كتابة البريد الإلكتروني وكلمة المرور.');
      return;
    }
    setLoggingIn(true);
    setLoginError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      setLoginError(err.message || 'فشل تسجيل الدخول.');
      setLoggingIn(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#090d16] p-4 bg-mesh"
      dir="rtl"
    >
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md p-8 rounded-3xl border border-border bg-surface/80 backdrop-blur-xl shadow-2xl glass">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl relative">
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-2xl animate-pulse" />
            <Shield size={44} className="text-blue-500 relative z-10" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-center mb-1 text-text-main">
          منطقة مسؤولي النظام
        </h2>
        <p className="text-center text-text-muted text-sm mb-6">
          تسجيل دخول آمن لإدارة تراخيص Beidar POS
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted mb-2">
              البريد الإلكتروني للمسؤول
            </label>
            <input
              type="email"
              placeholder="admin@beidar.com"
              className="w-full bg-slate-900/50 border border-border rounded-xl px-4 py-3 text-text-main outline-none focus:border-blue-500/50 focus:bg-slate-900 transition-all text-right"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted mb-2">
              كلمة المرور
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full bg-slate-900/50 border border-border rounded-xl px-4 py-3 text-text-main outline-none focus:border-blue-500/50 focus:bg-slate-900 transition-all text-right"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {loginError && (
            <div className="text-red-500 text-xs font-bold px-3 py-2.5 bg-red-500/10 rounded-xl border border-red-500/20 flex items-center gap-2 justify-center">
              <AlertTriangle size={14} />
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={loggingIn}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loggingIn ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>جاري تسجيل الدخول...</span>
              </>
            ) : (
              <span>تسجيل الدخول</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
