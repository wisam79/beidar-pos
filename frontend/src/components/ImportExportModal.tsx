/**
 * 📦 Import/Export Modal - Products CSV Import/Export
 * مكون لاستيراد وتصدير المنتجات بصيغة CSV
 */

import React, { useState, useRef } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Info, FileText } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ImportResult {
    success: boolean;
    totalRows: number;
    imported: number;
    updated: number;
    skipped: number;
    errors: string[];
    importedIds: string[];
}

interface ExportResult {
    data: string;
    filename: string;
    count: number;
}

interface ImportExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    notify: (message: string, type: 'success' | 'error' | 'info') => void;
    onImportComplete?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
    isOpen,
    onClose,
    notify,
    onImportComplete,
}) => {
    const [activeTab, setActiveTab] = useState<'import' | 'export'>('export');
    const [importing, setImporting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [updateExisting, setUpdateExisting] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    // Handle file drop
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            handleFileImport(file);
        } else {
            notify('يرجى اختيار ملف CSV', 'error');
        }
    };

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileImport(file);
        }
    };

    // Import file via native dialog
    const handleNativeImport = async () => {
        setImporting(true);
        setImportResult(null);

        try {
            const result = await window.go.main.App.ImportProductsCSVNative(updateExisting);
            setImportResult(result);

            if (result.success && (result.imported > 0 || result.updated > 0)) {
                notify(`تم استيراد ${result.imported} منتج وتحديث ${result.updated}`, 'success');
                onImportComplete?.();
            } else if (result.errors && result.errors.length > 0) {
                notify(`حدثت ${result.errors.length} أخطاء أثناء الاستيراد`, 'error');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
            if (msg === 'cancelled') {
                notify('تم إلغاء الاستيراد', 'info');
            } else {
                notify(`فشل الاستيراد: ${msg}`, 'error');
            }
        } finally {
            setImporting(false);
        }
    };

    // Import file via drop/fallback
    const handleFileImport = async (file: File) => {
        setImporting(true);
        setImportResult(null);

        try {
            const text = await file.text();
            const result = await window.go.main.App.ImportProductsCSV(text, updateExisting);
            setImportResult(result);

            if (result.success && (result.imported > 0 || result.updated > 0)) {
                notify(`تم استيراد ${result.imported} منتج وتحديث ${result.updated}`, 'success');
                onImportComplete?.();
            } else if (result.errors.length > 0) {
                notify(`حدثت ${result.errors.length} أخطاء أثناء الاستيراد`, 'error');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'خطأ في تنسيق الملف';
            notify(`فشل الاستيراد: ${msg}`, 'error');
        } finally {
            setImporting(false);
        }
    };

    // Export products via native dialog
    const handleExport = async () => {
        setExporting(true);
        try {
            const result = await window.go.main.App.ExportProductsCSVNative();
            if (result && result.count > 0) {
                notify(`تم تصدير ${result.count} منتج بنجاح`, 'success');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
            if (msg === 'cancelled') {
                notify('تم إلغاء التصدير', 'info');
            } else {
                notify(`فشل التصدير: ${msg}`, 'error');
            }
        } finally {
            setExporting(false);
        }
    };

    // Download template via native dialog
    const handleDownloadTemplate = async () => {
        try {
            const success = await window.go.main.App.DownloadProductsTemplateNative();
            if (success) {
                notify('تم تحميل القالب', 'success');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'خطأ في النظام';
            if (msg === 'cancelled') {
                notify('تم إلغاء تحميل القالب', 'info');
            } else {
                notify(`فشل تحميل القالب: ${msg}`, 'error');
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60  animate-in fade-in">
            <div className="bg-surface w-full max-w-xl rounded-2xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <FileSpreadsheet size={20} className="text-primary" />
                        </div>
                        <div>
                            <h2 className="font-bold text-text-main">استيراد / تصدير المنتجات</h2>
                            <p className="text-xs text-text-muted">إدارة المنتجات بصيغة CSV</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-bg transition-colors text-text-muted hover:text-text-main"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex p-2 mx-5 mt-4 bg-bg rounded-xl border border-border">
                    <button
                        onClick={() => { setActiveTab('export'); setImportResult(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'export'
                            ? 'bg-surface text-text-main shadow-sm border border-border'
                            : 'text-text-muted hover:text-text-main'
                            }`}
                    >
                        <Download size={16} />
                        تصدير
                    </button>
                    <button
                        onClick={() => { setActiveTab('import'); setImportResult(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'import'
                            ? 'bg-surface text-text-main shadow-sm border border-border'
                            : 'text-text-muted hover:text-text-main'
                            }`}
                    >
                        <Upload size={16} />
                        استيراد
                    </button>
                </div>

                {/* Content */}
                <div className="p-5">
                    {activeTab === 'export' ? (
                        <div className="space-y-4">
                            <div className="bg-bg rounded-xl p-4 border border-border">
                                <div className="flex items-center gap-3 mb-3">
                                    <Info size={18} className="text-blue-500" />
                                    <p className="text-sm text-text-main font-medium">معلومات التصدير</p>
                                </div>
                                <ul className="text-xs text-text-muted space-y-1 mr-7">
                                    <li>• سيتم تصدير جميع المنتجات</li>
                                    <li>• الترميز: UTF-8 (يدعم العربية)</li>
                                    <li>• يمكن فتح الملف بـ Excel أو Google Sheets</li>
                                </ul>
                            </div>

                            <button
                                onClick={handleExport}
                                disabled={exporting}
                                className="w-full py-4 bg-gradient-to-r from-primary to-emerald-400 text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {exporting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        جاري التصدير...
                                    </>
                                ) : (
                                    <>
                                        <Download size={18} />
                                        تصدير المنتجات CSV
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Import Result */}
                            {importResult && (
                                <div className={`rounded-xl p-4 border ${importResult.success && importResult.errors.length === 0
                                    ? 'bg-emerald-500/10 border-emerald-500/20'
                                    : importResult.errors.length > 0
                                        ? 'bg-amber-500/10 border-amber-500/20'
                                        : 'bg-red-500/10 border-red-500/20'
                                    }`}>
                                    <div className="flex items-center gap-2 mb-3">
                                        {importResult.success && importResult.errors.length === 0 ? (
                                            <CheckCircle size={18} className="text-emerald-500" />
                                        ) : (
                                            <AlertCircle size={18} className="text-amber-500" />
                                        )}
                                        <span className="font-bold text-text-main">نتيجة الاستيراد</span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 text-center">
                                        <div className="bg-bg/50 rounded-lg p-2">
                                            <p className="text-lg font-bold text-text-main">{importResult.totalRows}</p>
                                            <p className="text-[10px] text-text-muted">الإجمالي</p>
                                        </div>
                                        <div className="bg-bg/50 rounded-lg p-2">
                                            <p className="text-lg font-bold text-emerald-500">{importResult.imported}</p>
                                            <p className="text-[10px] text-text-muted">جديد</p>
                                        </div>
                                        <div className="bg-bg/50 rounded-lg p-2">
                                            <p className="text-lg font-bold text-blue-500">{importResult.updated}</p>
                                            <p className="text-[10px] text-text-muted">محدث</p>
                                        </div>
                                        <div className="bg-bg/50 rounded-lg p-2">
                                            <p className="text-lg font-bold text-red-500">{importResult.skipped}</p>
                                            <p className="text-[10px] text-text-muted">مرفوض</p>
                                        </div>
                                    </div>
                                    {importResult.errors.length > 0 && (
                                        <div className="mt-3 max-h-24 overflow-y-auto text-xs text-red-400 bg-bg/50 rounded-lg p-2">
                                            {importResult.errors.slice(0, 5).map((err, i) => (
                                                <p key={i}>• {err}</p>
                                            ))}
                                            {importResult.errors.length > 5 && (
                                                <p className="text-text-muted">... و {importResult.errors.length - 5} أخطاء أخرى</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Drop Zone */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onClick={handleNativeImport}
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                                    }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                {importing ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                                        <p className="text-text-main font-medium">جاري الاستيراد...</p>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={32} className="mx-auto mb-3 text-text-muted" />
                                        <p className="text-text-main font-medium mb-1">اسحب ملف CSV هنا</p>
                                        <p className="text-xs text-text-muted">أو اضغط للاختيار</p>
                                    </>
                                )}
                            </div>

                            {/* Options */}
                            <label className="flex items-center gap-3 p-3 bg-bg rounded-xl border border-border cursor-pointer hover:border-primary/30 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={updateExisting}
                                    onChange={(e) => setUpdateExisting(e.target.checked)}
                                    className="w-4 h-4 rounded border-border accent-primary"
                                />
                                <div>
                                    <p className="text-sm font-medium text-text-main">تحديث المنتجات الموجودة</p>
                                    <p className="text-[10px] text-text-muted">تحديث المنتجات بنفس الكود أو الباركود</p>
                                </div>
                            </label>

                            {/* Template Download */}
                            <button
                                onClick={handleDownloadTemplate}
                                className="w-full py-3 bg-bg hover:bg-surface-hover text-text-main font-medium rounded-xl flex items-center justify-center gap-2 border border-border transition-colors"
                            >
                                <FileText size={16} />
                                تحميل قالب CSV
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
