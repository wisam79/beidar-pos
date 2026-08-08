import React, { useState, useEffect, useCallback } from 'react';
import { Power, Printer, RefreshCw, Check, Loader2, Download,
    AlertTriangle, Play, FileText, Trash2
} from 'lucide-react';
import { desktopApi, PrinterInfo, UpdateInfo } from '../../../core/api';

// ═══════════════════════════════════════════════════════════════════════════════
// 🪝 Custom Hook: useDesktopSettings
// ═══════════════════════════════════════════════════════════════════════════════
const useDesktopSettings = (notify: (msg: string, type: 'success' | 'error' | 'info') => void) => {
    // State
    const [autoStart, setAutoStart] = useState({ enabled: false, loading: false });
    const [simulatePrint, setSimulatePrint] = useState(() => localStorage.getItem('beidar_simulate_print') === 'true');
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

    const toggleSimulatePrint = useCallback(() => {
        setSimulatePrint(prev => {
            const next = !prev;
            localStorage.setItem('beidar_simulate_print', String(next));
            notify(next ? 'تم تفعيل وضع محاكاة الطباعة' : 'تم تعطيل وضع محاكاة الطباعة', 'success');
            return next;
        });
    }, [notify]);

    return {
        autoStart,
        toggleAutoStart,
        simulatePrint,
        toggleSimulatePrint,
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
    <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6 select-none">
        <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
                <Power size={20} />
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-hover rounded-xl border border-border/60">
                <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted'}`} />
                <span className="text-xs font-black text-text-muted">{enabled ? 'مفعل' : 'معطل'}</span>
            </div>
        </div>
        <h3 className="text-base font-black text-text-main mb-1">التشغيل الآلي عند الإقلاع</h3>
        <p className="text-xs text-text-muted mb-4 font-semibold leading-relaxed">
            تفعيل فتح برنامج بيدر تلقائياً فور بدء تشغيل نظام الويندوز.
        </p>
        <button
            onClick={onToggle}
            disabled={loading}
            className={`w-full py-3 min-h-[48px] rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-transform cursor-pointer active:scale-[0.98] border ${enabled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-surface-hover text-text-muted border-border/60 hover:text-text-main'
                }`}
        >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} />}
            {enabled ? 'تعطيل التشغيل التلقائي' : 'تفعيل التشغيل التلقائي'}
        </button>
    </div>
));

const SimulatePrintCard = React.memo(({ enabled, onToggle }: { enabled: boolean, onToggle: () => void }) => (
    <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6 select-none">
        <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center">
                <FileText size={20} />
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-hover rounded-xl border border-border/60">
                <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-blue-400 animate-pulse' : 'bg-text-muted'}`} />
                <span className="text-xs font-black text-text-muted">{enabled ? 'مفعل' : 'معطل'}</span>
            </div>
        </div>
        <h3 className="text-base font-black text-text-main mb-1">وضع محاكاة الطباعة المعاينة</h3>
        <p className="text-xs text-text-muted mb-4 font-semibold leading-relaxed">
            عرض صورة الفاتورة فورياً على الشاشة بدلاً من إرسالها للطابعة الحرارية.
        </p>
        <button
            onClick={onToggle}
            className={`w-full py-3 min-h-[48px] rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-transform cursor-pointer active:scale-[0.98] border ${enabled
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                : 'bg-surface-hover text-text-muted border-border/60 hover:text-text-main'
                }`}
        >
            <FileText size={18} />
            {enabled ? 'تعطيل وضع المعاينة' : 'تفعيل وضع المعاينة'}
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
        className={`p-4 rounded-xl border text-right transition-colors cursor-pointer ${isSelected
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
            : 'border-border/80 bg-surface hover:border-emerald-500/30'
            }`}
    >
        <div className="flex items-start justify-between mb-2">
            <Printer size={22} className={isSelected ? 'text-emerald-400' : 'text-text-muted'} />
            {isSelected && (
                <div className="w-5 h-5 bg-emerald-500 text-black rounded-full flex items-center justify-center">
                    <Check size={12} className="stroke-[3]" />
                </div>
            )}
        </div>
        <h4 className="font-black text-xs text-text-main truncate mb-1">
            {printer.name}
        </h4>
        <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border ${printer.status === 'Ready' || !printer.status ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                {printer.status || 'جاهز'}
            </span>
            {isDefault && (
                <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg font-bold">الافتراضية</span>
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
        simulatePrint, toggleSimulatePrint,
        printers, refreshPrinters, selectPrinter, testPrinter, testingPrinter,
        update, checkForUpdates, downloadUpdate,
        crashReports, clearCrashReports
    } = useDesktopSettings(notify);

    return (
        <div className="space-y-5 animate-in fade-in duration-300 pb-8 select-none">
            {/* Header Banner */}
            <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <RefreshCw size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-text-main">تحديثات النظام وإدارة العتاد</h2>
                        <p className="text-text-muted text-xs font-semibold">إدارة الطابعات المحلية، الإقلاء التلقائي، والتحديثات الفورية</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Auto-Start & Simulate */}
                <div className="flex flex-col gap-5">
                    <AutoStartCard enabled={autoStart.enabled} loading={autoStart.loading} onToggle={toggleAutoStart} />
                    <SimulatePrintCard enabled={simulatePrint} onToggle={toggleSimulatePrint} />
                </div>

                {/* Updates Section */}
                <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
                            <RefreshCw size={20} className={update.checking ? 'animate-spin' : ''} />
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-black text-text-muted mb-1">إصدار النظام الحاضر</div>
                            <div className="flex items-center gap-2">
                                <code className="font-mono bg-surface-hover border border-border/60 px-2.5 py-1 rounded-lg text-xs font-black text-emerald-400">{update.currentVersion}</code>
                                {(update.currentVersion === 'dev' || update.currentVersion === '0.0.0') && (
                                    <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-lg font-bold border border-amber-500/20">
                                        تطوير محلي
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
                                    className="w-full py-3 min-h-[48px] bg-emerald-500 text-black font-black rounded-xl border border-emerald-400 hover:bg-emerald-400 transition-transform active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {update.downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                    {update.downloading
                                        ? update.progress >= 100
                                            ? 'جاري التثبيت...'
                                            : `جاري التحميل... ${Math.round(update.progress)}%`
                                        : `تحميل التحديث v${update.info.version}`
                                    }
                                </button>

                                {update.downloading && (
                                    <div className="relative h-2.5 bg-surface-hover rounded-full overflow-hidden border border-border/60">
                                        <div
                                            className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-300"
                                            style={{ width: `${update.progress}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={checkForUpdates}
                                disabled={update.checking}
                                className="w-full py-3 min-h-[48px] bg-surface-hover hover:bg-emerald-500/10 text-text-main hover:text-emerald-400 font-black text-xs rounded-xl border border-border/80 hover:border-emerald-500/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {update.checking ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                {update.checking ? 'جاري التحقق...' : 'التحقق من وجود تحديثات جديدة'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Printers Section */}
            <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            <Printer size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-text-main">الطابعات المتصلة بالنظام</h3>
                            <p className="text-xs text-text-muted font-medium">قائمة الطابعات المعرفة على جهاز الويندوز</p>
                        </div>
                    </div>
                    <button
                        onClick={refreshPrinters}
                        className="p-2.5 bg-surface-hover text-text-muted hover:text-emerald-400 rounded-xl border border-border/60 transition-colors cursor-pointer"
                        title="تحديث القائمة"
                    >
                        <RefreshCw size={18} className={printers.loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {printers.loading ? (
                    <div className="flex flex-col items-center justify-center py-10 text-text-muted">
                        <Loader2 size={32} className="animate-spin mb-3 text-emerald-400" />
                        <p className="text-xs font-bold">جاري الفحص واستكشاف الطابعات...</p>
                    </div>
                ) : printers.list.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
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
                    <div className="text-center py-10 rounded-xl bg-surface-hover/30 border border-dashed border-border/60">
                        <Printer size={36} className="mx-auto mb-2 text-text-muted opacity-50" />
                        <h4 className="text-sm font-black text-text-main mb-0.5">لم يتم العثور على طابعات</h4>
                        <p className="text-xs text-text-muted font-medium">تأكد من توصيل الطابعة وتثبيت برامج التشغيل</p>
                    </div>
                )}

                <div className="mt-6 pt-4 border-t border-border/40 flex justify-end">
                    <button
                        onClick={testPrinter}
                        disabled={testingPrinter || !printers.selected}
                        className="px-6 py-2.5 min-h-[44px] bg-emerald-500 text-black font-black text-xs rounded-xl border border-emerald-400 hover:bg-emerald-400 transition-transform active:scale-[0.98] flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {testingPrinter ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                        طباعة إيصال تجريبي
                    </button>
                </div>
            </div>

            {/* Diagnostics Section */}
            <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-text-main">سجلات تشخيص الأخطاء (Logs)</h3>
                        <p className="text-xs text-text-muted font-medium">متابعة سجل الاستثناءات والأخطاء بالنظام</p>
                    </div>
                </div>

                <div className="bg-black/30 rounded-xl p-3.5 font-mono text-xs h-28 overflow-y-auto custom-scrollbar border border-border/40 mb-3">
                    {crashReports.loading ? (
                        <div className="flex items-center justify-center h-full text-text-muted gap-2">
                            <Loader2 size={14} className="animate-spin" /> جاري تحميل السجلات...
                        </div>
                    ) : crashReports.list.length > 0 ? (
                        <ul className="space-y-1">
                            {crashReports.list.map((report, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-red-400 font-bold">
                                    <FileText size={12} /> {report}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex items-center justify-center h-full text-emerald-400 gap-2 font-bold">
                            <Check size={14} /> النظام يعمل باستقرار تام دون تسجيل أي أخطاء.
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={clearCrashReports}
                        disabled={crashReports.list.length === 0}
                        className="text-red-400 hover:text-red-300 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <Trash2 size={14} /> تنظيف وسحق السجلات القديمة
                    </button>
                </div>
            </div>
        </div>
    );
};
