import React from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, Users, Plus, Key, Activity, LogOut, Sun, Moon } from 'lucide-react';

interface SidebarProps {
  session: any;
  handleLogout: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark' | ((t: 'light' | 'dark') => 'light' | 'dark')) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  session,
  handleLogout,
  theme,
  setTheme,
}) => {
  return (
    <aside className="w-full md:w-64 bg-sidebar border-l border-border flex flex-col justify-between shrink-0">
      <div className="p-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-blue-600/10 rounded-xl border border-blue-500/20 text-blue-600 dark:text-blue-400">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="font-black text-base tracking-wide text-text-main">
              نظام بيدر POS
            </h1>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
              لوحة التحكم السحابية
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full text-right font-medium text-sm ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`
            }
          >
            <Users size={18} />
            <span>تراخيص المشتركين</span>
          </NavLink>

          <NavLink
            to="/create"
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full text-right font-medium text-sm ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`
            }
          >
            <Plus size={18} />
            <span>إنشاء ترخيص جديد</span>
          </NavLink>

          <NavLink
            to="/keys"
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full text-right font-medium text-sm ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`
            }
          >
            <Key size={18} />
            <span>مفاتيح الذكاء الاصطناعي</span>
          </NavLink>

          <NavLink
            to="/logs"
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full text-right font-medium text-sm ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`
            }
          >
            <Activity size={18} />
            <span>سجل العمليات</span>
          </NavLink>
        </nav>
      </div>

      {/* User profile / Logout */}
      <div className="p-6 border-t border-border bg-slate-50 dark:bg-slate-900/10">
        {session?.user && (
          <div className="flex items-center gap-3 mb-4 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 text-xs font-bold border border-blue-500/20 shrink-0">
              {session.user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-muted font-bold truncate">مسؤول النظام</p>
              <p className="text-xs text-text-main font-semibold truncate">
                {session.user.email}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleLogout}
            className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-muted hover:text-text-main font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-border"
          >
            <LogOut size={14} />
            <span>خروج</span>
          </button>

          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-muted hover:text-text-main border border-border transition-colors"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>
    </aside>
  );
};
