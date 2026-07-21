import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';

interface AuditLog {
  id: string;
  admin_username: string;
  action: string;
  target_license: string;
  details: string;
  created_at: string;
}

interface AuditLogsProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  setLoadingGlobal: (loading: boolean) => void;
}

export const AuditLogs: React.FC<AuditLogsProps> = ({ showToast, setLoadingGlobal }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    setLoadingGlobal(true);
    try {
      const { data, error } = await supabase
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      showToast('خطأ في تحميل السجلات: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
      setLoadingGlobal(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="bg-surface border border-border rounded-3xl shadow-sm overflow-hidden animate-fade-in text-right" dir="rtl">
      <div className="p-4 border-b border-border flex justify-between items-center gap-3">
        <p className="text-xs text-text-muted font-bold">
          آخر 100 عملية تم إجراؤها من قبل المسؤولين
        </p>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border text-text-muted hover:text-text-main transition-colors shadow-sm disabled:opacity-50"
          title="تحديث السجلات"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {logs.length === 0 && !loading ? (
        <div className="p-12 text-center text-text-muted text-xs">
          لا توجد سجلات تدقيق حالياً.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-border">
                <th className="p-4 text-xs font-bold text-text-muted">المسؤول</th>
                <th className="p-4 text-xs font-bold text-text-muted">العملية</th>
                <th className="p-4 text-xs font-bold text-text-muted">الترخيص المستهدف</th>
                <th className="p-4 text-xs font-bold text-text-muted">التفاصيل</th>
                <th className="p-4 text-xs font-bold text-text-muted">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                >
                  <td className="p-4 text-xs font-semibold text-text-main">
                    {log.admin_username}
                  </td>
                  <td className="p-4 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action.includes('CREATE')
                          ? 'bg-blue-500/10 text-blue-500'
                          : log.action.includes('DELETE')
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-slate-500/10 text-slate-500'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {log.target_license}
                  </td>
                  <td className="p-4 text-xs text-text-muted">{log.details}</td>
                  <td className="p-4 text-xs font-mono text-text-muted">
                    {new Date(log.created_at).toLocaleString('ar-IQ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
