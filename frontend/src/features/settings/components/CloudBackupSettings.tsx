import { useState, useEffect, useCallback } from 'react';
import { Cloud, Check, AlertCircle, Loader2, Info, Database, RefreshCw, User, LogOut, Download, Trash2 } from 'lucide-react';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { useConfirmModal } from '../../../hooks';
import * as CloudHandler from '../../../../wailsjs/go/handlers/CloudHandler';
import { logger } from '../../../core/logger';

// Types
interface UserSession {
    user_id: string;
    email: string;
    store_name: string;
    access_token: string;
    expires_at: number;
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

    // Loading states
    const [backupLoading, setBackupLoading] = useState(false);
    const [restoreLoading, setRestoreLoading] = useState<string | null>(null);

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const { confirmState, openConfirm, closeConfirm } = useConfirmModal();

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
                logger.error('Session check failed', error, 'CloudBackup');
            }
        }, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, [isLoggedIn]);

    const loadBackups = useCallback(async () => {
        try {
            const list = await CloudHandler.ListCloudBackupsForUser();
            setBackups((list || []) as CloudBackup[]);
            const config = await window.go.handlers.SettingsHandler.GetBackupConfig();
            setAutoSync(config.cloudAutoSync);
        } catch (error) {
            logger.error('Load backups failed', error, 'CloudBackup');
        }
    }, []);

    const checkLoginStatus = useCallback(async () => {
        try {
            const loggedIn = await CloudHandler.IsLoggedIn();
            setIsLoggedIn(loggedIn);
            if (loggedIn) {
                const user = await CloudHandler.GetCurrentUser();
                setCurrentUser(user as UserSession);
                loadBackups();
            }
        } catch (error) {
            logger.error('Check login failed', error, 'CloudBackup');
        }
    }, [loadBackups]);

    useEffect(() => {
        void checkLoginStatus();
    }, [checkLoginStatus]);

    const handleAutoSyncToggle = async () => {
        try {
            const newValue = !autoSync;
            await window.go.handlers.SettingsHandler.SetCloudAutoSync(newValue);
            setAutoSync(newValue);
            // Optionally show feedback
            setMessage({ type: 'success', text: newValue ? 'تم تفعيل النسخ السحابي التلقائي' : 'تم إيقاف النسخ السحابي التلقائي' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            logger.error('Failed to toggle auto sync', error, 'CloudBackup');
            setMessage({ type: 'error', text: 'فشل تغيير الإعدادات' });
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
            logger.error('Logout failed', error, 'CloudBackup');
        }
    };

    const handleBackup = async () => {
        setBackupLoading(true);
        setMessage(null);
        try {
            await CloudHandler.CloudBackupNow();
            setMessage({ type: 'success', text: 'تم النسخ الاحتياطي السحابي بنجاح! ✅' });
            loadBackups();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            setMessage({ type: 'error', text: 'فشل النسخ: ' + msg });
        } finally {
            setBackupLoading(false);
        }
    };

    const confirmRestore = (backupId: string) => {
        openConfirm({
            title: 'استعادة النسخة الاحتياطية',
            message: 'هل أنت متأكد من استعادة هذه النسخة؟ سيتم استبدال جميع البيانات الحالية.',
            type: 'warning',
            onConfirm: async () => {
                closeConfirm();
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
        openConfirm({
            title: 'تأكيد الحذف',
            message: `هل أنت متأكد أنك تريد حذف هذه النسخة الاحتياطية نهائياً؟`,
            type: 'error',
            onConfirm: async () => {
                closeConfirm();
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
        <div className="space-y-5 animate-in fade-in duration-300 pb-8 select-none">
            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmState.open}
                title={confirmState.title}
                message={confirmState.message}
                type={confirmState.type}
                onConfirm={confirmState.onConfirm}
                onCancel={closeConfirm}
            />

            {/* Header Banner */}
            <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-success/10 text-success border border-success/20">
                        <Cloud size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-text-main">الحساب والنسخ الاحتياطي السحابي</h2>
                        <p className="text-text-muted text-xs font-semibold">إدارة حساب الترخيص والنسخ السحابي الآمن</p>
                    </div>
                </div>
            </div>

            {/* Status Message */}
            {message && (
                <div className={`p-3.5 rounded-xl flex items-center gap-2.5 ${message.type === 'success'
                    ? 'bg-success/10 text-success border border-success/30'
                    : 'bg-danger/10 text-danger border border-danger/30'
                    }`}>
                    {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                    <span className="text-xs font-black">{message.text}</span>
                </div>
            )}

            {/* Not Logged In State */}
            {!isLoggedIn && (
                <div className="bg-surface border border-border/80 rounded-2xl overflow-hidden p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-warning/10 border border-warning/20 rounded-xl text-warning">
                            <AlertCircle size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-text-main text-sm">تسجيل الدخول غير متاح</h3>
                            <p className="text-xs text-text-muted font-medium mt-0.5">يلزم توفر ترخيص فعال لتنشيط هذه اللوحة</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Logged In - User Panel */}
            {isLoggedIn && currentUser && (
                <>
                    {/* User Info Card */}
                    <div className="bg-surface border border-border/80 rounded-2xl p-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3.5">
                                <div className="w-11 h-11 bg-success/10 border border-success/20 rounded-xl flex items-center justify-center text-success">
                                    <User size={22} />
                                </div>
                                <div>
                                    <p className="font-black text-text-main text-sm">{currentUser.store_name || 'متجري'}</p>
                                    <p className="text-xs font-mono font-semibold text-text-muted">{currentUser.email}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                                        <span className="text-[10px] text-success font-bold">الحساب نشط (Licensed)</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="px-3.5 py-2 text-xs text-danger hover:text-danger bg-danger/10 border border-danger/20 rounded-xl transition-colors flex items-center gap-1.5 font-black cursor-pointer"
                            >
                                <LogOut size={14} />
                                تسجيل الخروج
                            </button>
                        </div>
                    </div>

                    {/* Quick Actions Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Auto Sync Toggle */}
                        <div className={`p-4 rounded-2xl border transition-colors cursor-pointer ${autoSync
                            ? 'bg-success/10 border-success/30'
                            : 'bg-surface border-border/80 hover:border-success/30'
                            }`}
                            onClick={handleAutoSyncToggle}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className={`p-2 rounded-xl border ${autoSync ? 'bg-success text-primary-fg border-success' : 'bg-surface-hover text-text-muted border-border/60'}`}>
                                    <RefreshCw size={18} className={autoSync ? 'animate-spin' : ''} />
                                </div>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${autoSync ? 'bg-success/20 text-success border-success/30' : 'bg-surface-hover text-text-muted border-border/60'}`}>
                                    {autoSync ? 'مفعل' : 'معطل'}
                                </span>
                            </div>
                            <h4 className="font-black text-xs text-text-main mb-0.5">النسخ السحابي التلقائي</h4>
                            <p className="text-[11px] text-text-muted font-medium">رفع نسخة مشفرة تلقائياً كل 24 ساعة</p>
                        </div>

                        {/* Backup Now Button */}
                        <button
                            onClick={handleBackup}
                            disabled={backupLoading}
                            className="p-4 rounded-2xl bg-success text-primary-fg border border-success hover:bg-success transition-transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed text-right font-black cursor-pointer min-h-[80px]"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 bg-black/10 rounded-xl">
                                    {backupLoading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Cloud size={18} />
                                    )}
                                </div>
                            </div>
                            <h4 className="font-black text-xs mb-0.5">رفع نسخة سحابية فورية</h4>
                            <p className="text-[10px] opacity-80 font-bold">إنشاء وحفظ نسخة جديدة بالسحابة</p>
                        </button>
                    </div>

                    {/* Backups List */}
                    <div className="bg-surface border border-border/80 rounded-2xl overflow-hidden">
                        <div className="p-3.5 border-b border-border/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Database size={16} className="text-success" />
                                <span className="font-black text-xs text-text-main">سجل النسخ المحفوظة بالسحابة</span>
                                <span className="text-[10px] bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-lg font-bold">
                                    {backups.length} نسخة
                                </span>
                            </div>
                            <button
                                onClick={loadBackups}
                                className="p-1.5 hover:bg-surface-hover rounded-xl border border-border/60 transition-colors cursor-pointer"
                                title="تحديث القائمة"
                            >
                                <RefreshCw size={14} className="text-text-muted" />
                            </button>
                        </div>
                        <div className="max-h-52 overflow-y-auto custom-scrollbar">
                            {backups.length === 0 ? (
                                <div className="p-6 text-center">
                                    <Cloud size={28} className="mx-auto mb-2 text-text-muted opacity-50" />
                                    <p className="text-xs font-bold text-text-muted">لا توجد نسخ احتياطية سحابية بعد</p>
                                    <p className="text-[10px] text-text-muted opacity-70">اضغط "رفع نسخة سحابية فورية" للتخزين بالسحابة</p>
                                </div>
                            ) : (
                                backups.map((backup, idx) => (
                                    <div
                                        key={backup.id}
                                        className={`p-3.5 flex items-center justify-between gap-3 hover:bg-surface-hover/60 transition-colors ${idx !== backups.length - 1 ? 'border-b border-border/40' : ''
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-success/10 border border-success/20 rounded-xl flex items-center justify-center text-success">
                                                <Database size={16} />
                                            </div>
                                            <div>
                                                <p className="font-black text-xs text-text-main">{backup.store_name}</p>
                                                <p className="text-[10px] text-text-muted font-mono">{formatDate(backup.created_at)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] bg-surface-hover border border-border/60 text-text-muted px-2 py-0.5 rounded-lg font-mono font-bold">
                                                {formatSize(backup.size_bytes)}
                                            </span>
                                            <button
                                                onClick={() => confirmRestore(backup.id)}
                                                disabled={restoreLoading === backup.id}
                                                className="p-2 bg-success/10 text-success border border-success/20 rounded-xl hover:bg-success/20 transition-colors disabled:opacity-50 cursor-pointer"
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
                                                className="p-2 text-danger hover:bg-danger/10 border border-danger/20 rounded-xl transition-colors cursor-pointer"
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

            <div className="bg-surface border border-border/80 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Info size={16} className="text-success" />
                    <span className="font-black text-xs text-text-main">مواصفات التخزين السحابي</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-surface-hover/60 rounded-xl p-2.5 border border-border/60 text-center">
                        <p className="text-[10px] text-text-muted font-bold">الحد الأقصى</p>
                        <p className="text-xs font-black text-text-main">3 نسخ / 5MB</p>
                    </div>
                    <div className="bg-surface-hover/60 rounded-xl p-2.5 border border-border/60 text-center">
                        <p className="text-[10px] text-text-muted font-bold">مدة الاحتفاظ</p>
                        <p className="text-xs font-black text-text-main">30 يوم</p>
                    </div>
                    <div className="bg-surface-hover/60 rounded-xl p-2.5 border border-border/60 text-center">
                        <p className="text-[10px] text-text-muted font-bold">الجلسات النشطة</p>
                        <p className="text-xs font-black text-text-main">جهاز واحد</p>
                    </div>
                    <div className="bg-surface-hover/60 rounded-xl p-2.5 border border-border/60 text-center">
                        <p className="text-[10px] text-text-muted font-bold">استعادة البيانات</p>
                        <p className="text-xs font-black text-text-main">أي كمبيوتر</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

