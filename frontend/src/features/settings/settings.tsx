
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Store, Database, CreditCard, ShieldCheck, Palette, Monitor, Wifi, Terminal, Sparkles, Cloud } from 'lucide-react';
import { PinModal } from '../../components/PinModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useConfirmModal } from '../../hooks';
import { DiscountManager } from './components/DiscountManager';
import { StaffManager } from '../../components/StaffManager';
import { LanSyncPanel } from '../../components/LanSyncPanel';
import { DesktopSettingsPanel } from './components/DesktopSettingsPanel';
import { api } from '../../core/api';
import { AppPreferences } from '../../core/types';
import { compressImage, sanitizePrefsForStorage } from '../../core/utils';
import { validateSettings } from '../../core/schemas/settings.schema';
import { PageShell } from '../../components/blocks';
import { usePreferences } from '../../components/PreferencesContext';

// Import extracted setting components
import {
    SidebarItem,
    StoreSettings,
    SalesSettings,
    InventorySettings,
    AppearanceSettings,
    AISettings,
    SecuritySettings,
    AboutSettings,
    MobileScannerSettings
} from './components';
import { Smartphone } from 'lucide-react';
import { CloudBackupSettings } from './components/CloudBackupSettings';

// ═══════════════════════════════════════════════════════════════════════════════
// 📄 MAIN SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export const SettingsPage: React.FC = () => {
    const { prefs, setPrefs, notify } = usePreferences();
    const [localPrefs, setLocalPrefs] = useState<AppPreferences>(prefs);
    const [hasChanges, setHasChanges] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinAction, setPinAction] = useState<'reset_db' | null>(null);
    const [activeTab, setActiveTab] = useState('store');
    const [showDiscountManager, setShowDiscountManager] = useState(false);
    const [showStaffManager, setShowStaffManager] = useState(false);
    const { confirmState, openConfirm, closeConfirm } = useConfirmModal();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const base64Raw = ev.target?.result as string;
                    const base64 = await compressImage(base64Raw, 400, 0.8);
                    handleChange('storeLogo', base64);
                    notify('تم رفع الشعار بنجاح ✨', 'success');
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
                    notify(`فشل معالجة الصورة: ${msg}`, 'error');
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleChange = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
        setLocalPrefs(prev => {
            const next = { ...prev, [key]: value };
            setHasChanges(JSON.stringify(next) !== JSON.stringify(prefs));
            return next;
        });
        if (errors[key]) {
            setErrors({ ...errors, [key]: '' });
        }
    };

    const handleSave = async () => {
        // Validate
        const validation = validateSettings(localPrefs);
        if (!validation.success) {
            setErrors(validation.errors || {});
            const firstError = Object.values(validation.errors || {})[0];
            // Show specific validation error
            notify(firstError ? `تنبيه: ${firstError}` : 'يرجى التأكد من صحة الحقول المدخلة', 'error');
            return;
        }

        try {
            await api.prefs.set(localPrefs);
            // Also save to localStorage so AI module can read the API key
            localStorage.setItem('beidar_preferences', JSON.stringify(sanitizePrefsForStorage(localPrefs as unknown as Record<string, unknown>)));
            setPrefs(localPrefs);
            setHasChanges(false);
            setErrors({});
            notify('تم حفظ الإعدادات بنجاح ✨', 'success');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'حدث خطأ غير متوقع';
            notify(`فشل الحفظ: ${msg}`, 'error');
        }
    };

    const handleExport = async () => {
        try {
            const success = await window.go.handlers.BackupHandler.ExportDatabaseBackupNative();
            if (success) {
                // Update last backup date
                const now = new Date().toISOString();
                handleChange('lastBackupDate', now);
                // Verify immediate storage update for the alert to clear
                const updatedPrefs = { ...localPrefs, lastBackupDate: now };
                localStorage.setItem('beidar_preferences', JSON.stringify(sanitizePrefsForStorage(updatedPrefs as unknown as Record<string, unknown>)));
                api.prefs.set(updatedPrefs);

                notify('تم تصدير نسخة احتياطية 📦', 'success');
            } else {
                notify('تم إلغاء التصدير', 'info');
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'خطأ في قاعدة البيانات';
            if (msg === 'cancelled') {
                notify('تم إلغاء التصدير', 'info');
            } else {
                notify(`تعذر التصدير: ${msg}`, 'error');
            }
        }
    };

    const handleRestoreTrigger = async () => {
        openConfirm({
            title: 'استعادة النسخة الاحتياطية',
            message: 'سيتم استبدال جميع البيانات الحالية. هل أنت متأكد؟',
            type: 'warning',
            onConfirm: async () => {
                closeConfirm();
                try {
                    const success = await window.go.handlers.BackupHandler.ImportDatabaseBackupNative();
                    if (success) {
                        notify('تم استعادة البيانات بنجاح! 🎉', 'success');
                        setTimeout(() => window.location.reload(), 1500);
                    } else {
                        notify('تم إلغاء الاستعادة', 'info');
                    }
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'ملف غير صالح';
                    if (msg === 'cancelled') {
                        notify('تم إلغاء الاستعادة', 'info');
                    } else {
                        notify(`فشل الاستعادة: ${msg}`, 'error');
                    }
                }
            }
        });
    };

    const handlePinSuccess = async () => {
        setShowPinModal(false);
        if (pinAction === 'reset_db') {
            try {
                await api.db.reset();
                window.location.reload();
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'خطأ في النظام';
                notify(`فشل إعادة الضبط: ${msg}`, 'error');
            }
        }
    };

    // Helper to safely reset database by prompting PIN
    const onResetDatabase = () => {
        setPinAction('reset_db');
        setShowPinModal(true);
    };

    const menuGroups = [
        {
            title: 'إدارة المتجر',
            items: [
                { id: 'store', label: t('settings.storeInfo'), icon: Store },
                { id: 'sales', label: t('nav.sales'), icon: CreditCard },
                { id: 'inventory', label: t('nav.inventory'), icon: Database },
            ]
        },
        {
            title: 'النظام والخدمات',
            items: [
                { id: 'appearance', label: t('settings.appearance'), icon: Palette },
                { id: 'security', label: t('settings.security'), icon: ShieldCheck },
                { id: 'desktop', label: 'التحديثات', icon: Monitor },
                { id: 'lan', label: t('settings.lan'), icon: Wifi },
                { id: 'mobile-scanner', label: 'الماسح الضوئي', icon: Smartphone },
            ]
        },
        {
            title: 'الذكاء والحساب',
            items: [
                { id: 'cloud', label: 'الحساب', icon: Cloud },
                { id: 'ai', label: t('settings.ai'), icon: Sparkles },
                { id: 'about', label: t('settings.about'), icon: Terminal },
            ]
        }
    ];

    return (
        <PageShell>
            {/* Modals */}
            <PinModal isOpen={showPinModal} onClose={() => setShowPinModal(false)} onSuccess={handlePinSuccess} title='تأكيد العملية' />
            <ConfirmModal isOpen={confirmState.open} title={confirmState.title} message={confirmState.message} type={confirmState.type} onConfirm={confirmState.onConfirm} onCancel={closeConfirm} />
            <DiscountManager isOpen={showDiscountManager} onClose={() => setShowDiscountManager(false)} notify={notify} />
            <StaffManager isOpen={showStaffManager} onClose={() => setShowStaffManager(false)} notify={notify} />

            <div className="flex gap-4 flex-1 min-h-0 select-none">
                {/* Sidebar - Redesigned & Organized */}
                <div className="w-56 xl:w-64 shrink-0 flex flex-col h-full bg-surface border border-border/80 rounded-2xl p-3.5">

                    {/* Sidebar Header */}
                    <div className="mb-3 pb-3 border-b border-border/60">
                        <h1 className="text-lg font-black text-text-main flex items-center gap-2">
                            <span className="text-emerald-400">⚙️</span> الإعدادات
                        </h1>
                        <p className="text-[10px] text-text-muted mt-0.5 font-bold">تخصيص الخيارات والنظام</p>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className={`w-full mb-3.5 min-h-[48px] px-4 py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-all duration-150 text-xs cursor-pointer active:scale-[0.98] ${hasChanges
                            ? 'bg-emerald-500 text-black border border-emerald-400 hover:bg-emerald-400'
                            : 'bg-surface-hover text-text-muted border border-border/60 cursor-not-allowed opacity-60'
                            }`}
                    >
                        <Save size={18} className={hasChanges ? 'animate-pulse' : ''} />
                        {hasChanges ? 'حفظ التغييرات' : 'محفوظ ✓'}
                    </button>

                    {/* Navigation Items Grouped */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3.5">
                        {menuGroups.map((group, idx) => (
                            <div key={idx} className="space-y-1">
                                <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest px-2 mb-1 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                    {group.title}
                                </h3>
                                <div className="space-y-1">
                                    {group.items.map(item => (
                                        <SidebarItem
                                            key={item.id}
                                            {...item}
                                            active={activeTab === item.id}
                                            onClick={() => setActiveTab(item.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pro Badge - Bottom Footer */}
                    <div className="pt-3 mt-auto border-t border-border/60">
                        <div className="bg-surface-hover/70 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-lg flex items-center justify-center font-black">
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <h5 className="font-black text-amber-400 text-xs">النسخة الاحترافية</h5>
                                <p className="text-[9px] text-text-muted font-bold">Pro Edition</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Pane */}
                <div className="flex-1 bg-surface border border-border/80 rounded-2xl overflow-hidden relative">
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-5">

                        {activeTab === 'store' && (
                            <StoreSettings
                                prefs={localPrefs}
                                handleChange={handleChange}
                                errors={errors}
                                logoInputRef={logoInputRef}
                                handleLogoUpload={handleLogoUpload}
                            />
                        )}

                        {activeTab === 'sales' && (
                            <SalesSettings
                                prefs={localPrefs}
                                handleChange={handleChange}
                                errors={errors}
                                setShowDiscountManager={setShowDiscountManager}
                            />
                        )}

                        {activeTab === 'inventory' && (
                            <InventorySettings
                                prefs={localPrefs}
                                handleChange={handleChange}
                                errors={errors}
                            />
                        )}

                        {activeTab === 'appearance' && (
                            <AppearanceSettings
                                prefs={localPrefs}
                                handleChange={handleChange}
                            />
                        )}

                        {activeTab === 'ai' && (
                            <AISettings
                                prefs={localPrefs}
                                handleChange={handleChange}
                            />
                        )}

                        {activeTab === 'lan' && (
                            <LanSyncPanel notify={notify} />
                        )}

                        {activeTab === 'mobile-scanner' && (
                            <MobileScannerSettings notify={notify} />
                        )}

                        {activeTab === 'cloud' && (
                            <CloudBackupSettings />
                        )}

                        {activeTab === 'desktop' && (
                            <DesktopSettingsPanel notify={notify} />
                        )}

                        {activeTab === 'security' && (
                            <SecuritySettings
                                prefs={localPrefs}
                                handleChange={handleChange}
                                errors={errors}
                                openStaffManager={() => setShowStaffManager(true)}
                                onExportBackup={handleExport}
                                onRestoreBackup={handleRestoreTrigger}
                                onResetDatabase={onResetDatabase}
                            />
                        )}

                        {activeTab === 'about' && (
                            <AboutSettings />
                        )}
                    </div>
                </div>
            </div>
        </PageShell>
    );
};