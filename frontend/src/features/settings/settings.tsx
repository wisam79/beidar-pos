import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Store, CreditCard, ShieldCheck, Palette, Monitor, Wifi, Sparkles, Cloud, Settings, Package, Smartphone, RefreshCw } from 'lucide-react';
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
    
    // Sub-tab navigation states for clean focused views
    const [storeSubTab, setStoreSubTab] = useState<'info' | 'sales' | 'inventory'>('info');
    const [systemSubTab, setSystemSubTab] = useState<'appearance' | 'security'>('appearance');
    const [networkSubTab, setNetworkSubTab] = useState<'lan' | 'scanner'>('lan');
    const [cloudSubTab, setCloudSubTab] = useState<'backup' | 'ai'>('backup');
    const [aboutSubTab, setAboutSubTab] = useState<'updates' | 'info'>('updates');

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
                    notify('تم رفع الشعار بنجاح', 'success');
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
            notify('تم حفظ جميع الإعدادات بنجاح', 'success');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
            notify(`فشل حفظ الإعدادات: ${msg}`, 'error');
        }
    };

    const handleExport = async () => {
        try {
            notify('جاري تصدير نسخة احتياطية...', 'info');
            const success = await api.ExportDatabaseBackupNative();
            if (success) {
                notify('تم تصدير النسخة الاحتياطية بنجاح', 'success');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'خطأ في النظام';
            notify(`فشل تصدير النسخة الاحتياطية: ${msg}`, 'error');
        }
    };

    const handleRestoreTrigger = async () => {
        openConfirm({
            title: 'تأكيد استعادة النسخة الاحتياطية',
            message: 'سيتم استبدال قاعدة البيانات الحالية بالكامل وإعادة تشغيل التطبيق. هل أنت متأكد من الاستمرار؟',
            type: 'error',
            onConfirm: async () => {
                closeConfirm();
                try {
                    const success = await api.ImportDatabaseBackupNative();
                    if (success) {
                        notify('تمت الاستعادة بنجاح! جاري إعادة تشغيل التطبيق...', 'success');
                    }
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'خطأ في النقل';
                    notify(`فشل استعادة النسخة الاحتياطية: ${msg}`, 'error');
                }
            }
        });
    };

    const handlePinSuccess = () => {
        setShowPinModal(false);
        if (pinAction === 'reset_db') {
            openConfirm({
                title: 'تحذير نهائي وحرج جداً',
                message: 'هذا الإجراء سيقوم بحذف كافة الفواتير، المبيعات، المنتجات والعملاء بشكل دائم ولا يمكن التراجع عنه مطلقاً! هل ترغب بالاستمرار؟',
                type: 'error',
                onConfirm: async () => {
                    closeConfirm();
                    try {
                        notify('جاري تصفير وإعادة تعيين قاعدة البيانات...', 'info');
                        await api.db.reset();
                        notify('تم تصفير النظام وإعادة تعيينه بنجاح! أعد تشغيل التطبيق.', 'success');
                    } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
                        notify(`فشل تصفير قاعدة البيانات: ${msg}`, 'error');
                    }
                }
            });
        }
        setPinAction(null);
    };

    // Helper to safely reset database by prompting PIN
    const onResetDatabase = () => {
        setPinAction('reset_db');
        setShowPinModal(true);
    };

    const menuGroups = [
        {
            title: 'التشغيل والعمليات',
            items: [
                { id: 'store', label: 'المتجر', icon: Store },
            ]
        },
        {
            title: 'التخصيص والأمان',
            items: [
                { id: 'system', label: 'النظام', icon: ShieldCheck },
                { id: 'network', label: 'الشبكة', icon: Wifi },
            ]
        },
        {
            title: 'الخدمات والمعلومات',
            items: [
                { id: 'cloud', label: 'السحابة', icon: Cloud },
                { id: 'about', label: 'حول', icon: Monitor },
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
                {/* Sidebar - Concise Short Names */}
                <div className="w-56 shrink-0 flex flex-col h-full bg-surface border border-border/80 rounded-2xl p-3 shadow-2xs">

                    {/* Sidebar Header */}
                    <div className="mb-3 pb-3 border-b border-border/60">
                        <h1 className="text-base font-black text-text-main flex items-center gap-2">
                            <Settings size={18} className="text-primary shrink-0" /> الإعدادات
                        </h1>
                        <p className="text-[10px] text-text-muted mt-0.5 font-bold">تخصيص الخيارات والنظام</p>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className={`w-full mb-3.5 min-h-[46px] px-4 py-2.5 rounded-xl font-black flex items-center justify-center gap-2 transition-all duration-150 text-xs cursor-pointer active:scale-[0.98] ${hasChanges
                            ? 'bg-success text-white border border-success hover:brightness-110 shadow-md shadow-success/20'
                            : 'bg-surface-hover/70 text-text-muted border border-border/60 cursor-not-allowed opacity-70'
                            }`}
                    >
                        <Save size={16} className={hasChanges ? 'animate-pulse' : ''} />
                        {hasChanges ? 'حفظ التغييرات' : 'محفوظ ✓'}
                    </button>

                    {/* Navigation Items Grouped */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                        {menuGroups.map((group, idx) => (
                            <div key={idx} className="space-y-1">
                                <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest px-2 mb-1.5 flex items-center gap-1.5 opacity-80">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
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
                        <div className="bg-surface-hover/70 border border-warning/30 rounded-xl p-2.5 flex items-center gap-2.5">
                            <div className="w-7 h-7 bg-warning/15 border border-warning/30 text-warning rounded-lg flex items-center justify-center font-black shrink-0">
                                <Sparkles size={15} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h5 className="font-black text-warning text-xs truncate">النسخة الاحترافية</h5>
                                <p className="text-[9px] text-text-muted font-mono font-bold">Pro Edition 2.0.8</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Pane - Focused Segmented Views */}
                <div className="flex-1 bg-surface border border-border/80 rounded-2xl overflow-hidden relative shadow-2xs flex flex-col">
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-5 space-y-5">

                        {/* TAB 1: STORE */}
                        {activeTab === 'store' && (
                            <div className="space-y-5">
                                {/* Segmented Sub-Tab Switcher */}
                                <div className="flex items-center gap-1.5 p-1.5 bg-bg/80 dark:bg-black/30 border border-border/70 rounded-2xl w-fit shadow-3xs">
                                    <button
                                        onClick={() => setStoreSubTab('info')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            storeSubTab === 'info'
                                                ? 'bg-surface text-primary border border-border/80 shadow-2xs'
                                                : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        <Store size={14} className="shrink-0" />
                                        <span>بيانات المتجر</span>
                                    </button>
                                    <button
                                        onClick={() => setStoreSubTab('sales')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            storeSubTab === 'sales'
                                                ? 'bg-surface text-primary border border-border/80 shadow-2xs'
                                                : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        <CreditCard size={14} className="shrink-0" />
                                        <span>المبيعات والطباعة</span>
                                    </button>
                                    <button
                                        onClick={() => setStoreSubTab('inventory')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            storeSubTab === 'inventory'
                                                ? 'bg-surface text-primary border border-border/80 shadow-2xs'
                                                : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        <Package size={14} className="shrink-0" />
                                        <span>سياسات المخزون</span>
                                    </button>
                                </div>

                                {/* Focused Panel View */}
                                {storeSubTab === 'info' && (
                                    <StoreSettings
                                        prefs={localPrefs}
                                        handleChange={handleChange}
                                        errors={errors}
                                        logoInputRef={logoInputRef}
                                        handleLogoUpload={handleLogoUpload}
                                    />
                                )}
                                {storeSubTab === 'sales' && (
                                    <SalesSettings
                                        prefs={localPrefs}
                                        handleChange={handleChange}
                                        errors={errors}
                                        setShowDiscountManager={setShowDiscountManager}
                                    />
                                )}
                                {storeSubTab === 'inventory' && (
                                    <InventorySettings
                                        prefs={localPrefs}
                                        handleChange={handleChange}
                                        errors={errors}
                                    />
                                )}
                            </div>
                        )}

                        {/* TAB 2: SYSTEM */}
                        {activeTab === 'system' && (
                            <div className="space-y-5">
                                {/* Segmented Sub-Tab Switcher */}
                                <div className="flex items-center gap-1.5 p-1.5 bg-bg/80 dark:bg-black/30 border border-border/70 rounded-2xl w-fit shadow-3xs">
                                    <button
                                        onClick={() => setSystemSubTab('appearance')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            systemSubTab === 'appearance'
                                                ? 'bg-surface text-primary border border-border/80 shadow-2xs'
                                                : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        <Palette size={14} className="shrink-0" />
                                        <span>المظهر والخطوط</span>
                                    </button>
                                    <button
                                        onClick={() => setSystemSubTab('security')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            systemSubTab === 'security'
                                                ? 'bg-surface text-primary border border-border/80 shadow-2xs'
                                                : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        <ShieldCheck size={14} className="shrink-0" />
                                        <span>الأمان والموظفين</span>
                                    </button>
                                </div>

                                {systemSubTab === 'appearance' && (
                                    <AppearanceSettings
                                        prefs={localPrefs}
                                        handleChange={handleChange}
                                    />
                                )}
                                {systemSubTab === 'security' && (
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
                            </div>
                        )}

                        {/* TAB 3: NETWORK */}
                        {activeTab === 'network' && (
                            <div className="space-y-5">
                                {/* Segmented Sub-Tab Switcher */}
                                <div className="flex items-center gap-1.5 p-1.5 bg-bg/80 dark:bg-black/30 border border-border/70 rounded-2xl w-fit shadow-3xs">
                                    <button
                                        onClick={() => setNetworkSubTab('lan')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            networkSubTab === 'lan'
                                                ? 'bg-surface text-primary border border-border/80 shadow-2xs'
                                                : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        <Wifi size={14} className="shrink-0" />
                                        <span>مزامنة LAN</span>
                                    </button>
                                    <button
                                        onClick={() => setNetworkSubTab('scanner')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            networkSubTab === 'scanner'
                                                ? 'bg-surface text-primary border border-border/80 shadow-2xs'
                                                : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        <Smartphone size={14} className="shrink-0" />
                                        <span>الماسح الضوئي (QR)</span>
                                    </button>
                                </div>

                                {networkSubTab === 'lan' && <LanSyncPanel notify={notify} />}
                                {networkSubTab === 'scanner' && <MobileScannerSettings notify={notify} />}
                            </div>
                        )}

                        {/* TAB 4: CLOUD */}
                        {activeTab === 'cloud' && (
                            <div className="space-y-5">
                                {/* Segmented Sub-Tab Switcher */}
                                <div className="flex items-center gap-1.5 p-1.5 bg-bg/80 dark:bg-black/30 border border-border/70 rounded-2xl w-fit shadow-3xs">
                                    <button
                                        onClick={() => setCloudSubTab('backup')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            cloudSubTab === 'backup'
                                                ? 'bg-surface text-primary border border-border/80 shadow-2xs'
                                                : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        <Cloud size={14} className="shrink-0" />
                                        <span>النسخ السحابي والحساب</span>
                                    </button>
                                    <button
                                        onClick={() => setCloudSubTab('ai')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            cloudSubTab === 'ai'
                                                ? 'bg-surface text-primary border border-border/80 shadow-2xs'
                                                : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        <Sparkles size={14} className="shrink-0" />
                                        <span>الذكاء الاصطناعي (AI)</span>
                                    </button>
                                </div>

                                {cloudSubTab === 'backup' && <CloudBackupSettings />}
                                {cloudSubTab === 'ai' && (
                                    <AISettings
                                        prefs={localPrefs}
                                        handleChange={handleChange}
                                    />
                                )}
                            </div>
                        )}

                        {/* TAB 5: ABOUT */}
                        {activeTab === 'about' && (
                            <div className="space-y-5">
                                {/* Segmented Sub-Tab Switcher */}
                                <div className="flex items-center gap-1.5 p-1.5 bg-bg/80 dark:bg-black/30 border border-border/70 rounded-2xl w-fit shadow-3xs">
                                    <button
                                        onClick={() => setAboutSubTab('updates')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            aboutSubTab === 'updates'
                                                ? 'bg-surface text-primary border border-border/80 shadow-2xs'
                                                : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        <RefreshCw size={14} className="shrink-0" />
                                        <span>تحديثات النظام</span>
                                    </button>
                                    <button
                                        onClick={() => setAboutSubTab('info')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            aboutSubTab === 'info'
                                                ? 'bg-surface text-primary border border-border/80 shadow-2xs'
                                                : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        ℹ️ عن المنظومة والترخيص
                                    </button>
                                </div>

                                {aboutSubTab === 'updates' && <DesktopSettingsPanel notify={notify} />}
                                {aboutSubTab === 'info' && <AboutSettings />}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageShell>
    );
};