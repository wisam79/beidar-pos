import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Monitor, Power, Printer, RefreshCw, Check, X, Loader2, Download, Zap,
    AlertTriangle, Play, FileText, Trash2
} from 'lucide-react';
import { desktopApi, PrinterInfo, UpdateInfo } from '../../../core/api';

// ═══════════════════════════════════════════════════════════════════════════════
// 🪝 Custom Hook: useDesktopSettings
// ═══════════════════════════════════════════════════════════════════════════════
const useDesktopSettings = (notify: (msg: string, type: 'success' | 'error' | 'info') => void) => {
    // State
    const [autoStart, setAutoStart] = useState({ enabled: false, loading: false });
    const [printers, setPrinters] = useState<{ list: PrinterInfo[], default: string, selected: string, loading: boolean }>({
        list: [], default: '', selected: '', loading: false
    });
    const [update, setUpdate] = useState<{
        currentVersion: string, info: UpdateInfo | null, available: boolean,
        checking: boolean, downloading: boolean, progress: number
    }>({
        currentVersion: '1.0.0', info: null, available: false,
        checking: false, downloading: false, progress: 0
    });
    const [crashReports, setCrashReports] = useState<{ list: string[], loading: boolean }>({ list: [], loading: false });
    const [testingPrinter, setTestingPrinter] = useState(false);

    // Initial Load
    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        // Parallel data fetching
        const [autoStartEnabled, printerData, version, reports] = await Promise.allSettled([
            desktopApi.autostart.isEnabled(),
            Promise.all([desktopApi.printing.getPrinters(), desktopApi.printing.getDefault()]),
            desktopApi.update.getCurrentVersion(),
            desktopApi.crashReports.getAll()
        ]);

        if (autoStartEnabled.status === 'fulfilled') {
            setAutoStart(prev => ({ ...prev, enabled: autoStartEnabled.value }));
        }

        if (printerData.status === 'fulfilled') {
            const [list, def] = printerData.value;
            setPrinters({
                list: list || [],
                default: def || '',
                selected: def || (list && list.length > 0 ? list[0].name : ''),
                loading: false
            });
        }

        if (version.status === 'fulfilled') {
            setUpdate(prev => ({ ...prev, currentVersion: version.value }));
        }

        if (reports.status === 'fulfilled') {
            setCrashReports({ list: reports.value || [], loading: false });
        }
    };

    // Auto-Start Handlers
    const toggleAutoStart = async () => {
        const newState = !autoStart.enabled;
        setAutoStart(prev => ({ ...prev, loading: true }));
        try {
            if (newState) await desktopApi.autostart.enable();
            else await desktopApi.autostart.disable();

            setAutoStart(prev => ({ ...prev, enabled: newState }));
            notify(newState ? 'تم تفعيل التشغيل التلقائي ✅' : 'تم إلغاء التشغيل التلقائي', 'success');
        } catch (e) {
            notify('فشل تغيير إعداد التشغيل التلقائي', 'error');
        } finally {
            setAutoStart(prev => ({ ...prev, loading: false }));
        }
    };

    // Printer Handlers
    const refreshPrinters = async () => {
        setPrinters(prev => ({ ...prev, loading: true }));
        try {
            const [list, def] = await Promise.all([
                desktopApi.printing.getPrinters(),
                desktopApi.printing.getDefault()
            ]);
            setPrinters(prev => ({
                ...prev,
                list: list || [],
                default: def || '',
                loading: false
            }));
            // Update selected if invalid
            if (!list?.find((p: PrinterInfo) => p.name === printers.selected)) {
                setPrinters(prev => ({ ...prev, selected: def || (list && list.length > 0 ? list[0].name : '') }));
            }
        } catch (e) {
            console.error(e);
            setPrinters(prev => ({ ...prev, loading: false }));
        }
    };

    const selectPrinter = (name: string) => setPrinters(prev => ({ ...prev, selected: name }));

    const testPrinter = async () => {
        if (!printers.selected) return notify('اختر طابعة أولاً', 'error');
        setTestingPrinter(true);
        try {
            await desktopApi.printing.test(printers.selected);
            notify('تم إرسال صفحة الاختبار ✅', 'success');
        } catch (e) {
            notify('فشل اختبار الطابعة', 'error');
        } finally {
            setTestingPrinter(false);
        }
    };

    // Update Handlers
    // Update Handlers
    const checkForUpdates = async () => {
        setUpdate(prev => ({ ...prev, checking: true }));
        try {
            const info = await desktopApi.update.checkForUpdates();
            // info is now guaranteed to have the update_available flag from backend
            const hasUpdate = info?.update_available || false;

            setUpdate(prev => ({
                ...prev,
                info: info || undefined,
                available: hasUpdate,
                checking: false
            }));
            if (hasUpdate) notify(`تحديث جديد متوفر: v${info?.version}`, 'info');
            else notify('أنت تستخدم أحدث إصدار ✅', 'success');
        } catch (e: unknown) {
            console.error('[Update Check Error]', e);
            const msg = e instanceof Error ? e.message : String(e);
            notify(`فشل فحص التحديثات: ${msg}`, 'error');
            setUpdate(prev => ({ ...prev, checking: false }));
        }
    };

    const downloadUpdate = async () => {
        if (!update.info?.download_url) return notify('رابط التحديث غير متوفر', 'error');

        setUpdate(prev => ({ ...prev, downloading: true, progress: 0 }));
        notify('جاري تحميل التحديث...', 'info');

        // Start progress polling
        const progressInterval = setInterval(async () => {
            try {
                const status = await desktopApi.update.getStatus();
                if (status?.progress) {
                    setUpdate(prev => ({ ...prev, progress: status.progress }));
                }
            } catch { /* ignore polling errors */ }
        }, 500);

        try {
            const path = await desktopApi.update.downloadUpdate(update.info.download_url);
            clearInterval(progressInterval);
            setUpdate(prev => ({ ...prev, progress: 100 }));

            notify('تم التحميل! جاري التثبيت... (سيُعاد تشغيل التطبيق)', 'info');

            // Small delay to show the message
            await new Promise(resolve => setTimeout(resolve, 1500));

            await desktopApi.update.installUpdate(path);
            // App will close here, so no code after this will run
        } catch (e: unknown) {
            clearInterval(progressInterval);
            console.error('[Update Error]', e);
            const msg = e instanceof Error ? e.message : String(e);
            notify(`فشل التحديث: ${msg}`, 'error');
            setUpdate(prev => ({ ...prev, downloading: false, progress: 0 }));
        }
    };

    // Crash Reports Handlers
    const clearCrashReports = async () => {
        if (!confirm('هل أنت متأكد من حذف جميع تقارير الأخطاء؟')) return;
        try {
            await desktopApi.crashReports.clear();
            setCrashReports({ list: [], loading: false });
            notify('تم حذف التقارير', 'success');
        } catch (e) {
            notify('فشل حذف التقارير', 'error');
        }
    };

    return {
        autoStart,
        toggleAutoStart,
        printers,
        refreshPrinters,
        selectPrinter,
        testPrinter,
        testingPrinter,
        update,
        checkForUpdates,
        downloadUpdate,
        crashReports,
        clearCrashReports
    };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🖥️ UI Components (Memoized)
// ═══════════════════════════════════════════════════════════════════════════════

const AutoStartCard = React.memo(({ enabled, loading, onToggle }: { enabled: boolean, loading: boolean, onToggle: () => void }) => (
    <div className="group bg-surface/50 border border-border hover:border-primary/30 rounded-lg p-6 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-primary/5">
        <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-primary to-emerald-400 text-black rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
                <Power size={24} className="text-black" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-active rounded-full border border-border">
                <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-primary animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xs font-bold text-text-muted">{enabled ? 'مفعل' : 'معطل'}</span>
            </div>
        </div>
        <h3 className="text-xl font-bold text-text-main mb-2">التشغيل التلقائي</h3>
        <p className="text-sm text-text-muted mb-6 leading-relaxed">
            تشغيل تطبيق "بيدر" تلقائياً عند بدء تشغيل Windows.
        </p>
        <button
            onClick={onToggle}
            disabled={loading}
            className={`w-full py-4 rounded-lg font-bold flex items-center justify-center gap-3 transition-all duration-300 ${enabled
                ? 'bg-primary/10 text-primary hover:bg-primary/25 border border-primary/20'
                : 'bg-surface-active text-text-muted hover:bg-surface-hover/80 hover:text-text-main border border-border'
                }`}
        >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Power size={20} />}
            {enabled ? 'تعطيل التشغيل التلقائي' : 'تفعيل التشغيل التلقائي'}
        </button>
    </div>
));

const PrinterCard = React.memo(({
    printer, isSelected, isDefault, onSelect
}: {
    printer: PrinterInfo, isSelected: boolean, isDefault: boolean, onSelect: (name: string) => void
}) => (
    <button
        onClick={() => onSelect(printer.name)}
        className={`relative group p-5 rounded-lg border-2 text-right transition-all duration-300 ${isSelected
            ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10'
            : 'border-border bg-surface hover:border-primary/30'
            }`}
    >
        <div className="flex items-start justify-between mb-3">
            <Printer size={24} className={isSelected ? 'text-primary' : 'text-text-muted'} />
            {isSelected && (
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/40">
                    <Check size={14} className="text-black" />
                </div>
            )}
        </div>
        <h4 className={`font-bold truncate mb-1 ${isSelected ? 'text-primary' : 'text-text-main group-hover:text-primary'}`}>
            {printer.name}
        </h4>
        <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${printer.status === 'Ready' || !printer.status ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-500'
                }`}>
                {printer.status || 'جاهز'}
            </span>
            {isDefault && (
                <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold">الافتراضية</span>
            )}
        </div>
    </button>
));

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 Main Component
// ═══════════════════════════════════════════════════════════════════════════════

interface DesktopSettingsPanelProps {
    notify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const DesktopSettingsPanel: React.FC<DesktopSettingsPanelProps> = ({ notify }) => {
    // Logic extracted to custom hook
    const {
        autoStart, toggleAutoStart,
        printers, refreshPrinters, selectPrinter, testPrinter, testingPrinter,
        update, checkForUpdates, downloadUpdate,
        crashReports, clearCrashReports
    } = useDesktopSettings(notify);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Hero Header - Ultra Compact */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-3 text-text-main shadow-sm">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                    <RefreshCw size={50} className="text-primary" />
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 dark:bg-white/5 rounded-lg border border-primary/20 dark:border-white/10 text-primary">
                        <RefreshCw size={18} className="animate-spin-slow" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold tracking-tight">إعدادات التحديثات</h2>
                        <p className="text-text-muted text-[10px] opacity-90">نظام التشغيل وإدارة الأجهزة</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Auto-Start */}
                <AutoStartCard enabled={autoStart.enabled} loading={autoStart.loading} onToggle={toggleAutoStart} />

                {/* Updates Section */}
                <div className="relative overflow-hidden bg-surface/50 border border-border rounded-lg p-6 shadow-sm flex flex-col justify-between group hover:border-primary/30 transition-all duration-300">
                    <div className="flex items-center justify-between">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <RefreshCw size={24} className={`text-primary ${update.checking ? 'animate-spin' : ''}`} />
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-bold text-text-muted mb-1">الإصدار الحالي</div>
                            <div className="flex items-center gap-2">
                                <div className="font-mono bg-surface-active px-2 py-1 rounded text-sm font-bold">{update.currentVersion}</div>
                                {(update.currentVersion === 'dev' || update.currentVersion === '0.0.0') && (
                                    <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded-full font-bold border border-yellow-500/20">
                                        نسخة تطوير
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        {update.available && update.info ? (
                            <div className="space-y-3">
                                <button
                                    onClick={downloadUpdate}
                                    disabled={update.downloading}
                                    className="w-full py-4 bg-gradient-to-r from-primary to-emerald-400 text-black font-bold rounded-lg shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    {update.downloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                                    {update.downloading
                                        ? update.progress >= 100
                                            ? 'جاري التثبيت...'
                                            : `جاري التحميل... ${Math.round(update.progress)}%`
                                        : `تحديث إلى v${update.info.version}`
                                    }
                                </button>

                                {/* Progress Bar */}
                                {update.downloading && (
                                    <div className="relative h-3 bg-surface-active rounded-full overflow-hidden">
                                        <div
                                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${update.progress}%` }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 animate-pulse" />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={checkForUpdates}
                                disabled={update.checking}
                                className="w-full py-4 bg-surface-active hover:bg-primary text-text-main hover:text-black font-bold rounded-lg border border-border hover:border-primary transition-all duration-300 flex items-center justify-center gap-3"
                            >
                                {update.checking ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                                {update.checking ? 'جاري التحقق...' : 'التحقق من التحديثات'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Printers Section */}
            <div className="bg-surface/50 border border-border rounded-lg p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                            <Printer size={28} className="text-primary" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-text-main">إدارة الطابعات</h3>
                            <p className="text-sm text-text-muted">التحكم في طابعات الفواتير والإيصالات</p>
                        </div>
                    </div>
                    <button
                        onClick={refreshPrinters}
                        className="p-3 bg-surface-active hover:bg-primary/10 text-text-muted hover:text-primary rounded-lg transition-colors"
                        title="تحديث القائمة"
                    >
                        <RefreshCw size={20} className={printers.loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {printers.loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                        <Loader2 size={40} className="animate-spin mb-4 text-primary" />
                        <p>جاري البحث عن الطابعات...</p>
                    </div>
                ) : printers.list.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {printers.list.map((printer) => (
                            <PrinterCard
                                key={printer.name}
                                printer={printer}
                                isSelected={printers.selected === printer.name}
                                isDefault={printers.default === printer.name}
                                onSelect={selectPrinter}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 rounded-lg bg-surface-active/30 border border-dashed border-border">
                        <Printer size={48} className="mx-auto mb-4 text-text-muted opacity-50" />
                        <h4 className="text-lg font-bold text-text-main mb-1">لا توجد طابعات</h4>
                        <p className="text-text-muted">لم يتم العثور على طابعات مثبتة في النظام</p>
                    </div>
                )}

                <div className="mt-8 pt-6 border-t border-border flex justify-end">
                    <button
                        onClick={testPrinter}
                        disabled={testingPrinter || !printers.selected}
                        className="px-8 py-3 bg-surface-active hover:bg-primary hover:text-black text-text-main font-bold rounded-lg transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {testingPrinter ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                        طباعة صفحة اختبار
                    </button>
                </div>
            </div>

            {/* Diagnostics Section */}
            <div className="bg-surface/50 border border-border rounded-lg p-8 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center border border-red-500/20">
                        <AlertTriangle size={24} className="text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-text-main">تشخيص الأخطاء</h3>
                        <p className="text-sm text-text-muted">سجلات أخطاء النظام (للصيانة فقط)</p>
                    </div>
                </div>

                <div className="bg-black/30 rounded-lg p-4 font-mono text-xs h-32 overflow-y-auto custom-scrollbar border border-white/5 mb-4">
                    {crashReports.loading ? (
                        <div className="flex items-center justify-center h-full text-text-muted gap-2">
                            <Loader2 size={14} className="animate-spin" /> جاري تحميل السجلات...
                        </div>
                    ) : crashReports.list.length > 0 ? (
                        <ul className="space-y-1">
                            {crashReports.list.map((report, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-red-400 hover:text-red-300 cursor-pointer transition-colors">
                                    <FileText size={10} /> {report}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex items-center justify-center h-full text-emerald-500/50 gap-2">
                            <Check size={14} /> النظام يعمل بكفاءة. لا توجد سجلات أخطاء.
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={clearCrashReports}
                        disabled={crashReports.list.length === 0}
                        className="text-red-500 hover:bg-red-500/10 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Trash2 size={14} /> تنظيف السجلات
                    </button>
                </div>
            </div>
        </div>
    );
};
