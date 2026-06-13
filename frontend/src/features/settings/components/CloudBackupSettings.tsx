import { useState, useEffect } from 'react';
import { Cloud, Check, AlertCircle, Loader2, Info, Database, RefreshCw, User, LogIn, LogOut, Download, Trash2 } from 'lucide-react';
import { ConfirmModal } from '../../../components/ConfirmModal';
import * as CloudHandler from '../../../../wailsjs/go/handlers/CloudHandler';

// Types
interface UserSession {
    user_id: string;
    email: string;
    store_name: string;
    access_token: string;
    expires_at: number;
}

interface SupabaseAuthResult {
    success: boolean;
    message: string;
    user?: UserSession;
}

interface CloudBackup {
    id: string;
    user_id: string;
    store_name: string;
    size_bytes: number;
    chunks: number;
    created_at: string;
}

export function CloudBackupSettings() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
    const [backups, setBackups] = useState<CloudBackup[]>([]);
    const [autoSync, setAutoSync] = useState(false);

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [storeName, setStoreName] = useState('');
    const [isRegisterMode, setIsRegisterMode] = useState(false);

    // Loading states
    const [authLoading, setAuthLoading] = useState(false);
    const [backupLoading, setBackupLoading] = useState(false);
    const [restoreLoading, setRestoreLoading] = useState<string | null>(null);

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Confirm modal state
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        title: string;
        message: string;
        type?: 'confirm' | 'warning' | 'error' | 'info';
        onConfirm: () => void;
    }>({
        open: false,
        title: '',
        message: '',
        type: 'warning',
        onConfirm: () => { },
    });

    useEffect(() => {
        checkLoginStatus();
    }, []);

    // 🔒 Poll session validity every 30 seconds to detect login from another device
    useEffect(() => {
        if (!isLoggedIn) return;

        const interval = setInterval(async () => {
            try {
                const result = await CloudHandler.CheckSessionValidity();
                if (!result.valid) {
                    // Session invalidated by another device
                    setMessage({ type: 'error', text: result.message });
                    setIsLoggedIn(false);
                    setCurrentUser(null);
                    setBackups([]);
                }
            } catch (error) {
                console.error('Session check failed:', error);
            }
        }, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, [isLoggedIn]);

    const checkLoginStatus = async () => {
        try {
            const loggedIn = await CloudHandler.IsLoggedIn();
            setIsLoggedIn(loggedIn);
            if (loggedIn) {
                const user = await CloudHandler.GetCurrentUser();
                setCurrentUser(user as UserSession);
                loadBackups();
            }
        } catch (error) {
            console.error('Check login failed:', error);
        }
    };

    const loadBackups = async () => {
        try {
            const list = await CloudHandler.ListCloudBackupsForUser();
            setBackups((list || []) as CloudBackup[]);
            // Load auto-sync setting
            const config = await window.go.main.App.GetBackupConfig();
            setAutoSync(config.cloudAutoSync);
        } catch (error) {
            console.error('Load backups failed:', error);
        }
    };

    const handleAutoSyncToggle = async () => {
        try {
            const newValue = !autoSync;
            await window.go.main.App.SetCloudAutoSync(newValue);
            setAutoSync(newValue);
            // Optionally show feedback
            setMessage({ type: 'success', text: newValue ? 'تم تفعيل النسخ السحابي التلقائي' : 'تم إيقاف النسخ السحابي التلقائي' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Failed to toggle auto sync:', error);
            setMessage({ type: 'error', text: 'فشل تغيير الإعدادات' });
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setMessage(null);

        try {
            let result: SupabaseAuthResult;
            if (isRegisterMode) {
                result = await CloudHandler.Register(email, password, storeName) as SupabaseAuthResult;
            } else {
                result = await CloudHandler.Login(email, password) as SupabaseAuthResult;
            }

            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                setIsLoggedIn(true);
                setCurrentUser(result.user as UserSession);
                loadBackups();
                // Clear form
                setEmail('');
                setPassword('');
                setStoreName('');
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'حدث خطأ';
            setMessage({ type: 'error', text: msg });
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await CloudHandler.Logout();
            setIsLoggedIn(false);
            setCurrentUser(null);
            setBackups([]);
            setMessage({ type: 'success', text: 'تم تسجيل الخروج' });
            // Redirect to login (reload app to trigger auth check)
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const handleBackup = async () => {
        setBackupLoading(true);
        setMessage(null);
        try {
            await CloudHandler.CloudBackupNow();
            setMessage({ type: 'success', text: 'تم النسخ الاحتياطي بنجاح! ✅' });
            loadBackups();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            setMessage({ type: 'error', text: 'فشل النسخ: ' + msg });
        } finally {
            setBackupLoading(false);
        }
    };

    const confirmRestore = (backupId: string) => {
        setConfirmModal({
            open: true,
            title: 'استعادة النسخة الاحتياطية',
            message: 'هل أنت متأكد من استعادة هذه النسخة؟ سيتم استبدال جميع البيانات الحالية.',
            type: 'warning',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, open: false }));
                setRestoreLoading(backupId);
                try {
                    await CloudHandler.RestoreCloudBackup(backupId);
                    setMessage({ type: 'success', text: 'تم استعادة النسخة الاحتياطية! جاري إعادة التشغيل...' });
                    // Force full page reload to refresh all data from restored database
                    setTimeout(() => window.location.reload(), 1500);
                } catch (error: unknown) {
                    const msg = error instanceof Error ? error.message : String(error);
                    setMessage({ type: 'error', text: 'فشل الاستعادة: ' + msg });
                } finally {
                    setRestoreLoading(null);
                }
            },
        });
    };

    const confirmDelete = (backupId: string) => {
        setConfirmModal({
            open: true,
            title: 'حذف النسخة الاحتياطية',
            message: 'هل أنت متأكد من حذف هذه النسخة الاحتياطية؟ لا يمكن التراجع عن هذا الإجراء.',
            type: 'error',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, open: false }));
                try {
                    await CloudHandler.DeleteCloudBackup(backupId);
                    setMessage({ type: 'success', text: 'تم حذف النسخة الاحتياطية' });
                    loadBackups();
                } catch (error: unknown) {
                    const msg = error instanceof Error ? error.message : String(error);
                    setMessage({ type: 'error', text: 'فشل الحذف: ' + msg });
                }
            },
        });
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('ar-IQ', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-500 pb-10">
            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmModal.open}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, open: false }))}
            />

            {/* Hero Header - Ultra Compact */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-3 text-text-main shadow-sm">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                    <Cloud size={50} className="text-primary" />
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 dark:bg-white/5 rounded-lg border border-primary/20 dark:border-white/10 text-primary">
                        <Cloud size={18} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold tracking-tight">إعدادات الحساب</h2>
                        <p className="text-text-muted text-[10px] opacity-90">إدارة حسابك السحابي والنسخ الاحتياطي</p>
                    </div>
                </div>
            </div>

            {/* Status Message */}
            {message && (
                <div className={`p-3 rounded-xl flex items-center gap-3 animate-in fade-in shadow-sm ${message.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                    : 'bg-red-500/10 text-red-600 border border-red-500/30'
                    }`}>
                    {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                    <span className="text-sm font-medium">{message.text}</span>
                </div>
            )}

            {/* Not Logged In State */}
            {!isLoggedIn && (
                <div className="bg-surface/50 border border-border rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-border bg-amber-500/5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 bg-amber-500/10 rounded-xl">
                                <AlertCircle size={20} className="text-amber-500" />
                            </div>
                            <h3 className="font-bold text-text-main">تسجيل الدخول مطلوب</h3>
                        </div>
                        <p className="text-sm text-text-muted leading-relaxed">
                            يجب تسجيل الدخول بحسابك المرخص لاستخدام النسخ الاحتياطي السحابي.
                            يتم استخدام نفس الحساب المستخدم لتفعيل الترخيص.
                        </p>
                    </div>
                    <div className="p-4 bg-primary/5">
                        <div className="flex items-start gap-2.5 text-sm text-primary">
                            <Info size={16} className="mt-0.5 shrink-0" />
                            <p>
                                <strong>ملاحظة:</strong> إذا كنت قد سجلت الدخول سابقاً ولكن الجلسة انتهت،
                                يرجى إعادة تشغيل التطبيق وتسجيل الدخول مرة أخرى من الشاشة الرئيسية.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Logged In - User Panel */}
            {isLoggedIn && currentUser && (
                <>
                    {/* User Info Card */}
                    <div className="bg-surface/50 border border-border rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-primary to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                                    <User size={22} className="text-black" />
                                </div>
                                <div>
                                    <p className="font-bold text-text-main">{currentUser.store_name || 'متجري'}</p>
                                    <p className="text-xs text-text-muted">{currentUser.email}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                        <span className="text-[10px] text-emerald-600 font-medium">متصل</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-xl transition-colors flex items-center gap-1.5 font-medium"
                            >
                                <LogOut size={16} />
                                خروج
                            </button>
                        </div>
                    </div>

                    {/* Quick Actions Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Auto Sync Toggle */}
                        <div className={`p-4 rounded-2xl border transition-all cursor-pointer ${autoSync
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-surface/50 border-border hover:border-primary/20'
                            }`}
                            onClick={handleAutoSyncToggle}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={`p-2 rounded-lg ${autoSync ? 'bg-primary text-black' : 'bg-surface-active text-text-muted'}`}>
                                    <RefreshCw size={18} className={autoSync ? 'animate-spin-slow' : ''} />
                                </div>
                                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${autoSync ? 'bg-primary' : 'bg-surface-active'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${autoSync ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </div>
                            <h4 className="font-bold text-sm text-text-main mb-0.5">النسخ التلقائي</h4>
                            <p className="text-[10px] text-text-muted">رفع نسخة للسحابة تلقائياً</p>
                        </div>

                        {/* Backup Now Button */}
                        <button
                            onClick={handleBackup}
                            disabled={backupLoading}
                            className="p-4 rounded-2xl bg-gradient-to-r from-primary to-emerald-400 text-black shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] transition-all disabled:opacity-70 disabled:cursor-not-allowed text-right font-bold"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    {backupLoading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Cloud size={18} />
                                    )}
                                </div>
                            </div>
                            <h4 className="font-bold text-sm mb-0.5">نسخ احتياطي الآن</h4>
                            <p className="text-[10px] opacity-80">رفع البيانات للسحابة</p>
                        </button>
                    </div>

                    {/* Backups List */}
                    <div className="bg-surface/50 border border-border rounded-2xl overflow-hidden">
                        <div className="p-3 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Database size={16} className="text-primary" />
                                <span className="font-bold text-sm">النسخ الاحتياطية</span>
                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                    {backups.length} نسخة
                                </span>
                            </div>
                            <button
                                onClick={loadBackups}
                                className="p-1.5 hover:bg-surface-active rounded-lg transition-colors"
                                title="تحديث القائمة"
                            >
                                <RefreshCw size={14} className="text-text-muted" />
                            </button>
                        </div>
                        <div className="max-h-52 overflow-y-auto custom-scrollbar">
                            {backups.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Cloud size={32} className="mx-auto mb-2 text-text-muted opacity-50" />
                                    <p className="text-sm text-text-muted">لا توجد نسخ احتياطية بعد</p>
                                    <p className="text-[10px] text-text-muted opacity-70">اضغط "نسخ احتياطي الآن" لإنشاء أول نسخة</p>
                                </div>
                            ) : (
                                backups.map((backup, idx) => (
                                    <div
                                        key={backup.id}
                                        className={`p-3 flex items-center justify-between gap-3 hover:bg-surface-active/50 transition-colors ${idx !== backups.length - 1 ? 'border-b border-border' : ''
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                                <Database size={18} className="text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm text-text-main">{backup.store_name}</p>
                                                <p className="text-[10px] text-text-muted">{formatDate(backup.created_at)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] bg-surface-active text-text-muted px-2 py-1 rounded-full font-medium">
                                                {formatSize(backup.size_bytes)}
                                            </span>
                                            <button
                                                onClick={() => confirmRestore(backup.id)}
                                                disabled={restoreLoading === backup.id}
                                                className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                                                title="استعادة"
                                            >
                                                {restoreLoading === backup.id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Download size={14} />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => confirmDelete(backup.id)}
                                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="حذف"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}

            <div className="bg-surface/30 border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Info size={16} className="text-primary" />
                    <span className="font-bold text-sm text-text-main">معلومات مهمة</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface/50 rounded-xl p-3 border border-border">
                        <p className="text-[10px] text-text-muted mb-1">الحد الأقصى</p>
                        <p className="text-sm font-bold text-text-main">3 نسخ / 5MB</p>
                    </div>
                    <div className="bg-surface/50 rounded-xl p-3 border border-border">
                        <p className="text-[10px] text-text-muted mb-1">مدة الاحتفاظ</p>
                        <p className="text-sm font-bold text-text-main">30 يوم</p>
                    </div>
                    <div className="bg-surface/50 rounded-xl p-3 border border-border">
                        <p className="text-[10px] text-text-muted mb-1">الجلسات</p>
                        <p className="text-sm font-bold text-text-main">جهاز واحد</p>
                    </div>
                    <div className="bg-surface/50 rounded-xl p-3 border border-border">
                        <p className="text-[10px] text-text-muted mb-1">الاستعادة</p>
                        <p className="text-sm font-bold text-text-main">من أي جهاز</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

