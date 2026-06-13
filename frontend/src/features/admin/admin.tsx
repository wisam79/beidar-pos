
import React, { useState, useEffect, useMemo } from 'react';
import {
    Shield, Search, RefreshCw, Smartphone, Clock, AlertTriangle,
    CheckCircle, XCircle, Ban, Plus, Calendar, Trash2,
    Zap, Database, MessageCircle, Cloud, Activity, Copy, Upload,
    Users, Key, Filter, Download, Eye, Phone, Hash, RotateCcw, CreditCard, ArrowUpDown
} from 'lucide-react';
import { api, AdminLicense, AdminLogEntry } from '../../core/api';
import { AppPreferences } from '../../core/types';
import { ConfirmModal } from '../../components/ConfirmModal';
import * as CloudHandler from '../../../wailsjs/go/handlers/CloudHandler';

// Import extracted components from dashboard module
import { useToast, StatCard, TabButton, FilterButton, LicenseCard } from './components';

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ DEVELOPER DASHBOARD - Admin Control Panel
// Components (useToast, StatCard, TabButton, FilterButton, LicenseCard) are 
// now imported from ./dev-dashboard module
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// Details Modal with User Info
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
    license: AdminLicense;
    onClose: () => void;
    onCopyKey: (key: string) => void;
    fetchLicenses: () => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
    onToggleFeature: (id: number, key: string, featureKey: string, featureLabel: string, newValue: boolean, features: Record<string, boolean>) => void;
}> = ({ license, onClose, onCopyKey, fetchLicenses, showToast, onToggleFeature }) => {
    const [userDetails, setUserDetails] = useState<UserDetailsData | null>(null);
    const [loadingUser, setLoadingUser] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'backups' | 'sessions'>('info');

    useEffect(() => {
        if (license.device_id) {
            fetchUserDetails();
        }
    }, [license.device_id]);

    const fetchUserDetails = async () => {
        if (!license.device_id) return;
        setLoadingUser(true);
        try {
            const details = await CloudHandler.GetLicenseUserDetails(license.device_id) as UserDetailsData;
            setUserDetails(details);
        } catch (e) {
            console.error('Failed to fetch user details:', e);
        } finally {
            setLoadingUser(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-bg border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 fade-in duration-300" onClick={e => e.stopPropagation()}>

                {/* Header / Hero */}
                <div className="relative bg-gradient-to-r from-emerald-900/20 to-black border-b border-border p-6">
                    <div className="absolute top-4 right-4">
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
                            <XCircle size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 text-primary mb-2">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Key size={20} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-500/80">License Details</span>
                    </div>

                    <div className="group flex items-center gap-3 cursor-pointer" onClick={() => onCopyKey(license.license_key)}>
                        <h2 className="text-2xl font-mono font-bold text-text-main tracking-wide break-all selection:bg-primary/30">
                            {license.license_key}
                        </h2>
                        <Copy size={16} className="text-text-muted group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
                    </div>

                    <div className="flex items-center gap-4 mt-4">
                        <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${license.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${license.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                            {license.status.toUpperCase()}
                        </div>
                        <div className="h-4 w-px bg-white/10" />
                        <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <Calendar size={12} />
                            <span>ينتهي في: <span className="text-white font-mono">{new Date(license.expires_at).toLocaleDateString('ar-IQ')}</span></span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                    {/* Customer Info Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-surface border border-border rounded-2xl p-4 flex items-start gap-4">
                            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                                <Users size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-text-muted font-bold mb-1">العميل</p>
                                <p className="text-text-main font-bold">{license.customer_name || 'غير معروف'}</p>
                                <p className="text-xs text-text-muted mt-0.5">{license.store_name}</p>
                            </div>
                        </div>

                        <div className="bg-surface border border-border rounded-2xl p-4 flex items-start gap-4">
                            <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400">
                                <Phone size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-text-muted font-bold mb-1">منصة التواصل</p>
                                <p className="text-white font-mono">{license.customer_phone || '-'}</p>
                                <div className="flex items-center gap-1 text-xs text-white/50 mt-0.5">
                                    <Clock size={10} />
                                    <span>تم الإنشاء: {new Date(license.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Features Section */}
                    <div>
                        <h4 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2">
                            <Zap size={16} className="text-amber-500" />
                            ميزات الترخيص
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { key: 'ai_features', icon: Zap, label: 'الذكاء الاصطناعي', color: 'amber' },
                                { key: 'inventory_pro', icon: Database, label: 'إدارة المخزون', color: 'blue' },
                                { key: 'whatsapp_integration', icon: MessageCircle, label: 'واتساب', color: 'emerald' },
                                { key: 'cloud_sync', icon: Cloud, label: 'السحابة (LAN)', color: 'cyan' },
                            ].map(f => {
                                const enabled = license.features?.[f.key as keyof typeof license.features];
                                return (
                                    <button
                                        key={f.key}
                                        onClick={() => onToggleFeature(license.id, license.license_key, f.key, f.label, !enabled, license.features)}
                                        className={`group relative overflow-hidden rounded-xl border p-3 flex items-center justify-between transition-all duration-300 ${enabled
                                            ? `bg-${f.color}-500/5 border-${f.color}-500/30`
                                            : 'bg-white/5 border-border hover:border-border'}`}
                                    >
                                        <div className="flex items-center gap-3 z-10">
                                            <div className={`p-2 rounded-lg transition-colors duration-300 ${enabled ? `bg-${f.color}-500/20 text-${f.color}-500` : 'bg-surface-active text-text-muted'}`}>
                                                <f.icon size={16} />
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-xs font-bold transition-colors ${enabled ? 'text-text-main' : 'text-text-muted'}`}>{f.label}</p>
                                                <p className="text-[10px] text-text-muted/70">{enabled ? 'Active' : 'Disabled'}</p>
                                            </div>
                                        </div>

                                        <div className={`w-8 h-4 rounded-full relative transition-colors duration-300 ${enabled ? `bg-${f.color}-500` : 'bg-surface-active'}`}>
                                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300 ${enabled ? 'left-4' : 'left-0.5'}`} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* User Binding Section */}
                    <div className="border-t border-border pt-6">
                        {!license.device_id ? (
                            <div className="bg-white/5 border border-dashed border-border rounded-2xl p-8 text-center">
                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-white/20">
                                    <Users size={24} />
                                </div>
                                <p className="text-text-muted text-sm font-bold">لم يتم ربط أي مستخدم</p>
                                <p className="text-text-muted/70 text-xs mt-1">سيظهر حساب المستخدم والنسخ الاحتياطية هنا عند التفعيل</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-text-main flex items-center gap-2">
                                        <Shield size={16} className="text-indigo-500" />
                                        المستخدم المرتبط
                                    </h4>

                                    {/* Mini Tabs */}
                                    <div className="flex bg-surface-active p-1 rounded-lg">
                                        {(['info', 'backups', 'sessions'] as const).map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === tab ? 'bg-surface text-primary shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                                            >
                                                {tab === 'info' ? 'المعلومات' : tab === 'backups' ? 'النسخ' : 'الجلسات'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0d0d12] border border-border rounded-2xl p-5 relative overflow-hidden">
                                    {/* Decoration */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full pointer-events-none" />

                                    {loadingUser ? (
                                        <div className="py-12 flex flex-col items-center justify-center text-primary/50">
                                            <RefreshCw size={24} className="animate-spin mb-2" />
                                            <span className="text-xs">جاري جلب البيانات...</span>
                                        </div>
                                    ) : !userDetails ? (
                                        <div className="text-center py-8 text-white/30 text-sm">تعذر تحميل البيانات</div>
                                    ) : (
                                        <>
                                            {activeTab === 'info' && (
                                                <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border border-primary/20">
                                                            {userDetails.email?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-text-main font-bold truncate">{userDetails.email}</p>
                                                                <button onClick={() => onCopyKey(userDetails.email)} className="text-text-muted hover:text-text-main transition-colors"><Copy size={12} /></button>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <code className="text-[10px] bg-surface-active px-1.5 py-0.5 rounded text-primary font-mono truncate max-w-[200px]">{license.device_id}</code>
                                                                <button onClick={() => onCopyKey(license.device_id)} className="text-text-muted hover:text-text-main transition-colors"><Copy size={10} /></button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                                        <div className="bg-black/30 rounded-xl p-3 border border-border">
                                                            <p className="text-[10px] text-white/40 mb-1">آخر دخول</p>
                                                            <p className="text-xs text-indigo-200 font-mono">{userDetails.last_sign_in ? new Date(userDetails.last_sign_in).toLocaleString('ar-IQ') : '-'}</p>
                                                        </div>
                                                        <div className="bg-black/30 rounded-xl p-3 border border-border">
                                                            <p className="text-[10px] text-white/40 mb-1">عدد النسخ</p>
                                                            <p className="text-xs text-indigo-200 font-bold">{userDetails.backups?.length || 0} نسخة محفوظة</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'backups' && (
                                                <div className="space-y-2 animate-in slide-in-from-right-4 fade-in duration-300 max-h-[200px] overflow-y-auto custom-scrollbar">
                                                    {userDetails.backups?.length === 0 ? (
                                                        <div className="text-center py-8 text-text-muted text-xs">لا توجد نسخ احتياطية</div>
                                                    ) : (
                                                        userDetails.backups?.map((b, i) => (
                                                            <div key={i} className="flex justify-between items-center text-xs p-3 bg-surface border border-border rounded-xl hover:border-primary/50 transition-colors">
                                                                <div className="flex items-center gap-2">
                                                                    <Database size={12} className="text-primary" />
                                                                    <span className="text-text-main">{b.store_name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="font-mono text-text-muted">{formatSize(b.size)}</span>
                                                                    <span className="text-text-muted font-mono">{new Date(b.created_at).toLocaleDateString()}</span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}

                                            {activeTab === 'sessions' && (
                                                <div className="space-y-2 animate-in slide-in-from-right-4 fade-in duration-300 max-h-[200px] overflow-y-auto custom-scrollbar">
                                                    {userDetails.sessions?.length === 0 ? (
                                                        <div className="text-center py-8 text-text-muted text-xs">لا توجد جلسات أخرى</div>
                                                    ) : (
                                                        userDetails.sessions?.map((s, i) => (
                                                            <div key={i} className="flex justify-between items-center text-xs p-3 bg-surface border border-border rounded-xl">
                                                                <div className="flex items-center gap-2">
                                                                    <Smartphone size={12} className="text-primary" />
                                                                    <span className="text-text-main">{s.device_name || 'Device'}</span>
                                                                </div>
                                                                <span className="text-text-muted font-mono">{s.last_seen ? new Date(s.last_seen).toLocaleString() : '-'}</span>
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
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

const DEV_LOCKOUT_KEY = 'beidar_dev_lockout';
const MAX_LOGIN_ATTEMPTS = 5;

export const DeveloperDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [currentUser, setCurrentUser] = useState("");
    const [isBlocked, setIsBlocked] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);

    // Check for lockout on mount
    useEffect(() => {
        const lockoutData = localStorage.getItem(DEV_LOCKOUT_KEY);
        if (lockoutData) {
            try {
                const data = JSON.parse(lockoutData);
                if (data.blocked) {
                    setIsBlocked(true);
                }
                if (data.attempts) {
                    setFailedAttempts(data.attempts);
                }
            } catch {
                // Invalid data, ignore
            }
        }
    }, []);

    // Load saved session
    useEffect(() => {
        const savedUser = localStorage.getItem('DEV_DASH_USER');
        const savedKey = localStorage.getItem('DEV_DASH_KEY');
        if (savedUser) {
            setUsername(savedUser);
            setSavedSession(true);
        }
        if (savedKey) {
            setServiceKey(savedKey);
        }
    }, []);

    // Dashboard State
    const [activeView, setActiveView] = useState<'list' | 'create' | 'logs' | 'keys' | 'usage'>('list');
    const [showStats, setShowStats] = useState(true);
    const [apiKeys, setApiKeys] = useState<string[]>([]);
    const [newKey, setNewKey] = useState("");
    const [licenses, setLicenses] = useState<AdminLicense[]>([]);
    const [logs, setLogs] = useState<AdminLogEntry[]>([]);
    // AI Stats State
    const [aiStats, setAIStats] = useState<{ id: string, license_key: string, usage_date: string, request_count: number, updated_at: string, store_name?: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [serviceKey, setServiceKey] = useState("");
    const [savedSession, setSavedSession] = useState(false); // UI toggle state
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned' | 'expired'>('all');
    const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
    const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'expiry_soon' | 'expiry_late'>('newest');

    // Create Form State
    const [newLicense_Name, setNewLicense_Name] = useState("");
    const [newLicense_Phone, setNewLicense_Phone] = useState("");
    const [newLicense_Months, setNewLicense_Months] = useState(12);
    const [newLicense_Features, setNewLicense_Features] = useState({
        ai_features: true,
        inventory_pro: true,
        whatsapp_integration: false,
        cloud_sync: false
    });

    // Modals
    const [statusConfirm, setStatusConfirm] = useState<{ id: number; newStatus: string; key: string } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; key: string } | null>(null);
    const [resetTrialConfirm, setResetTrialConfirm] = useState<{ id: number; key: string } | null>(null);
    const [extendModal, setExtendModal] = useState<AdminLicense | null>(null);
    const [extendMonths, setExtendMonths] = useState(12);
    const [detailsModal, setDetailsModal] = useState<AdminLicense | null>(null);
    const [featureConfirm, setFeatureConfirm] = useState<{ id: number; key: string; featureKey: string; featureLabel: string; newValue: boolean; features: Record<string, boolean> } | null>(null);

    const { showToast, ToastComponent } = useToast();

    // Feature Toggle Handler
    const confirmFeatureToggle = async () => {
        if (!featureConfirm) return;
        try {
            const updatedFeatures = { ...featureConfirm.features, [featureConfirm.featureKey]: featureConfirm.newValue };
            await api.admin.updateFeatures(featureConfirm.id, updatedFeatures);
            fetchLicenses(); // Refresh UI
            showToast(`تم تحديث ميزة ${featureConfirm.featureLabel} بنجاح`, "success");
        } catch (e) {
            showToast("فشل تحديث الميزات", "error");
        } finally {
            setFeatureConfirm(null);
        }
    };

    // ─── AI Keys Management ──────────────────────────────────────────────────
    const fetchKeys = async () => {
        try {
            const keys = await api.ai.fetchGlobalKeys();
            setApiKeys(keys || []);
        } catch (e) {
            console.error("Failed to fetch cloud keys", e);
            // Don't show toast on initial load to avoid annoyance if offline?
            // showToast("فشل الاتصال بالسحابة", "error");
        }
    };

    const addKey = async () => {
        if (!newKey.trim()) return;
        const updated = [...apiKeys, newKey.trim()];
        setApiKeys(updated); // Optimistic update
        setNewKey("");
        await saveKeys(updated);
    };

    const removeKey = async (index: number) => {
        if (!confirm('هل أنت متأكد من حذف هذا المفتاح؟')) return;
        const updated = apiKeys.filter((_, i) => i !== index);
        setApiKeys(updated); // Optimistic update
        await saveKeys(updated);
    };

    const saveKeys = async (keys: string[]) => {
        try {
            await api.ai.saveGlobalKeys(keys);
            showToast("تم تحديث مفاتيح API في السحابة", "success");
        } catch (e: unknown) {
            console.error(e);
            // Show the actual error message from backend
            const msg = e instanceof Error ? e.message : String(e);
            showToast(`فشل التحديث: ${msg}`, "error");
            fetchKeys(); // Revert to source of truth
        }
    };

    useEffect(() => {
        if (activeView === 'keys') {
            fetchKeys();
        } else if (activeView === 'list') {
            fetchLicenses();
        }
    }, [activeView]);

    // ─── Export CSV ───────────────────────────────────────────────────────────
    const exportToCSV = () => {
        const headers = ['ID', 'License Key', 'Customer Name', 'Phone', 'Status', 'Expires At', 'Device ID', 'Last Check-In', 'Features'];
        const rows = licenses.map(l => [
            l.id,
            l.license_key,
            l.customer_name || '',
            l.customer_phone || '',
            l.status,
            l.expires_at,
            l.device_id || '',
            l.last_check_in || '',
            JSON.stringify(l.features || {})
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `licenses_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('تم تصدير التراخيص بنجاح', 'success');
    };

    // ─── API Functions ───────────────────────────────────────────────────────────

    const logAction = async (action: string, target: string, details: string) => {
        api.admin.logAction(currentUser, action, target, details).catch(console.error);
    };

    const handleLogin = async () => {
        // Check if already blocked
        if (isBlocked) {
            setLoginError("⛔ تم حظرك من الوصول إلى هذه اللوحة");
            return;
        }

        setLoading(true);
        setLoginError("");
        try {
            if (serviceKey) {
                await api.admin.setMasterKey(serviceKey);
            }
            const result = await api.admin.login(username, password);
            if (result.success) {
                // Reset attempts on successful login
                localStorage.removeItem(DEV_LOCKOUT_KEY);
                setFailedAttempts(0);
                setIsAuthenticated(true);
                setCurrentUser(username);

                // Handle Remember Me
                if (savedSession) {
                    localStorage.setItem('DEV_DASH_USER', username);
                    if (serviceKey) localStorage.setItem('DEV_DASH_KEY', serviceKey);
                } else {
                    localStorage.removeItem('DEV_DASH_USER');
                    localStorage.removeItem('DEV_DASH_KEY');
                }

                fetchLicenses();
            } else {
                // Increment failed attempts
                const newAttempts = failedAttempts + 1;
                setFailedAttempts(newAttempts);

                if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
                    // Block the user permanently
                    setIsBlocked(true);
                    localStorage.setItem(DEV_LOCKOUT_KEY, JSON.stringify({
                        blocked: true,
                        attempts: newAttempts,
                        blockedAt: new Date().toISOString()
                    }));
                    setLoginError("⛔ تم حظرك نهائياً بسبب المحاولات الفاشلة المتكررة");
                } else {
                    // Save current attempts
                    localStorage.setItem(DEV_LOCKOUT_KEY, JSON.stringify({
                        blocked: false,
                        attempts: newAttempts
                    }));
                    const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
                    setLoginError(`بيانات خاطئة - متبقي ${remaining} محاولة قبل الحظر`);
                }
            }
        } catch {
            setLoginError("خطأ غير متوقع");
        } finally {
            setLoading(false);
        }
    };

    const fetchLicenses = async () => {
        setLoading(true);
        try {
            const data = await api.admin.fetchLicenses();
            setLicenses(data || []);
        } catch (err) {
            console.error(err);
            showToast("فشل في تحميل التراخيص", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        setActiveView('logs');
        try {
            const data = await api.admin.fetchLogs();
            setLogs(data || []);
        } catch (err) {
            console.error(err);
            showToast("فشل في تحميل السجلات", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchAIUsage = async () => {
        setLoading(true);
        setActiveView('usage');
        try {
            const data = await api.ai.fetchUsageStats?.() || [];
            setAIStats(data || []);
        } catch (err) {
            console.error(err);
            showToast("فشل في تحليل بيانات الذكاء الاصطناعي", "error");
        } finally {
            setLoading(false);
        }
    };

    const createLicense = async () => {
        if (!newLicense_Name) {
            showToast("اسم العميل مطلوب", "error");
            return;
        }

        setLoading(true);
        try {
            const result = await api.admin.createLicense(
                newLicense_Name,
                newLicense_Phone,
                newLicense_Months,
                newLicense_Features
            );

            if (result) {
                logAction('CREATE_LICENSE', result.license_key, `Client: ${newLicense_Name}`);
                showToast(`تم إنشاء الرخصة: ${result.license_key}`, 'success');
                navigator.clipboard.writeText(result.license_key);
                setNewLicense_Name("");
                setNewLicense_Phone("");
                setActiveView('list');
                fetchLicenses();
            }
        } catch {
            showToast("فشل إنشاء الرخصة", "error");
        } finally {
            setLoading(false);
        }
    };

    const confirmExtend = async () => {
        if (!extendModal) return;
        try {
            await api.admin.extendLicense(extendModal.id, extendModal.expires_at, extendMonths);
            logAction('EXTEND_LICENSE', extendModal.license_key, `Extended by ${extendMonths} months`);
            fetchLicenses();
            showToast("تم التمديد بنجاح ✅", "success");
        } catch {
            showToast("فشل التمديد", "error");
        }
        setExtendModal(null);
    };

    const confirmStatusUpdate = async () => {
        if (!statusConfirm) return;
        try {
            await api.admin.updateStatus(statusConfirm.id, statusConfirm.newStatus);
            logAction('UPDATE_STATUS', statusConfirm.key, `Status changed to ${statusConfirm.newStatus}`);
            fetchLicenses();
            showToast("تم تحديث الحالة", "success");
        } catch {
            showToast("فشل تحديث الحالة", "error");
        }
        setStatusConfirm(null);
    };

    const confirmDeleteLicense = async () => {
        if (!deleteConfirm) return;
        try {
            await api.admin.deleteLicense(deleteConfirm.id);
            logAction('DELETE_LICENSE', deleteConfirm.key, 'Permanently deleted');
            fetchLicenses();
            showToast("تم الحذف", "success");
        } catch {
            showToast("فشل الحذف", "error");
        }
        setDeleteConfirm(null);
    };

    const confirmResetToTrial = async () => {
        if (!resetTrialConfirm) return;
        try {
            await api.admin.resetToTrial(resetTrialConfirm.id);
            logAction('RESET_TO_TRIAL', resetTrialConfirm.key, 'Reset to 7-day trial from creation date');
            fetchLicenses();
            showToast("تم إعادة ضبط الترخيص إلى فترة تجريبية ✅", "success");
        } catch {
            showToast("فشل إعادة الضبط", "error");
        }
        setResetTrialConfirm(null);
    };

    const togglePaymentStatus = async (id: number, currentStatus: boolean, key: string) => {
        try {
            await api.admin.updatePaymentStatus(id, !currentStatus);
            logAction('UPDATE_PAYMENT', key, `Payment status changed to ${!currentStatus ? 'paid' : 'unpaid'}`);
            fetchLicenses();
            showToast(!currentStatus ? "✅ تم تسجيل التسديد" : "تم إلغاء التسديد", "success");
        } catch {
            showToast("فشل تحديث حالة الدفع", "error");
        }
    };

    const copyKey = (key: string) => {
        navigator.clipboard.writeText(key);
        showToast("تم نسخ الكود", "success");
    };

    const toggleFeature = (key: keyof typeof newLicense_Features) => {
        setNewLicense_Features(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // ─── Computed Values ─────────────────────────────────────────────────────────

    const stats = useMemo(() => {
        const total = licenses.length;
        const active = licenses.filter(l => l.status === 'active' && new Date(l.expires_at) > new Date()).length;
        const banned = licenses.filter(l => l.status === 'banned').length;
        const expired = licenses.filter(l => new Date(l.expires_at) < new Date()).length;
        return { total, active, banned, expired };
    }, [licenses]);

    const filteredLicenses = useMemo(() => {
        let result = licenses.filter(l => {
            const matchesSearch = JSON.stringify(l).toLowerCase().includes(searchTerm.toLowerCase());
            const isExpired = new Date(l.expires_at) < new Date();
            const isPaid = l.is_paid;

            // 1. Status Filter
            let matchesStatus = true;
            if (statusFilter === 'active') matchesStatus = l.status === 'active' && !isExpired;
            else if (statusFilter === 'banned') matchesStatus = l.status === 'banned';
            else if (statusFilter === 'expired') matchesStatus = isExpired;

            // 2. Payment Filter
            let matchesPayment = true;
            if (paymentFilter === 'paid') matchesPayment = isPaid;
            else if (paymentFilter === 'unpaid') matchesPayment = !isPaid;

            return matchesSearch && matchesStatus && matchesPayment;
        });

        // 3. Sorting
        return result.sort((a, b) => {
            if (sortOption === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            if (sortOption === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            if (sortOption === 'expiry_soon') return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
            if (sortOption === 'expiry_late') return new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime();
            return 0;
        });
    }, [licenses, searchTerm, statusFilter, paymentFilter, sortOption]);

    // ═══════════════════════════════════════════════════════════════════════════════
    // BLOCKED SCREEN
    // ═══════════════════════════════════════════════════════════════════════════════

    if (isBlocked) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg bg-mesh" dir="rtl">
                {/* Red Background Effects */}
                <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-red-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="w-96 p-8 bg-surface backdrop-blur-2xl border border-red-500/30 rounded-3xl shadow-2xl animate-in fade-in zoom-in duration-500">
                    <div className="flex justify-center mb-6">
                        <div className="p-5 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-2xl relative">
                            <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-2xl animate-pulse"></div>
                            <Ban size={52} className="text-red-500 relative z-10" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-black text-center mb-1 text-red-500">⛔ تم الحظر</h2>
                    <p className="text-center text-text-muted text-sm mb-6">
                        تم حظرك من الوصول إلى لوحة التحكم بسبب المحاولات الفاشلة المتكررة
                    </p>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center mb-6">
                        <p className="text-red-400 text-xs font-bold">
                            هذا الحظر دائم ولا يمكن إلغاؤه إلا من خلال المطور
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 rounded-xl bg-surface-hover text-text-muted font-bold hover:bg-surface-active transition-all"
                    >
                        إغلاق
                    </button>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // LOGIN SCREEN
    // ═══════════════════════════════════════════════════════════════════════════════

    if (!isAuthenticated) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg bg-mesh" dir="rtl">
                {/* Mesh Background Effects */}
                <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-primary-light/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="w-96 p-8 bg-surface/80 backdrop-blur-2xl border border-border rounded-3xl shadow-2xl animate-in fade-in zoom-in duration-500 glass">
                    <div className="flex justify-center mb-6">
                        <div className="p-5 bg-gradient-to-br from-primary/20 to-primary-light/20 rounded-2xl relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-2xl animate-pulse"></div>
                            <Shield size={52} className="text-primary relative z-10" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-black text-center mb-1 text-text-main">منطقة المطورين</h2>
                    <p className="text-center text-text-muted text-sm mb-8">تسجيل دخول آمن للوحة التحكم</p>

                    {/* Attempts Warning */}
                    {failedAttempts > 0 && !isBlocked && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 text-center">
                            <p className="text-amber-500 text-xs font-bold">
                                ⚠️ تحذير: {MAX_LOGIN_ATTEMPTS - failedAttempts} محاولة متبقية قبل الحظر النهائي
                            </p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <input
                            type="text"
                            placeholder="اسم المستخدم"
                            className="w-full bg-input-bg border-border rounded-xl px-4 py-3.5 text-text-main outline-none focus:border-primary/50 focus:bg-surface-active transition-all placeholder:text-text-muted input-premium"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="كلمة المرور"
                            className="w-full bg-input-bg border-border rounded-xl px-4 py-3.5 text-text-main outline-none focus:border-primary/50 focus:bg-surface-active transition-all placeholder:text-text-muted input-premium"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        />
                        <input
                            type="password"
                            placeholder="مفتاح الخدمة (Service Key - اختياري)"
                            className="w-full bg-input-bg border-border border rounded-xl px-4 py-3.5 text-primary font-mono text-xs outline-none focus:border-primary focus:bg-surface-active transition-all placeholder:text-text-muted input-premium"
                            value={serviceKey}
                            onChange={e => setServiceKey(e.target.value)}
                        />

                        <div className="flex items-center gap-2 px-1">
                            <input
                                type="checkbox"
                                id="rememberMe"
                                checked={savedSession}
                                onChange={e => setSavedSession(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-600 bg-black/20 text-primary focus:ring-primary focus:ring-offset-0"
                            />
                            <label htmlFor="rememberMe" className="text-xs text-text-muted cursor-pointer select-none">
                                تذكرني (حفظ المفاتيح محلياً)
                            </label>
                        </div>

                        {loginError && (
                            <div className="text-red-500 text-sm text-center font-bold px-3 py-2.5 bg-red-500/10 rounded-xl border border-red-500/20 flex items-center gap-2 justify-center">
                                <AlertTriangle size={16} />
                                {loginError}
                            </div>
                        )}

                        <button
                            onClick={handleLogin}
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-light text-primary-fg font-bold transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-primary/20 btn-press"
                        >
                            {loading ? 'جاري التحقق...' : 'دخول آمن'}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full text-text-muted text-sm hover:text-text-main transition-colors py-2"
                        >
                            إغلاق
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // MAIN DASHBOARD
    // ═══════════════════════════════════════════════════════════════════════════════

    return (
        <div className="fixed inset-0 z-[100] bg-bg text-text-main flex flex-col overflow-hidden" dir="rtl">
            {/* Mesh Background Effects */}
            <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px] pointer-events-none"></div>
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-primary-light/5 rounded-full blur-[120px] pointer-events-none"></div>

            {ToastComponent}

            {/* Header */}
            <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-surface/80 backdrop-blur-xl shrink-0 relative z-10 shadow-sm glass">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Shield size={24} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold">لوحة التحكم المركزية</h1>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-text-muted font-mono">ADMIN_PANEL</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-xs text-text-muted px-3 border-l border-border font-mono">
                        {currentUser} 👨‍💻
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="p-2 hover:bg-surface-hover rounded-lg text-text-muted hover:text-primary transition-colors"
                        title="تصدير CSV"
                        aria-label="تصدير CSV"
                    >
                        <Download size={20} />
                    </button>
                    <button
                        onClick={fetchLicenses}
                        className="p-2 hover:bg-surface-hover rounded-lg text-text-muted hover:text-text-main transition-colors"
                        title="تحديث"
                        aria-label="تحديث"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className={`p-2 hover:bg-surface-hover rounded-lg text-text-muted hover:text-text-main transition-colors ${showStats ? 'bg-primary/20 text-primary' : ''}`}
                        title="إظهار/إخفاء الإحصائيات"
                        aria-label="إظهار/إخفاء الإحصائيات"
                    >
                        {showStats ? <Activity size={20} /> : <Activity size={20} className="opacity-50" />}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors text-sm font-bold"
                    >
                        خروج
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className={`px-6 py-5 border-b border-border bg-background shrink-0 relative z-10 transition-all duration-500 ease-in-out overflow-hidden ${showStats ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 py-0'}`}>
                <div className="grid grid-cols-4 gap-4">
                    <StatCard
                        icon={<Key size={20} className="text-white" />}
                        label="إجمالي التراخيص"
                        value={stats.total}
                        color="bg-slate-500/20"
                    />
                    <StatCard
                        icon={<CheckCircle size={20} className="text-primary" />}
                        label="نشطة"
                        value={stats.active}
                        color="bg-primary/20"
                    />
                    <StatCard
                        icon={<Ban size={20} className="text-red-400" />}
                        label="محظورة"
                        value={stats.banned}
                        color="bg-red-500/20"
                    />
                    <StatCard
                        icon={<Clock size={20} className="text-amber-400" />}
                        label="منتهية"
                        value={stats.expired}
                        color="bg-amber-500/20"
                    />
                </div>
            </div>

            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-surface shrink-0">
                <div className="flex items-center gap-2">
                    <TabButton
                        active={activeView === 'list'}
                        icon={<Search size={16} />}
                        label="التراخيص"
                        onClick={() => setActiveView('list')}
                    />
                    <TabButton
                        active={activeView === 'create'}
                        icon={<Plus size={16} />}
                        label="إصدار رخصة"
                        onClick={() => setActiveView('create')}
                    />
                    <TabButton
                        active={activeView === 'keys'}
                        icon={<Key size={16} />}
                        label="مفاتيح AI"
                        onClick={() => setActiveView('keys')}
                    />
                    <TabButton
                        active={activeView === 'logs'}
                        icon={<Activity size={16} />}
                        label="سجل النشاطات"
                        onClick={fetchLogs}
                    />
                    <TabButton
                        active={activeView === 'usage'}
                        icon={<Zap size={16} />}
                        label="استهلاك AI"
                        onClick={fetchAIUsage}
                    />
                </div>

                {activeView === 'list' && (
                    <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4 bg-surface/30 p-2 rounded-xl border border-white/5 backdrop-blur-sm">
                        {/* Search */}
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="بحث عن عميل، رقم هاتف، أو كود رخصة..."
                                className="w-full bg-input-bg border border-border rounded-lg pl-4 pr-10 py-2.5 text-xs text-text-main focus:border-primary outline-none placeholder:text-text-muted transition-all focus:bg-surface-active"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted opacity-50" size={14} />
                        </div>

                        <div className="h-8 w-px bg-white/10 hidden xl:block mx-2" />

                        {/* Filters Group */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 xl:pb-0 scrollbar-hide">
                            {/* Status Filter */}
                            <div className="relative group">
                                <Filter size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none group-hover:text-primary transition-colors" />
                                <select
                                    title="Filter by Status"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as 'active' | 'all' | 'banned' | 'expired')}
                                    className="appearance-none bg-input-bg hover:bg-surface-hover border border-border hover:border-text-muted/30 rounded-lg pr-9 pl-4 py-2 text-xs font-bold text-text-main outline-none focus:border-primary transition-all cursor-pointer min-w-[120px]"
                                >
                                    <option value="all">كل الحالات</option>
                                    <option value="active">🟢 نشطة</option>
                                    <option value="banned">🔴 محظورة</option>
                                    <option value="expired">🟡 منتهية</option>
                                </select>
                            </div>

                            {/* Payment Filter */}
                            <div className="relative group">
                                <CreditCard size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none group-hover:text-primary transition-colors" />
                                <select
                                    title="Filter by Payment"
                                    value={paymentFilter}
                                    onChange={(e) => setPaymentFilter(e.target.value as 'paid' | 'all' | 'unpaid')}
                                    className="appearance-none bg-input-bg hover:bg-surface-hover border border-border hover:border-text-muted/30 rounded-lg pr-9 pl-4 py-2 text-xs font-bold text-text-main outline-none focus:border-primary transition-all cursor-pointer min-w-[120px]"
                                >
                                    <option value="all">كل الاشتراكات</option>
                                    <option value="paid">💰 مدفوع</option>
                                    <option value="unpaid">💸 غير مدفوع</option>
                                </select>
                            </div>

                            {/* Sort Option */}
                            <div className="relative group">
                                <ArrowUpDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none group-hover:text-primary transition-colors" />
                                <select
                                    title="Sort Licenses"
                                    value={sortOption}
                                    onChange={(e) => setSortOption(e.target.value as 'newest' | 'oldest' | 'expiry_soon' | 'expiry_late')}
                                    className="appearance-none bg-input-bg hover:bg-surface-hover border border-border hover:border-text-muted/30 rounded-lg pr-9 pl-4 py-2 text-xs font-bold text-text-main outline-none focus:border-primary transition-all cursor-pointer min-w-[140px]"
                                >
                                    <option value="newest">📅 الأحدث إنشاءً</option>
                                    <option value="oldest">Oldest Created</option>
                                    <option value="expiry_soon">⏳ الأقرب انتهاءً</option>
                                    <option value="expiry_late">Furthest Expiry</option>
                                </select>
                            </div>
                        </div>

                        {/* Result Count Badge */}
                        <div className="bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg whitespace-nowrap hidden sm:block">
                            <span className="text-[10px] text-primary font-bold">
                                {filteredLicenses.length} رخصة
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 custom-scrollbar">

                {/* KEYS VIEW */}
                {activeView === 'keys' && (
                    <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-5 fade-in duration-500">
                        <div className="bg-surface border border-border rounded-2xl p-8">
                            <div className="flex items-center justify-between w-full mb-6">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-purple-500">
                                    <Key className="text-purple-500" />
                                    إدارة مفاتيح الذكاء الاصطناعي (Gemini)
                                </h2>
                                <div className="flex gap-2">
                                    <span className="text-xs text-text-muted flex items-center gap-1 bg-purple-500/5 px-3 py-1 rounded-full border border-purple-500/10">
                                        <Cloud size={12} className="text-purple-400" />
                                        متزامن مع السحابة
                                    </span>
                                </div>
                            </div>
                            <p className="text-text-muted text-sm mb-6">
                                قم بإضافة مفاتيح API متعددة لتجنب توقف الخدمة. سيقوم النظام بتجربة المفاتيح تلقائياً في حال فشل أحدها.
                            </p>

                            {/* Add Key */}
                            <div className="flex gap-3 mb-8">
                                <input
                                    type="text"
                                    value={newKey}
                                    onChange={(e) => setNewKey(e.target.value)}
                                    placeholder="أدخل مفتاح Google Gemini API الجديد..."
                                    className="flex-1 bg-input-bg border border-border rounded-xl px-4 py-3 text-text-main focus:border-purple-500 outline-none transition-colors font-mono text-sm"
                                />
                                <button
                                    onClick={addKey}
                                    disabled={!newKey.trim()}
                                    className="px-6 py-2 bg-purple-600/20 text-purple-500 border border-purple-500/50 hover:bg-purple-600 hover:text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <Plus size={18} />
                                    إضافة
                                </button>
                            </div>

                            {/* Keys List */}
                            <div className="space-y-3">
                                {apiKeys.map((key, index) => (
                                    <div key={index} className="flex items-center justify-between p-4 bg-background border border-border rounded-xl group hover:border-text-muted/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 font-mono text-xs">
                                                {index + 1}
                                            </div>
                                            <code className="text-text-main font-mono text-sm">
                                                {key.substring(0, 8)}...{key.substring(key.length - 8)}
                                            </code>
                                            {index === 0 && (
                                                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                                                    الأساسي
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => removeKey(index)}
                                            className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="حذف المفتاح"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {apiKeys.length === 0 && (
                                    <div className="text-center py-12 border border-dashed border-border rounded-xl">
                                        <Key size={32} className="mx-auto text-text-muted mb-3" />
                                        <p className="text-text-muted">لا توجد مفاتيح مضافة</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* LOGS VIEW */}
                {activeView === 'logs' && (
                    <div className="max-w-6xl mx-auto">
                        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-right">
                                <thead>
                                    <tr className="text-text-muted text-xs border-b border-border bg-surface-active">
                                        <th className="p-4">الوقت</th>
                                        <th className="p-4">المشرف</th>
                                        <th className="p-4">الإجراء</th>
                                        <th className="p-4">الهدف</th>
                                        <th className="p-4">التفاصيل</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {logs.map(log => (
                                        <tr key={log.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                                            <td className="p-4 text-text-muted font-mono text-xs">{new Date(log.created_at).toLocaleString('ar-IQ')}</td>
                                            <td className="p-4 font-bold text-emerald-500">{log.admin_username}</td>
                                            <td className="p-4">
                                                <span className="bg-surface-active px-2 py-1 rounded text-xs font-mono">{log.action}</span>
                                            </td>
                                            <td className="p-4 font-mono text-xs text-text-muted">{log.target_license?.substring(0, 25)}</td>
                                            <td className="p-4 text-text-muted text-xs max-w-md truncate">{log.details}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {logs.length === 0 && (
                                <div className="text-center py-12 text-text-muted">
                                    <Activity size={32} className="mx-auto mb-3 opacity-30" />
                                    <p>لا توجد سجلات</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* CREATE VIEW */}
                {activeView === 'create' && (
                    <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-5 fade-in duration-500">
                        <div className="bg-surface border border-border rounded-2xl p-8 shadow-sm">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-primary">
                                <Smartphone className="text-primary" />
                                إصدار رخصة جديدة
                            </h2>

                            <div className="grid grid-cols-2 gap-6 mb-8">
                                <div className="col-span-2">
                                    <label className="block text-xs text-text-muted mb-2 font-bold">اسم العميل</label>
                                    <input
                                        type="text"
                                        className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-text-main focus:border-primary outline-none transition-colors"
                                        value={newLicense_Name}
                                        onChange={e => setNewLicense_Name(e.target.value)}
                                        placeholder="مثلاً: مطعم السعادة"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-text-muted mb-2 font-bold">رقم الهاتف</label>
                                    <input
                                        type="text"
                                        className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-text-main focus:border-primary outline-none transition-colors"
                                        value={newLicense_Phone}
                                        onChange={e => setNewLicense_Phone(e.target.value)}
                                        placeholder="07xxxxxxxx"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-text-muted mb-2 font-bold">المدة</label>
                                    <select
                                        title="اختر مدة الترخيص"
                                        className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-text-main focus:border-primary outline-none"
                                        value={newLicense_Months}
                                        onChange={e => setNewLicense_Months(parseInt(e.target.value))}
                                    >
                                        <option value={0}>أسبوع تجريبي (7 أيام)</option>
                                        <option value={6}>6 أشهر</option>
                                        <option value={12}>سنة</option>
                                        <option value={24}>سنتين</option>
                                        <option value={1188}>مدى الحياة (99 سنة)</option>
                                    </select>
                                </div>

                                {/* Features */}
                                <div className="col-span-2 mt-4">
                                    <label className="block text-xs text-text-muted mb-4 font-bold">الميزات</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { key: 'ai_features', icon: Zap, label: 'الذكاء الاصطناعي' },
                                            { key: 'inventory_pro', icon: Database, label: 'إدارة مخزون متقدمة' },
                                            { key: 'whatsapp_integration', icon: MessageCircle, label: 'رسائل واتساب' },
                                            { key: 'cloud_sync', icon: Cloud, label: 'المزامنة السحابية' },
                                        ].map(feature => (
                                            <div
                                                key={feature.key}
                                                onClick={() => toggleFeature(feature.key as keyof typeof newLicense_Features)}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${newLicense_Features[feature.key as keyof typeof newLicense_Features]
                                                    ? 'bg-primary/10 border-primary text-primary'
                                                    : 'bg-input-bg border-border text-text-muted hover:border-text-muted/30'
                                                    }`}
                                            >
                                                <feature.icon size={18} />
                                                <span className="text-sm font-bold">{feature.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-border">
                                <button
                                    onClick={() => setActiveView('list')}
                                    className="px-6 py-2.5 rounded-xl hover:bg-surface-hover text-text-muted transition-colors"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={createLicense}
                                    disabled={loading}
                                    className="px-8 py-2.5 rounded-xl bg-primary text-primary-fg font-bold hover:brightness-110 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'جاري الإنشاء...' : 'إنشاء وتفعيل'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* LIST VIEW */}
                {activeView === 'list' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                        {filteredLicenses.map(license => (
                            <LicenseCard
                                key={license.id}
                                license={license}
                                onCopyKey={copyKey}
                                onExtend={(l) => { setExtendModal(l); setExtendMonths(12); }}
                                onResetToTrial={(id, key) => setResetTrialConfirm({ id, key })}
                                onTogglePayment={togglePaymentStatus}
                                onUpdateStatus={(id, status, key) => setStatusConfirm({ id, newStatus: status, key })}
                                onDelete={(id, key) => setDeleteConfirm({ id, key })}
                                onViewDetails={(l) => setDetailsModal(l)}
                            />
                        ))}
                        {filteredLicenses.length === 0 && (
                            <div className="col-span-full text-center py-16 text-gray-500">
                                <Key size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="font-bold">لا توجد تراخيص مطابقة</p>
                                <p className="text-sm mt-1">جرب تغيير البحث أو الفلتر</p>
                            </div>
                        )}
                    </div>
                )}

                {/* AI USAGE VIEW */}
                {activeView === 'usage' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl">
                            <div className="p-4 border-b border-border flex justify-between items-center bg-surface-active">
                                <h3 className="font-bold text-text-main flex items-center gap-2">
                                    <Zap className="text-yellow-400" size={20} />
                                    استهلاك الذكاء الاصطناعي (Daily Usage)
                                </h3>
                                <button onClick={fetchAIUsage} className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-text-muted hover:text-text-main" title="تحديث">
                                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-right">
                                    <thead className="bg-black/20 text-text-muted text-xs font-bold uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">التاريخ</th>
                                            <th className="px-6 py-4">المتجر / الترخيص</th>
                                            <th className="px-6 py-4">عدد الطلبات</th>
                                            <th className="px-6 py-4">آخر تحديث</th>
                                            <th className="px-6 py-4">الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {aiStats.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                                                    <Zap size={32} className="mx-auto mb-3 opacity-30" />
                                                    لا توجد بيانات استهلاك مسجلة
                                                </td>
                                            </tr>
                                        ) : (
                                            aiStats.map((stat, i) => {
                                                const limit = 20;
                                                const percentage = Math.min(100, (stat.request_count / limit) * 100);
                                                let statusColor = "bg-emerald-500";
                                                if (percentage > 90) statusColor = "bg-red-500";
                                                else if (percentage > 50) statusColor = "bg-amber-500";

                                                return (
                                                    <tr key={stat.id || i} className="hover:bg-surface-hover transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-main font-mono">
                                                            {stat.usage_date}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-text-main font-bold text-sm">{stat.store_name || 'غير معروف'}</span>
                                                                <span className="text-xs text-text-muted font-mono flex items-center gap-1 group-hover:text-blue-500 cursor-pointer" onClick={() => copyKey(stat.license_key)}>
                                                                    {stat.license_key.substring(0, 12)}...
                                                                    <Copy size={10} />
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-text-main font-bold font-mono w-8">{stat.request_count}</span>
                                                                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                                                                    <div className={`h-full ${statusColor} transition-all duration-500 ai-usage-bar`} data-width={percentage} />
                                                                </div>
                                                                <span className="text-xs text-text-muted">{percentage.toFixed(0)}%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-text-muted">
                                                            {stat.updated_at ? new Date(stat.updated_at).toLocaleTimeString('ar-IQ') : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            {stat.request_count >= limit ? (
                                                                <span className="px-2 py-1 bg-red-500/20 text-red-500 rounded text-xs font-bold border border-red-500/30">Maxed</span>
                                                            ) : (
                                                                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-500 rounded text-xs font-bold border border-emerald-500/30">Active</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <ConfirmModal
                isOpen={statusConfirm !== null}
                title="تغيير حالة الرخصة"
                message={`هل أنت متأكد من ${statusConfirm?.newStatus === 'banned' ? 'حظر' : 'تفعيل'} هذه الرخصة؟`}
                type={statusConfirm?.newStatus === 'banned' ? 'error' : 'warning'}
                confirmText={statusConfirm?.newStatus === 'banned' ? 'حظر' : 'تفعيل'}
                cancelText="إلغاء"
                onConfirm={confirmStatusUpdate}
                onCancel={() => setStatusConfirm(null)}
            />

            <ConfirmModal
                isOpen={deleteConfirm !== null}
                title="⚠️ تحذير: حذف نهائي وشامل"
                message="سيتم حذف الآتي بشكل نهائي ولا يمكن التراجع:\n\n🔑 الترخيص المحدد\n👤 حساب المستخدم المرتبط\n☁️ جميع النسخ الاحتياطية السحابية\n\nهل أنت متأكد تماماً؟"
                type="error"
                confirmText="حذف الكل نهائياً"
                cancelText="إلغاء"
                onConfirm={confirmDeleteLicense}
                onCancel={() => setDeleteConfirm(null)}
            />

            <ConfirmModal
                isOpen={resetTrialConfirm !== null}
                title="⏰ إعادة ضبط إلى فترة تجريبية"
                message="سيتم تقليص صلاحية الترخيص إلى 7 أيام من تاريخ الإنشاء.\n\n⚠️ إذا كان الترخيص قديماً، قد يصبح منتهي الصلاحية فوراً!\n\nهل أنت متأكد؟"
                type="warning"
                confirmText="إعادة ضبط"
                cancelText="إلغاء"
                onConfirm={confirmResetToTrial}
                onCancel={() => setResetTrialConfirm(null)}
            />

            <ConfirmModal
                isOpen={featureConfirm !== null}
                title="تحديث ميزات الترخيص"
                message={`هل أنت متأكد من ${featureConfirm?.newValue ? 'تفعيل' : 'إيقاف'} ميزة "${featureConfirm?.featureLabel}" لهذا الترخيص؟\n\nسيتم تحديث صلاحيات المستخدم فوراً.`}
                type={featureConfirm?.newValue ? 'warning' : 'error'}
                confirmText={featureConfirm?.newValue ? 'تفعيل الميزة' : 'إيقاف الميزة'}
                cancelText="إلغاء"
                onConfirm={confirmFeatureToggle}
                onCancel={() => setFeatureConfirm(null)}
            />

            {/* Extend Modal */}
            {extendModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={() => setExtendModal(null)}>
                    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 w-96 animate-in zoom-in-95 fade-in shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Calendar className="text-emerald-500" size={20} />
                            تمديد الرخصة
                        </h3>
                        <p className="text-sm text-gray-400 mb-4">
                            العميل: <span className="text-white font-bold">{extendModal.customer_name}</span>
                        </p>
                        <div className="mb-4">
                            <label className="text-xs text-gray-500 mb-2 block font-bold">عدد الأشهر</label>
                            <select
                                title="اختر عدد أشهر التمديد"
                                value={extendMonths}
                                onChange={e => setExtendMonths(parseInt(e.target.value))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none backdrop-blur-sm"
                            >
                                <option value={1}>شهر واحد</option>
                                <option value={3}>3 أشهر</option>
                                <option value={6}>6 أشهر</option>
                                <option value={12}>سنة كاملة</option>
                                <option value={24}>سنتين</option>
                                <option value={1188}>مدى الحياة (Lifetime)</option>
                            </select>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setExtendModal(null)}
                                className="flex-1 py-2.5 rounded-xl hover:bg-[#222] text-gray-400 border border-[#222]"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={confirmExtend}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500"
                            >
                                تمديد
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {detailsModal && (
                <DetailsModalContent
                    license={detailsModal}
                    onClose={() => setDetailsModal(null)}
                    onCopyKey={copyKey}
                    fetchLicenses={fetchLicenses}
                    showToast={showToast}
                    onToggleFeature={(id, key, featureKey, featureLabel, newValue, features) => {
                        setFeatureConfirm({ id, key, featureKey, featureLabel, newValue, features });
                    }}
                />
            )}
        </div>
    );
};

