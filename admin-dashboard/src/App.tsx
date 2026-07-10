import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Search,
  RefreshCw,
  Smartphone,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Ban,
  Plus,
  Calendar,
  Trash2,
  Zap,
  Database,
  MessageCircle,
  Cloud,
  Activity,
  Copy,
  Users,
  Key,
  Phone,
  LogOut,
  Sun,
  Moon,
  CreditCard,
  Download,
} from 'lucide-react';
import { supabase } from './supabase';
import { useToast, StatCard, TabButton, FilterButton } from './components';
import { LicenseCard, type License } from './LicenseCard';


// ═══════════════════════════════════════════════════════════════════════════════
// DETAILS MODAL
// ═══════════════════════════════════════════════════════════════════════════════
interface UserDetailsData {
  user_id: string;
  email: string;
  store_name: string;
  created_at: string;
  last_sign_in: string;
  backups: { id: string; backup_id: string; store_name: string; size: number; created_at: string }[];
  sessions: { device_name: string; login_time: string; last_seen: string }[];
}

const DetailsModalContent: React.FC<{
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
}> = ({ license, onClose, onCopyText, showToast, onToggleFeature }) => {
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
      // 1. Fetch user authentication info via get_user_by_id RPC
      const { data: userData, error: userErr } = await supabase.rpc(
        'get_user_by_id',
        { user_id: license.user_id }
      );

      // 2. Fetch backups
      const { data: backupsData } = await supabase
        .from('user_backups')
        .select('id, backup_id, store_name, total_size, created_at')
        .eq('user_id', license.user_id)
        .order('created_at', { ascending: false });

      // 3. Fetch active sessions
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMATION MODAL
// ═══════════════════════════════════════════════════════════════════════════════
interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  isDestructive = false,
}) => (
  <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
    <div
      className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-in text-right"
      dir="rtl"
    >
      <h3
        className={`text-lg font-black mb-2 ${
          isDestructive ? 'text-red-500' : 'text-text-main'
        }`}
      >
        {title}
      </h3>
      <p className="text-sm text-text-muted mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-text-muted hover:text-text-main font-semibold text-xs transition-colors"
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 rounded-xl text-white font-bold text-xs transition-colors ${
            isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Authentication Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Layout & Theme State
  const [activeView, setActiveView] = useState<'list' | 'create' | 'logs' | 'keys'>('list');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Database Data
  const [licenses, setLicenses] = useState<License[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Search, Filtering, and Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned' | 'expired'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'expiry_soon' | 'expiry_late'>('newest');

  // Modals & Action confirmations
  const [detailsModal, setDetailsModal] = useState<License | null>(null);
  const [extendModal, setExtendModal] = useState<License | null>(null);
  const [extendMonths, setExtendMonths] = useState(12);

  const [statusConfirm, setStatusConfirm] = useState<{ id: number; status: string; key: string } | null>(null);
  const [resetConfirm, setResetConfirm] = useState<{ id: number; key: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; key: string } | null>(null);

  // Create License state
  const [newLicenseName, setNewLicenseName] = useState('');
  const [newLicensePhone, setNewLicensePhone] = useState('');
  const [newLicenseMonths, setNewLicenseMonths] = useState(12);
  const [newLicenseFeatures, setNewLicenseFeatures] = useState({
    ai_features: true,
    inventory_pro: true,
    whatsapp_integration: false,
    cloud_sync: false,
  });

  // AI keys states
  const [newKey, setNewKey] = useState('');
  const [groqKeys, setGroqKeys] = useState<string[]>([]);
  const [newGroqKey, setNewGroqKey] = useState('');

  const [keyStatuses, setKeyStatuses] = useState<Record<string, 'checking' | 'active' | 'error'>>({});

  const maskKey = (key: string) => {
    if (key.length <= 12) return key;
    return `${key.slice(0, 8)}...${key.slice(-6)}`;
  };

  const checkKeyHealth = async (key: string, provider: 'gemini' | 'groq') => {
    setKeyStatuses((prev) => ({ ...prev, [key]: 'checking' }));
    try {
      let url = '';
      let options: RequestInit = {};

      if (provider === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        options = { method: 'GET' };
      } else {
        url = 'https://api.groq.com/openai/v1/models';
        options = {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${key}`
          }
        };
      }

      const resp = await fetch(url, options);
      if (resp.status === 200) {
        setKeyStatuses((prev) => ({ ...prev, [key]: 'active' }));
        showToast('مفتاح الذكاء الاصطناعي صالح ونشط!', 'success');
      } else {
        setKeyStatuses((prev) => ({ ...prev, [key]: 'error' }));
        showToast('فشل التحقق: المفتاح غير صالح أو منتهي!', 'error');
      }
    } catch (err) {
      setKeyStatuses((prev) => ({ ...prev, [key]: 'error' }));
      showToast('خطأ في الاتصال أثناء التحقق!', 'error');
    }
  };

  const { showToast, ToastComponent } = useToast();

  // 1. Hook up Supabase session changes
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
        // Verify user is in app_admins table
        const { data, error } = await supabase
          .from('app_admins')
          .select('*')
          .eq('user_id', session.user.id);

        if (error || !data || data.length === 0) {
          throw new Error('أنت لا تملك صلاحيات مسؤول النظام في Beidar.');
        }

        setIsAdmin(true);
        fetchLicenses();
      } catch (err: any) {
        setLoginError(err.message || 'الدخول مرفوض: لست مسؤولاً.');
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLicenses([]);
    setLogs([]);
    setApiKeys([]);
  };

  // 2. Database Fetch Operations
  const fetchLicenses = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLicenses(data || []);
    } catch (err: any) {
      showToast('خطأ في تحميل التراخيص: ' + (err.message || ''), 'error');
    } finally {
      setLoadingData(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingData(true);
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
      setLoadingData(false);
    }
  };

  const fetchAIKeys = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'ai_keys')
        .maybeSingle();

      if (error) throw error;
      const val = data?.value;
      if (val && !Array.isArray(val) && typeof val === 'object') {
        setApiKeys(val.gemini_keys || []);
        setGroqKeys(val.groq_keys || []);
      } else {
        setApiKeys(Array.isArray(val) ? val : []);
        setGroqKeys([]);
      }
    } catch (err: any) {
      showToast('خطأ في تحميل مفاتيح الذكاء الاصطناعي: ' + (err.message || ''), 'error');
    } finally {
      setLoadingData(false);
    }
  };

  // View switches
  useEffect(() => {
    if (!isAdmin) return;
    if (activeView === 'list') fetchLicenses();
    if (activeView === 'logs') fetchLogs();
    if (activeView === 'keys') fetchAIKeys();
  }, [activeView, isAdmin]);

  // 3. Database Mutation Operations
  const generateLicenseKey = () => {
    const chars = '0123456789ABCDEF';
    let hex = '';
    for (let i = 0; i < 16; i++) {
      hex += chars[Math.floor(Math.random() * 16)];
    }
    return `BIDAR-${hex}`;
  };

  const createLicense = async () => {
    if (!newLicenseName) {
      showToast('اسم العميل مطلوب.', 'error');
      return;
    }
    setLoadingData(true);
    const key = generateLicenseKey();
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + newLicenseMonths);

    try {
      const { error } = await supabase
        .from('licenses')
        .insert({
          license_key: key,
          customer_name: newLicenseName,
          customer_phone: newLicensePhone,
          expires_at: expiry.toISOString(),
          features: newLicenseFeatures,
          status: 'active',
          is_paid: false,
        });

      if (error) throw error;

      await logAdminAction(
        'CREATE_LICENSE',
        key,
        `تم إنشاء رخصة للعميل ${newLicenseName} صالحة لمدة ${newLicenseMonths} شهر`
      );

      showToast(`تم إنشاء الرخصة بنجاح: ${key}`, 'success');
      navigator.clipboard.writeText(key);

      setNewLicenseName('');
      setNewLicensePhone('');
      setActiveView('list');
      fetchLicenses();
    } catch (err: any) {
      showToast('فشل إنشاء الترخيص: ' + (err.message || ''), 'error');
    } finally {
      setLoadingData(false);
    }
  };

  const togglePaymentStatus = async (id: number, currentStatus: boolean, key: string) => {
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ is_paid: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      await logAdminAction(
        'UPDATE_PAYMENT',
        key,
        `تغيير حالة الدفع إلى: ${!currentStatus ? 'مدفوع' : 'غير مدفوع'}`
      );

      showToast(
        !currentStatus ? 'تم تسجيل تسديد الترخيص بنجاح' : 'تم تعليق دفع الترخيص',
        'success'
      );
      fetchLicenses();
    } catch (err: any) {
      showToast('فشل تعديل حالة الدفع: ' + (err.message || ''), 'error');
    }
  };

  const confirmResetToTrial = async () => {
    if (!resetConfirm) return;
    const { id, key } = resetConfirm;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);

    try {
      const { error } = await supabase
        .from('licenses')
        .update({
          expires_at: expiry.toISOString(),
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      await logAdminAction(
        'RESET_TO_TRIAL',
        key,
        'إعادة ضبط الرخصة لفترة تجريبية (7 أيام)'
      );

      showToast('تمت إعادة ضبط الترخيص لفترة تجريبية 7 أيام', 'success');
      fetchLicenses();
    } catch (err: any) {
      showToast('فشل إعادة ضبط الترخيص: ' + (err.message || ''), 'error');
    } finally {
      setResetConfirm(null);
    }
  };

  const confirmStatusUpdate = async () => {
    if (!statusConfirm) return;
    const { id, status, key } = statusConfirm;

    try {
      const { error } = await supabase
        .from('licenses')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      await logAdminAction(
        'UPDATE_STATUS',
        key,
        `تغيير حالة الترخيص إلى: ${status === 'active' ? 'نشط' : 'محظور'}`
      );

      showToast(status === 'active' ? 'تم تفعيل الترخيص' : 'تم حظر الترخيص بنجاح', 'success');
      fetchLicenses();
    } catch (err: any) {
      showToast('فشل تحديث الحالة: ' + (err.message || ''), 'error');
    } finally {
      setStatusConfirm(null);
    }
  };

  const confirmExtendLicense = async () => {
    if (!extendModal) return;
    const expiry = new Date(extendModal.expires_at);
    expiry.setMonth(expiry.getMonth() + extendMonths);

    try {
      const { error } = await supabase
        .from('licenses')
        .update({
          expires_at: expiry.toISOString(),
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', extendModal.id);

      if (error) throw error;

      await logAdminAction(
        'EXTEND_LICENSE',
        extendModal.license_key,
        `تمديد الصلاحية لـ ${extendMonths} أشهر`
      );

      showToast('تم تمديد صلاحية الترخيص بنجاح', 'success');
      fetchLicenses();
    } catch (err: any) {
      showToast('فشل تمديد الترخيص: ' + (err.message || ''), 'error');
    } finally {
      setExtendModal(null);
    }
  };

  const confirmDeleteLicense = async () => {
    if (!deleteConfirm) return;
    const { id, key } = deleteConfirm;

    try {
      const { error } = await supabase.from('licenses').delete().eq('id', id);
      if (error) throw error;

      await logAdminAction('DELETE_LICENSE', key, 'حذف الترخيص بشكل نهائي');

      showToast('تم حذف الترخيص بنجاح', 'success');
      fetchLicenses();
    } catch (err: any) {
      showToast('فشل الحذف: ' + (err.message || ''), 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const toggleFeature = async (
    license: License,
    featureKey: string,
    featureLabel: string,
    newValue: boolean
  ) => {
    const updatedFeatures = { ...license.features, [featureKey]: newValue };
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ features: updatedFeatures, updated_at: new Date().toISOString() })
        .eq('id', license.id);

      if (error) throw error;

      await logAdminAction(
        'TOGGLE_FEATURE',
        license.license_key,
        `ميزة [${featureLabel}]: ${newValue ? 'تفعيل' : 'تعطيل'}`
      );

      showToast(`تم تعديل ميزة ${featureLabel} بنجاح`, 'success');

      // Update local states
      const updatedLicense = { ...license, features: updatedFeatures };
      setLicenses((prev) => prev.map((l) => (l.id === license.id ? updatedLicense : l)));
      if (detailsModal?.id === license.id) {
        setDetailsModal(updatedLicense);
      }
    } catch (err: any) {
      showToast('فشل تعديل الميزة: ' + (err.message || ''), 'error');
    }
  };

  // AI keys updates
  const saveAIKeys = async (gemini: string[], groq: string[]) => {
    try {
      // check if row exists
      const { data, error: fetchErr } = await supabase
        .from('global_settings')
        .select('*')
        .eq('key', 'ai_keys')
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const newValue = {
        gemini_keys: gemini,
        groq_keys: groq,
      };

      let error;
      if (data) {
        ({ error } = await supabase
          .from('global_settings')
          .update({ value: newValue, updated_at: new Date().toISOString() })
          .eq('key', 'ai_keys'));
      } else {
        ({ error } = await supabase.from('global_settings').insert({
          key: 'ai_keys',
          value: newValue,
        }));
      }

      if (error) throw error;

      await logAdminAction(
        'AI_KEYS_UPDATE',
        'GLOBAL_SETTINGS',
        `تم تعديل مفاتيح الذكاء الاصطناعي (Gemini: ${gemini.length}، Groq: ${groq.length})`
      );
      setApiKeys(gemini);
      setGroqKeys(groq);
      showToast('تم حفظ المفاتيح في السحابة بنجاح', 'success');
    } catch (err: any) {
      showToast('فشل تعديل المفاتيح: ' + (err.message || ''), 'error');
    }
  };

  const addAIKey = () => {
    if (!newKey.trim()) return;
    const updated = [...apiKeys, newKey.trim()];
    setNewKey('');
    saveAIKeys(updated, groqKeys);
  };

  const removeAIKey = (index: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المفتاح؟')) return;
    const updated = apiKeys.filter((_, i) => i !== index);
    saveAIKeys(updated, groqKeys);
  };

  const addGroqKey = () => {
    if (!newGroqKey.trim()) return;
    const updated = [...groqKeys, newGroqKey.trim()];
    setNewGroqKey('');
    saveAIKeys(apiKeys, updated);
  };

  const removeGroqKey = (index: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المفتاح؟')) return;
    const updated = groqKeys.filter((_, i) => i !== index);
    saveAIKeys(apiKeys, updated);
  };

  // 4. Computed stats & filters
  const stats = useMemo(() => {
    const total = licenses.length;
    const active = licenses.filter(
      (l) => l.status === 'active' && new Date(l.expires_at) > new Date()
    ).length;
    const banned = licenses.filter((l) => l.status === 'banned').length;
    const expired = licenses.filter(
      (l) => l.status !== 'banned' && new Date(l.expires_at) < new Date()
    ).length;

    // Premium Analytics
    const paidCount = licenses.filter(l => l.is_paid).length;
    const unpaidCount = total - paidCount;

    const activeAI = licenses.filter(l => l.features?.ai_features).length;
    const activeCloud = licenses.filter(l => l.features?.cloud_sync).length;
    const activeWhatsApp = licenses.filter(l => l.features?.whatsapp_integration).length;

    // Estimate total subscription value (assuming 250,000 IQD per year/paid license)
    const estimatedValue = paidCount * 250000;
    const unpaidValue = unpaidCount * 250000;

    return {
      total,
      active,
      banned,
      expired,
      paidCount,
      unpaidCount,
      activeAI,
      activeCloud,
      activeWhatsApp,
      estimatedValue,
      unpaidValue
    };
  }, [licenses]);

  const filteredLicenses = useMemo(() => {
    const result = licenses.filter((l) => {
      const matchText = [
        l.customer_name,
        l.customer_phone,
        l.store_name,
        l.license_key,
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = matchText.includes(searchTerm.toLowerCase());
      const isExpired = new Date(l.expires_at) < new Date();

      // 1. Status Filter
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = l.status === 'active' && !isExpired;
      else if (statusFilter === 'banned') matchesStatus = l.status === 'banned';
      else if (statusFilter === 'expired') matchesStatus = isExpired && l.status !== 'banned';

      // 2. Payment Filter
      let matchesPayment = true;
      if (paymentFilter === 'paid') matchesPayment = l.is_paid;
      else if (paymentFilter === 'unpaid') matchesPayment = !l.is_paid;

      return matchesSearch && matchesStatus && matchesPayment;
    });

    // 3. Sorting
    return result.sort((a, b) => {
      if (sortOption === 'newest')
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOption === 'oldest')
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortOption === 'expiry_soon')
        return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      if (sortOption === 'expiry_late')
        return new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime();
      return 0;
    });
  }, [licenses, searchTerm, statusFilter, paymentFilter, sortOption]);

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('تم نسخ النص للمحافظة', 'success');
  };

  const toggleFeatureForm = (key: string) => {
    setNewLicenseFeatures((prev) => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }));
  };

  // loading state
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

  // LOGIN SCREEN
  if (!session || !isAdmin) {
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
  }

  // MAIN LAYOUT
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-bg text-text-main" dir="rtl">
      {/* Sidebar */}
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
            <TabButton
              active={activeView === 'list'}
              icon={<Users size={18} />}
              label="تراخيص المشتركين"
              onClick={() => setActiveView('list')}
            />
            <TabButton
              active={activeView === 'create'}
              icon={<Plus size={18} />}
              label="إنشاء ترخيص جديد"
              onClick={() => setActiveView('create')}
            />
            <TabButton
              active={activeView === 'keys'}
              icon={<Key size={18} />}
              label="مفاتيح الذكاء الاصطناعي"
              onClick={() => setActiveView('keys')}
            />
            <TabButton
              active={activeView === 'logs'}
              icon={<Activity size={18} />}
              label="سجل العمليات"
              onClick={() => setActiveView('logs')}
            />
          </nav>
        </div>

        {/* User profile / Logout */}
        <div className="p-6 border-t border-border bg-slate-50 dark:bg-slate-900/10">
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header bar */}
        <header className="h-16 border-b border-border px-6 flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-lg text-text-main">
              {activeView === 'list' && 'إدارة تراخيص Beidar POS'}
              {activeView === 'create' && 'إنشاء ترخيص بيع جديد'}
              {activeView === 'keys' && 'إدارة مفاتيح الذكاء الاصطناعي'}
              {activeView === 'logs' && 'سجلات الأنشطة والتدقيق'}
            </h2>
          </div>
          {loadingData && (
            <div className="flex items-center gap-2 text-xs text-blue-500 font-semibold bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/10">
              <RefreshCw size={12} className="animate-spin" />
              <span>جاري تحميل التحديثات...</span>
            </div>
          )}
        </header>

        {/* View Areas */}
        <div className="p-6 flex-1 space-y-6">
          {/* STATS OVERVIEW - ONLY FOR LICENSES VIEW */}
          {activeView === 'list' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
              <StatCard
                icon={<Shield size={20} className="text-blue-500" />}
                label="إجمالي التراخيص"
                value={stats.total}
                color="bg-blue-600/10"
              />
              <StatCard
                icon={<CheckCircle size={20} className="text-emerald-500" />}
                label="التراخيص النشطة"
                value={stats.active}
                color="bg-emerald-500/10"
              />
              <StatCard
                icon={<Clock size={20} className="text-amber-500" />}
                label="التراخيص المنتهية"
                value={stats.expired}
                color="bg-amber-500/10"
              />
              <StatCard
                icon={<Ban size={20} className="text-red-500" />}
                label="التراخيص المحظورة"
                value={stats.banned}
                color="bg-red-500/10"
              />
            </div>
          )}

          {activeView === 'list' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in text-right">
              {/* Financial & Subscription Analytics */}
              <div className="bg-surface border border-border rounded-3xl p-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
                <h4 className="text-sm font-black text-text-main mb-4 flex items-center gap-2">
                  <CreditCard className="text-emerald-500" size={16} />
                  إحصائيات الاشتراكات والدفع السحابي
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted">التراخيص المدفوعة:</span>
                    <span className="font-mono font-bold text-emerald-500">{stats.paidCount} / {stats.total}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${stats.total > 0 ? (stats.paidCount / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-border">
                      <p className="text-[10px] text-text-muted font-bold mb-1">الإيرادات المقدرة (IQD)</p>
                      <p className="text-sm font-black text-emerald-500 tabular-nums">
                        {stats.estimatedValue.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-border">
                      <p className="text-[10px] text-text-muted font-bold mb-1">المستحقات المعلقة (IQD)</p>
                      <p className="text-sm font-black text-amber-500 tabular-nums">
                        {stats.unpaidValue.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Core Features Adoption */}
              <div className="bg-surface border border-border rounded-3xl p-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl" />
                <h4 className="text-sm font-black text-text-main mb-4 flex items-center gap-2">
                  <Zap className="text-blue-500" size={16} />
                  معدل اعتماد وتفعيل الميزات الإضافية
                </h4>
                <div className="space-y-3.5">
                  {/* AI Features Adoption */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-text-muted font-semibold">ميزات الذكاء الاصطناعي (AI Features):</span>
                      <span className="font-mono font-bold text-blue-500">
                        {stats.total > 0 ? Math.round((stats.activeAI / stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? (stats.activeAI / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  {/* Cloud Sync Adoption */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-text-muted font-semibold">النسخ السحابي (Cloud Sync / LAN):</span>
                      <span className="font-mono font-bold text-violet-500">
                        {stats.total > 0 ? Math.round((stats.activeCloud / stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-violet-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? (stats.activeCloud / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  {/* WhatsApp Integration Adoption */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-text-muted font-semibold">إشعارات الواتساب (WhatsApp Notification):</span>
                      <span className="font-mono font-bold text-teal-500">
                        {stats.total > 0 ? Math.round((stats.activeWhatsApp / stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-teal-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? (stats.activeWhatsApp / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LICENSES VIEW */}
          {activeView === 'list' && (
            <div className="space-y-4 animate-fade-in">
              {/* Filter and Search Bar */}
              <div className="flex flex-col lg:flex-row gap-3 bg-surface p-4 rounded-2xl border border-border shadow-sm">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute right-3.5 top-3.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="ابحث باسم المشترك، الهاتف، الكود، أو المحل..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-xl pr-10 pl-4 py-2.5 text-xs text-text-main outline-none focus:border-blue-500/50 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <FilterButton
                    active={statusFilter === 'all'}
                    label="كل الحالات"
                    count={stats.total}
                    onClick={() => setStatusFilter('all')}
                  />
                  <FilterButton
                    active={statusFilter === 'active'}
                    label="نشط"
                    count={stats.active}
                    onClick={() => setStatusFilter('active')}
                  />
                  <FilterButton
                    active={statusFilter === 'expired'}
                    label="منتهي"
                    count={stats.expired}
                    onClick={() => setStatusFilter('expired')}
                  />
                  <FilterButton
                    active={statusFilter === 'banned'}
                    label="محظور"
                    count={stats.banned}
                    onClick={() => setStatusFilter('banned')}
                  />

                  <div className="h-6 w-px bg-border mx-1" />

                  {/* Payment Filters */}
                  <select
                    value={paymentFilter}
                    onChange={(e: any) => setPaymentFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs font-semibold text-text-main focus:outline-none"
                  >
                    <option value="all">كل الاشتراكات</option>
                    <option value="paid">مدفوع</option>
                    <option value="unpaid">غير مدفوع</option>
                  </select>

                  {/* Sorting */}
                  <select
                    value={sortOption}
                    onChange={(e: any) => setSortOption(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs font-semibold text-text-main focus:outline-none"
                  >
                    <option value="newest">الأحدث إنشائاً</option>
                    <option value="oldest">الأقدم إنشائاً</option>
                    <option value="expiry_soon">الأقرب انتهاءً</option>
                    <option value="expiry_late">الأبعد انتهاءً</option>
                  </select>
                </div>
              </div>

              {/* Grid List */}
              {filteredLicenses.length === 0 ? (
                <div className="bg-surface rounded-2xl border border-border p-12 text-center shadow-sm">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <Search size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-text-main mb-1">
                    لم نجد أي تراخيص مطابقة
                  </h3>
                  <p className="text-text-muted text-sm max-w-sm mx-auto">
                    تأكد من كتابة مصطلح البحث بشكل صحيح أو تغيير خيارات التصفية النشطة.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredLicenses.map((license) => (
                    <LicenseCard
                      key={license.id}
                      license={license}
                      onCopyKey={copyText}
                      onExtend={setExtendModal}
                      onResetToTrial={(id, key) => setResetConfirm({ id, key })}
                      onTogglePayment={togglePaymentStatus}
                      onUpdateStatus={(id, status, key) => setStatusConfirm({ id, status, key })}
                      onDelete={(id, key) => setDeleteConfirm({ id, key })}
                      onViewDetails={setDetailsModal}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CREATE LICENSE VIEW */}
          {activeView === 'create' && (
            <div className="max-w-xl mx-auto bg-surface border border-border p-8 rounded-3xl shadow-lg animate-fade-in text-right">
              <h3 className="text-xl font-black mb-6 text-text-main">تفاصيل ترخيص البيع</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-2">
                    اسم العميل المشترك (المرخص له)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: شركة النخبة التجارية"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-xl px-4 py-3 text-sm text-text-main outline-none focus:border-blue-500/50 transition-all text-right"
                    value={newLicenseName}
                    onChange={(e) => setNewLicenseName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted mb-2">
                    رقم الهاتف أو وسيلة الاتصال
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: 9647701234567"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-xl px-4 py-3 text-sm text-text-main outline-none focus:border-blue-500/50 transition-all text-left font-mono"
                    value={newLicensePhone}
                    onChange={(e) => setNewLicensePhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted mb-2">
                    مدة الصلاحية للاشتراك
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 3, 6, 12].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setNewLicenseMonths(m)}
                        className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                          newLicenseMonths === m
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                            : 'bg-slate-50 dark:bg-slate-900 border-border text-text-muted hover:border-slate-400'
                        }`}
                      >
                        {m === 12 ? 'سنة واحدة' : `${m} أشهر`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Features selectors */}
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-3">
                    تخصيص باقات الميزات
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'ai_features', label: 'الذكاء الاصطناعي', icon: Zap },
                      { key: 'inventory_pro', label: 'إدارة المخزون الاحترافية', icon: Database },
                      { key: 'whatsapp_integration', label: 'ربط إشعارات واتساب', icon: MessageCircle },
                      { key: 'cloud_sync', label: 'المزامنة السحابية (LAN)', icon: Cloud },
                    ].map((f) => {
                      const enabled = newLicenseFeatures[f.key as keyof typeof newLicenseFeatures];
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => toggleFeatureForm(f.key)}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                            enabled
                              ? 'bg-blue-500/5 border-blue-500/30 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-50 dark:bg-slate-900 border-border text-text-muted hover:border-slate-400'
                          }`}
                        >
                          <span className="text-xs font-bold">{f.label}</span>
                          <f.icon size={16} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={createLicense}
                  className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-500/20 text-sm flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  <span>توليد وإصدار مفتاح الترخيص</span>
                </button>
              </div>
            </div>
          )}

          {/* AI SETTINGS VIEW */}
          {activeView === 'keys' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto animate-fade-in text-right">
              {/* Gemini Panel */}
              <div className="bg-surface border border-border p-8 rounded-3xl shadow-lg">
                <h3 className="text-xl font-black mb-2 text-text-main">مفاتيح Google Gemini API</h3>
                <p className="text-xs text-text-muted mb-6">
                  يتم توزيع وإدارة هذه المفاتيح لتشغيل نموذج gemma-4 لجميع المشتركين الفاعلين.
                </p>

                <div className="space-y-6">
                  {/* Input form */}
                  <div className="flex gap-2">
                    <button
                      onClick={addAIKey}
                      className="px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md text-xs whitespace-nowrap"
                    >
                      إضافة مفتاح
                    </button>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      className="flex-1 bg-slate-50 dark:bg-slate-900 border border-border rounded-xl px-4 py-3 text-xs text-text-main outline-none focus:border-blue-500/50 transition-all font-mono text-left"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                    />
                  </div>

                  {/* Key list */}
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-3">
                      المفاتيح النشطة في السحابة ({apiKeys.length})
                    </label>
                    {apiKeys.length === 0 ? (
                      <div className="bg-slate-50 dark:bg-slate-900/30 border border-dashed border-border rounded-2xl p-6 text-center text-text-muted text-xs">
                        لا توجد مفاتيح محفوظة حالياً.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {apiKeys.map((k, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 border border-border rounded-xl p-3"
                          >
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => removeAIKey(index)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                                title="حذف المفتاح"
                              >
                                <Trash2 size={14} />
                              </button>
                              <button
                                onClick={() => checkKeyHealth(k, 'gemini')}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600/20 transition-all flex items-center gap-1 shrink-0"
                                disabled={keyStatuses[k] === 'checking'}
                              >
                                {keyStatuses[k] === 'checking' ? (
                                  <RefreshCw size={10} className="animate-spin" />
                                ) : null}
                                <span>فحص</span>
                              </button>
                              {keyStatuses[k] === 'active' && (
                                <span className="text-[10px] font-bold text-emerald-500 px-2 py-0.5 bg-emerald-500/10 rounded-full shrink-0">نشط</span>
                              )}
                              {keyStatuses[k] === 'error' && (
                                <span className="text-[10px] font-bold text-red-500 px-2 py-0.5 bg-red-500/10 rounded-full shrink-0">معطل</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 min-w-0 flex-1 justify-end">
                              <span className="font-mono text-xs text-text-main truncate max-w-[150px]" title={k}>
                                {maskKey(k)}
                              </span>
                              <button
                                onClick={() => copyText(k)}
                                className="text-slate-400 hover:text-text-main p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
                                title="نسخ"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Groq Panel */}
              <div className="bg-surface border border-border p-8 rounded-3xl shadow-lg">
                <h3 className="text-xl font-black mb-2 text-text-main">مفاتيح Groq / Grok API</h3>
                <p className="text-xs text-text-muted mb-6">
                  إدارة مفاتيح Groq السحابية لتشغيل الموديلات البديلة مثل Llama و Allam.
                </p>

                <div className="space-y-6">
                  {/* Input form */}
                  <div className="flex gap-2">
                    <button
                      onClick={addGroqKey}
                      className="px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold transition-all shadow-md text-xs whitespace-nowrap"
                    >
                      إضافة مفتاح
                    </button>
                    <input
                      type="password"
                      placeholder="gsk_..."
                      className="flex-1 bg-slate-50 dark:bg-slate-900 border border-border rounded-xl px-4 py-3 text-xs text-text-main outline-none focus:border-violet-500/50 transition-all font-mono text-left"
                      value={newGroqKey}
                      onChange={(e) => setNewGroqKey(e.target.value)}
                    />
                  </div>

                  {/* Key list */}
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-3">
                      المفاتيح النشطة في السحابة ({groqKeys.length})
                    </label>
                    {groqKeys.length === 0 ? (
                      <div className="bg-slate-50 dark:bg-slate-900/30 border border-dashed border-border rounded-2xl p-6 text-center text-text-muted text-xs">
                        لا توجد مفاتيح محفوظة حالياً.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {groqKeys.map((k, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 border border-border rounded-xl p-3"
                          >
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => removeGroqKey(index)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                                title="حذف المفتاح"
                              >
                                <Trash2 size={14} />
                              </button>
                              <button
                                onClick={() => checkKeyHealth(k, 'groq')}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-violet-600/10 text-violet-600 dark:text-violet-400 hover:bg-violet-600/20 transition-all flex items-center gap-1 shrink-0"
                                disabled={keyStatuses[k] === 'checking'}
                              >
                                {keyStatuses[k] === 'checking' ? (
                                  <RefreshCw size={10} className="animate-spin" />
                                ) : null}
                                <span>فحص</span>
                              </button>
                              {keyStatuses[k] === 'active' && (
                                <span className="text-[10px] font-bold text-emerald-500 px-2 py-0.5 bg-emerald-500/10 rounded-full shrink-0">نشط</span>
                              )}
                              {keyStatuses[k] === 'error' && (
                                <span className="text-[10px] font-bold text-red-500 px-2 py-0.5 bg-red-500/10 rounded-full shrink-0">معطل</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 min-w-0 flex-1 justify-end">
                              <span className="font-mono text-xs text-text-main truncate max-w-[150px]" title={k}>
                                {maskKey(k)}
                              </span>
                              <button
                                onClick={() => copyText(k)}
                                className="text-slate-400 hover:text-text-main p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
                                title="نسخ"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AUDIT LOGS VIEW */}
          {activeView === 'logs' && (
            <div className="bg-surface border border-border rounded-3xl shadow-sm overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-border flex justify-between items-center gap-3">
                <p className="text-xs text-text-muted font-bold">
                  آخر 100 عملية تم إجراؤها من قبل المسؤولين
                </p>
                <button
                  onClick={fetchLogs}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border text-text-muted hover:text-text-main transition-colors shadow-sm"
                  title="تحديث السجلات"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {logs.length === 0 ? (
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
          )}
        </div>
      </main>

      {/* Toast component rendering */}
      {ToastComponent}

      {/* License Details Modal */}
      {detailsModal && (
        <DetailsModalContent
          license={detailsModal}
          onClose={() => setDetailsModal(null)}
          onCopyText={copyText}
          showToast={showToast}
          onToggleFeature={toggleFeature}
        />
      )}

      {/* Renew Modal */}
      {extendModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="bg-surface border border-border rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-scale-in text-right"
            dir="rtl"
          >
            <h3 className="text-lg font-black mb-2 text-text-main flex items-center gap-2">
              <Calendar size={18} className="text-blue-500" />
              تجديد صلاحية الاشتراك
            </h3>
            <p className="text-xs text-text-muted mb-4">
              تمديد ترخيص العميل: <span className="font-bold text-text-main">{extendModal.customer_name}</span>
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-2">
                  فترة التمديد الإضافية
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 6, 12].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setExtendMonths(m)}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        extendMonths === m
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                          : 'bg-slate-50 dark:bg-slate-900 border-border text-text-muted hover:border-slate-400'
                      }`}
                    >
                      {m === 12 ? 'سنة كاملة' : `${m} أشهر`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setExtendModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-text-muted hover:text-text-main font-semibold text-xs transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={confirmExtendLicense}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-md shadow-blue-500/25"
              >
                تأكيد التجديد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation */}
      {resetConfirm && (
        <ConfirmModal
          title="إعادة ضبط الترخيص"
          message={`هل أنت متأكد من إعادة ضبط الترخيص ${resetConfirm.key} إلى فترة تجريبية (7 أيام)؟ سيتم إلغاء مدة الصلاحية الحالية.`}
          confirmText="تأكيد إعادة الضبط"
          cancelText="تراجع"
          onConfirm={confirmResetToTrial}
          onCancel={() => setResetConfirm(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmModal
          title="حذف الترخيص نهائياً"
          message={`تحذير: هل أنت متأكد من حذف الترخيص ${deleteConfirm.key} بشكل نهائي؟ هذا الإجراء لا يمكن التراجع عنه وسيعطل كاشير المستخدم فوراً.`}
          confirmText="حذف نهائي"
          cancelText="تراجع"
          isDestructive
          onConfirm={confirmDeleteLicense}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Ban / Active Confirmation */}
      {statusConfirm && (
        <ConfirmModal
          title={statusConfirm.status === 'active' ? 'تفعيل الترخيص' : 'حظر الترخيص'}
          message={`هل تريد بالتأكيد ${
            statusConfirm.status === 'active' ? 'تفعيل' : 'حظر'
          } الترخيص رقم ${statusConfirm.key}؟`}
          confirmText="تأكيد الإجراء"
          cancelText="تراجع"
          isDestructive={statusConfirm.status === 'banned'}
          onConfirm={confirmStatusUpdate}
          onCancel={() => setStatusConfirm(null)}
        />
      )}
    </div>
  );
}
