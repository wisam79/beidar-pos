import React, { useState, useEffect } from 'react';
import {
  XCircle,
  Key,
  Copy,
  Calendar,
  Users,
  Phone,
  Clock,
  Zap,
  Database,
  MessageCircle,
  Cloud,
  Shield,
  RefreshCw,
  Download,
  Smartphone,
} from 'lucide-react';
import { supabase } from '../../supabase';
import type { License } from '../../LicenseCard';

interface UserDetailsData {
  user_id: string;
  email: string;
  store_name: string;
  created_at: string;
  last_sign_in: string;
  backups: { id: string; backup_id: string; store_name: string; size: number; created_at: string }[];
  sessions: { device_name: string; login_time: string; last_seen: string }[];
}

interface DetailsModalProps {
  license: License;
  onClose: () => void;
  onCopyText: (text: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onToggleFeature: (
    license: License,
    featureKey: string,
    featureLabel: string,
    newValue: boolean
  ) => void;
}

export const DetailsModal: React.FC<DetailsModalProps> = ({
  license,
  onClose,
  onCopyText,
  showToast,
  onToggleFeature,
}) => {
  const [userDetails, setUserDetails] = useState<UserDetailsData | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'backups' | 'sessions'>('info');

  useEffect(() => {
    if (license.user_id) {
      fetchUserDetails();
    }
  }, [license.user_id]);

  const fetchUserDetails = async () => {
    if (!license.user_id) return;
    setLoadingUser(true);
    try {
      const { data: userData, error: userErr } = await supabase.rpc(
        'get_user_by_id',
        { user_id: license.user_id }
      );

      const { data: backupsData } = await supabase
        .from('user_backups')
        .select('id, backup_id, store_name, total_size, created_at')
        .eq('user_id', license.user_id)
        .order('created_at', { ascending: false });

      const { data: sessionsData } = await supabase
        .from('active_sessions')
        .select('device_name, created_at, last_seen')
        .eq('user_id', license.user_id);

      if (userErr) throw userErr;

      const email = userData?.email || '';
      const storeName = userData?.raw_user_meta_data?.store_name || license.store_name || '';
      const createdAt = userData?.created_at || '';
      const lastSignIn = userData?.last_sign_in_at || '';

      setUserDetails({
        user_id: license.user_id,
        email,
        store_name: storeName,
        created_at: createdAt,
        last_sign_in: lastSignIn,
        backups: (backupsData || []).map((b: any) => ({
          id: b.id,
          backup_id: b.backup_id,
          store_name: b.store_name,
          size: b.total_size,
          created_at: b.created_at,
        })),
        sessions: (sessionsData || []).map((s: any) => ({
          device_name: s.device_name || 'جهاز غير معروف',
          login_time: s.created_at,
          last_seen: s.last_seen,
        })),
      });
    } catch (e: any) {
      console.error('Failed to fetch user details:', e);
      showToast('فشل تحميل تفاصيل المستخدم: ' + (e.message || ''), 'error');
    } finally {
      setLoadingUser(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const downloadBackup = async (backupId: string) => {
    setDownloadingId(backupId);
    try {
      const { data, error } = await supabase.storage
        .from('backups')
        .download(backupId);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', backupId.split('/').pop() || 'backup.sql');
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('تم تنزيل النسخة الاحتياطية بنجاح', 'success');
    } catch (err: any) {
      console.error('Failed to download backup:', err);
      showToast('فشل تنزيل النسخة الاحتياطية: ' + (err.message || ''), 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-900/20 to-slate-900/20 border-b border-border p-6">
          <div className="absolute top-4 left-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-200 transition-colors"
            >
              <XCircle size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3 text-blue-500 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Key size={20} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">
              تفاصيل الترخيص
            </span>
          </div>

          <div
            className="group flex items-center gap-3 cursor-pointer select-text"
            onClick={() => onCopyText(license.license_key)}
          >
            <h2 className="text-xl md:text-2xl font-mono font-bold text-text-main tracking-wide break-all">
              {license.license_key}
            </h2>
            <Copy
              size={16}
              className="text-slate-400 group-hover:text-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-4 mt-4 text-xs">
            <div
              className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 border ${
                license.status === 'active'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                  : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  license.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              {license.status === 'active' ? 'نشط' : 'محظور'}
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-text-muted">
              <Calendar size={12} />
              <span>
                ينتهي في:{' '}
                <span className="font-mono font-semibold">
                  {new Date(license.expires_at).toLocaleDateString('ar-IQ')}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-right">
          {/* Customer Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-border rounded-2xl p-4 flex items-start gap-4">
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500">
                <Users size={18} />
              </div>
              <div>
                <p className="text-xs text-text-muted font-bold mb-1">العميل</p>
                <p className="text-text-main font-bold">
                  {license.customer_name || 'غير معروف'}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {license.store_name || '-'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 border border-border rounded-2xl p-4 flex items-start gap-4">
              <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-500">
                <Phone size={18} />
              </div>
              <div>
                <p className="text-xs text-text-muted font-bold mb-1">
                  رقم الهاتف
                </p>
                <p className="text-text-main font-mono font-bold">
                  {license.customer_phone || '-'}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-text-muted mt-0.5">
                  <Clock size={10} />
                  <span>
                    تاريخ الإنشاء:{' '}
                    {new Date(license.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Features Toggles */}
          <div>
            <h4 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2">
              <Zap size={16} className="text-amber-500" />
              ميزات الترخيص المفعلة
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  key: 'ai_features',
                  icon: Zap,
                  label: 'الذكاء الاصطناعي',
                  color: 'text-amber-500 bg-amber-500/10',
                },
                {
                  key: 'inventory_pro',
                  icon: Database,
                  label: 'إدارة المخزون',
                  color: 'text-blue-500 bg-blue-500/10',
                },
                {
                  key: 'whatsapp_integration',
                  icon: MessageCircle,
                  label: 'ربط واتساب',
                  color: 'text-emerald-500 bg-emerald-500/10',
                },
                {
                  key: 'cloud_sync',
                  icon: Cloud,
                  label: 'النسخ السحابي (LAN)',
                  color: 'text-cyan-500 bg-cyan-500/10',
                },
              ].map((f) => {
                const enabled = !!license.features?.[f.key];
                return (
                  <button
                    key={f.key}
                    onClick={() =>
                      onToggleFeature(license, f.key, f.label, !enabled)
                    }
                    className={`group relative overflow-hidden rounded-xl border p-3 flex items-center justify-between transition-all duration-200 ${
                      enabled
                        ? 'bg-slate-50 dark:bg-slate-900 border-blue-500/30'
                        : 'bg-slate-50/20 dark:bg-slate-900/10 border-border hover:border-slate-400/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg transition-colors duration-200 ${
                          enabled ? f.color : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        <f.icon size={16} />
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-xs font-bold transition-colors ${
                            enabled ? 'text-text-main' : 'text-text-muted'
                          }`}
                        >
                          {f.label}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {enabled ? 'نشط' : 'معطل'}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-8 h-4 rounded-full relative transition-colors duration-200 ${
                        enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-200 ${
                          enabled ? 'left-0.5' : 'left-4'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User binding / info */}
          <div className="border-t border-border pt-6">
            {!license.user_id ? (
              <div className="bg-slate-50 dark:bg-slate-900/30 border border-dashed border-border rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Users size={24} />
                </div>
                <p className="text-text-muted text-sm font-bold">
                  لم يتم ربط أي مستخدم حتى الآن
                </p>
                <p className="text-text-muted/70 text-xs mt-1">
                  سيظهر البريد الإلكتروني والنسخ الاحتياطية هنا فور تفعيل الترخيص من التطبيق
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-text-main flex items-center gap-2">
                    <Shield size={16} className="text-indigo-500" />
                    تفاصيل حساب العميل
                  </h4>

                  {/* Tabs */}
                  <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-border">
                    {(['info', 'backups', 'sessions'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          activeTab === tab
                            ? 'bg-surface text-blue-600 shadow-sm border border-border'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        {tab === 'info'
                          ? 'المعلومات'
                          : tab === 'backups'
                            ? 'النسخ'
                            : 'الجلسات'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 border border-border rounded-2xl p-5 relative overflow-hidden">
                  {loadingUser ? (
                    <div className="py-12 flex flex-col items-center justify-center text-blue-500/50">
                      <RefreshCw size={24} className="animate-spin mb-2" />
                      <span className="text-xs">جاري جلب البيانات من السحابة...</span>
                    </div>
                  ) : !userDetails ? (
                    <div className="text-center py-8 text-text-muted text-sm">
                      تعذر تحميل البيانات
                    </div>
                  ) : (
                    <>
                      {activeTab === 'info' && (
                        <div className="space-y-4 animate-fade-in text-right">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold text-lg border border-blue-500/20">
                              {userDetails.email?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-text-main font-bold truncate">
                                  {userDetails.email}
                                </p>
                                <button
                                  onClick={() => onCopyText(userDetails.email)}
                                  className="text-slate-400 hover:text-text-main transition-colors"
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <code className="text-[11px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono truncate max-w-[200px]">
                                  {license.user_id}
                                </code>
                                <button
                                  onClick={() => onCopyText(license.user_id || '')}
                                  className="text-slate-400 hover:text-text-main transition-colors"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-4">
                            <div className="bg-surface rounded-xl p-3 border border-border">
                              <p className="text-[10px] text-text-muted mb-1">
                                آخر دخول للمستخدم
                              </p>
                              <p className="text-xs text-text-main font-mono">
                                {userDetails.last_sign_in
                                  ? new Date(userDetails.last_sign_in).toLocaleString('ar-IQ')
                                  : '-'}
                              </p>
                            </div>
                            <div className="bg-surface rounded-xl p-3 border border-border">
                              <p className="text-[10px] text-text-muted mb-1">
                                تاريخ التسجيل بالسحابة
                              </p>
                              <p className="text-xs text-text-main font-mono">
                                {userDetails.created_at
                                  ? new Date(userDetails.created_at).toLocaleDateString('ar-IQ')
                                  : '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'backups' && (
                        <div className="space-y-2 animate-fade-in max-h-[200px] overflow-y-auto custom-scrollbar">
                          {userDetails.backups?.length === 0 ? (
                            <div className="text-center py-8 text-text-muted text-xs">
                              لا توجد نسخ احتياطية مرفوعة
                            </div>
                          ) : (
                            userDetails.backups?.map((b, i) => (
                              <div
                                key={i}
                                className="flex justify-between items-center text-xs p-3 bg-surface border border-border rounded-xl hover:border-blue-500/30 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <Database size={12} className="text-blue-500" />
                                  <span className="text-text-main font-bold">
                                    {b.store_name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-text-muted">
                                    {formatSize(b.size)}
                                  </span>
                                  <span className="text-text-muted font-mono">
                                    {new Date(b.created_at).toLocaleDateString('ar-IQ')}
                                  </span>
                                  <button
                                    onClick={() => downloadBackup(b.backup_id)}
                                    disabled={downloadingId !== null}
                                    className="p-1 rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center disabled:opacity-50"
                                    title="تنزيل ملف النسخة الاحتياطية"
                                  >
                                    {downloadingId === b.backup_id ? (
                                      <RefreshCw size={12} className="animate-spin text-blue-500" />
                                    ) : (
                                      <Download size={12} />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {activeTab === 'sessions' && (
                        <div className="space-y-2 animate-fade-in max-h-[200px] overflow-y-auto custom-scrollbar">
                          {userDetails.sessions?.length === 0 ? (
                            <div className="text-center py-8 text-text-muted text-xs">
                              لا توجد جلسات نشطة
                            </div>
                          ) : (
                            userDetails.sessions?.map((s, i) => (
                              <div
                                key={i}
                                className="flex justify-between items-center text-xs p-3 bg-surface border border-border rounded-xl"
                              >
                                <div className="flex items-center gap-2">
                                  <Smartphone size={12} className="text-blue-500" />
                                  <span className="text-text-main font-bold">
                                    {s.device_name}
                                  </span>
                                </div>
                                <span className="text-text-muted font-mono">
                                  آخر ظهور:{' '}
                                  {s.last_seen
                                    ? new Date(s.last_seen).toLocaleString('ar-IQ')
                                    : '-'}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
