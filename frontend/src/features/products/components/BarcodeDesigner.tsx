
import React, { useState, useRef, useEffect } from 'react';
import { Product, AppPreferences } from '../../../core/types';
import { formatCurrency } from '../../../core/utils';
import { Modal } from '../../../components/ui';
import { LayoutTemplate, Grid, Type, Printer, Plus, Minus, List, Trash2, Settings, CheckSquare, Square, Eye, Layers, Tag, Store } from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface LabelSettings {
    width: number;
    height: number;
    showStoreName: boolean;
    showPrice: boolean;
    showDate: boolean;
    showProductCode: boolean;
    fontSize: 'sm' | 'md' | 'lg';
}

interface BarcodeDesignerProps {
    onClose: () => void;
    initialProduct?: Product;
    queue: { product: Partial<Product>; qty: number }[];
    onClearQueue: () => void;
    prefs: AppPreferences;
    onAddToQueue?: (p: Partial<Product>, q: number) => void;
    onRemoveFromQueue?: (idx: number) => void;
    onUpdateQueueQty?: (idx: number, newQty: number) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏷️ BARCODE LABEL COMPONENT - Clean Design
// ═══════════════════════════════════════════════════════════════════════════════

const BarcodeLabel = ({ product, storeName, settings, prefs }: { product: Partial<Product>, storeName: string, settings: LabelSettings, prefs?: AppPreferences, uniqueKey?: unknown }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const barcodeValue = product.barcode || '000000';

    useEffect(() => {
        if (svgRef.current) {
            try {
                JsBarcode(svgRef.current, barcodeValue, {
                    format: "CODE128",
                    width: 1.8,
                    height: 40,
                    displayValue: settings.showProductCode,
                    fontSize: 11,
                    margin: 2,
                    background: "#fff",
                    lineColor: "#000",
                    font: "monospace"
                });
            } catch (e) {
                console.error("Barcode generation failed", e);
            }
        }
    }, [barcodeValue, settings.showProductCode]);

    const fontSizeClass = settings.fontSize === 'sm' ? 'text-[9px]' : settings.fontSize === 'lg' ? 'text-[13px]' : 'text-[11px]';

    return (
        <div
            className="bg-white text-black flex flex-col items-center border border-gray-200 print:border-gray-300 break-inside-avoid"

            style={{
                width: '100%',
                height: `${settings.height}mm`,
                padding: '2.5mm',
                boxSizing: 'border-box'
            }}
        >
            {/* Store Name */}
            {settings.showStoreName && (
                <div className="text-center w-full mb-1 border-b border-gray-200 pb-1">
                    <p className="font-black uppercase truncate text-[10px] tracking-wider text-gray-700">{storeName}</p>
                </div>
            )}

            {/* Product Name */}
            <div className="flex-1 flex flex-col justify-center items-center w-full min-h-0">
                <p className={`font-bold text-center leading-tight px-1 mb-2 line-clamp-2 w-full break-words ${fontSizeClass}`}>
                    {product.name}
                </p>

                {/* Barcode */}
                <div className="w-full flex justify-center items-center flex-1 min-h-0">
                    <svg ref={svgRef} className="max-w-full max-h-full block"></svg>
                </div>
            </div>

            {/* Footer: Price & Date */}
            {(settings.showPrice || settings.showDate) && (
                <div className="flex justify-between items-center w-full mt-1.5 pt-1.5 border-t border-gray-200">
                    {settings.showDate && (
                        <span className="text-[9px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {new Date().toLocaleDateString('en-GB')}
                        </span>
                    )}
                    {settings.showPrice && (
                        <span className="font-black text-sm mr-auto bg-black text-white px-2 py-0.5 rounded">
                            {formatCurrency(product.price || 0, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎛️ TOGGLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const Toggle = ({ label, checked, onChange, icon: Icon }: { label: string; checked: boolean; onChange: (v: boolean) => void; icon?: React.ElementType }) => (
    <div
        onClick={() => onChange(!checked)}
        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${checked ? 'bg-primary/10 border border-primary/30' : 'bg-surface border border-border hover:border-primary/20'
            }`}
    >
        <div className="flex items-center gap-2">
            {Icon && <Icon size={14} className={checked ? 'text-primary' : 'text-text-muted'} />}
            <span className={`text-xs font-bold ${checked ? 'text-primary' : 'text-text-main'}`}>{label}</span>
        </div>
        {checked ? <CheckSquare className="text-primary" size={18} /> : <Square className="text-text-muted" size={18} />}
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 📄 MAIN BARCODE DESIGNER
// ═══════════════════════════════════════════════════════════════════════════════

// Page format presets
const PAGE_FORMATS = {
    a4: { name: 'A4', width: 210, height: 297, icon: '📄' },
    thermal58: { name: 'حراري 58mm', width: 58, height: 297, icon: '🧾' },
    thermal80: { name: 'حراري 80mm', width: 80, height: 297, icon: '🧾' },
    thermal110: { name: 'حراري 110mm', width: 110, height: 297, icon: '🧾' },
    labelRoll: { name: 'رول ملصقات', width: 100, height: 50, icon: '🏷️' }
} as const;

// Label size presets
const LABEL_PRESETS = [
    { name: 'صغير جداً', width: 30, height: 20, desc: '30×20mm' },
    { name: 'صغير', width: 40, height: 25, desc: '40×25mm' },
    { name: 'متوسط', width: 50, height: 30, desc: '50×30mm' },
    { name: 'كبير', width: 70, height: 40, desc: '70×40mm' },
    { name: 'كبير جداً', width: 100, height: 50, desc: '100×50mm' },
] as const;

type PageFormatKey = keyof typeof PAGE_FORMATS;

export const BarcodeDesigner: React.FC<BarcodeDesignerProps> = ({ onClose, initialProduct, queue, onClearQueue, prefs, onRemoveFromQueue, onAddToQueue, onUpdateQueueQty }) => {
    const [settings, setSettings] = useState<LabelSettings>({
        width: 50,
        height: 30,
        showStoreName: true,
        showPrice: true,
        showDate: false,
        showProductCode: true,
        fontSize: 'md'
    });

    const [gridSettings, setGridSettings] = useState({
        columns: 3,
        gap: 2,
        showCutMarks: true,
        pageMargin: 5
    });

    const [pageFormat, setPageFormat] = useState<PageFormatKey>('a4');
    const [tab, setTab] = useState<'settings' | 'queue'>('queue');

    // Auto-calculate columns based on page format and label width
    const autoCalculateColumns = (labelWidth: number, pageWidth: number, gap: number, margin: number) => {
        const availableWidth = pageWidth - (margin * 2);
        const cols = Math.floor((availableWidth + gap) / (labelWidth + gap));
        return Math.max(1, cols);
    };

    // Update columns when page format or label size changes
    useEffect(() => {
        const format = PAGE_FORMATS[pageFormat];
        const newCols = autoCalculateColumns(settings.width || 50, format.width, gridSettings.gap, gridSettings.pageMargin);
        setGridSettings(prev => ({ ...prev, columns: newCols }));
    }, [pageFormat, settings.width]);

    useEffect(() => {
        if (initialProduct && queue.length === 0 && onAddToQueue) {
            onAddToQueue(initialProduct, 1);
        }
    }, []);

    const applyLabelPreset = (preset: typeof LABEL_PRESETS[number]) => {
        setSettings(prev => ({ ...prev, width: preset.width, height: preset.height }));
    };

    const itemsToPrint = React.useMemo(() => {
        const list: Partial<Product>[] = [];
        if (queue && queue.length > 0) {
            queue.forEach((item: { product: Partial<Product>; qty: number }) => {
                for (let i = 0; i < item.qty; i++) list.push(item.product);
            });
        }
        return list;
    }, [queue]);

    const handlePrint = () => {
        if (itemsToPrint.length === 0) return;

        // Generate labels HTML
        const labelsHTML = itemsToPrint.map((p: Partial<Product>) => `
            <div class="label-item">
                ${settings.showStoreName ? `<div class="store-name">${prefs?.storeName || 'Store'}</div>` : ''}
                <div class="product-name">${p.name}</div>
                <div class="barcode-container">
                    <svg class="barcode-svg" data-value="${p.barcode || '000000'}" data-show-value="${settings.showProductCode}"></svg>
                </div>
                ${(settings.showPrice || settings.showDate) ? `
                    <div class="footer">
                        ${settings.showDate ? `<span class="date">${new Date().toLocaleDateString('en-GB')}</span>` : ''}
                        ${settings.showPrice ? `<span class="price">${(p.price || 0).toLocaleString()} د.ع</span>` : ''}
                    </div>
                ` : ''}
            </div>
        `).join('');

        // Create hidden iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;visibility:hidden;';
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) {
            console.error('Cannot access iframe document');
            document.body.removeChild(iframe);
            return;
        }

        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>طباعة الملصقات</title>
                <script src="/libs/JsBarcode.all.min.js"></script>
                <style>
                    @page { 
                        size: ${currentFormat.width}mm ${currentFormat.height}mm; 
                        margin: 0; 
                    }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: Arial, sans-serif;
                        background: white;
                    }
                    .print-area {
                        width: ${currentFormat.width}mm;
                        min-height: ${currentFormat.height}mm;
                        display: grid;
                        grid-template-columns: repeat(${gridSettings.columns}, 1fr);
                        gap: ${gridSettings.gap}mm;
                        padding: ${gridSettings.pageMargin}mm;
                        background: white;
                    }
                    .label-item {
                        background: white;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        border: ${gridSettings.showCutMarks ? '1px dashed #ddd' : 'none'};
                        height: ${settings.height}mm;
                        padding: 2.5mm;
                        page-break-inside: avoid;
                    }
                    .store-name { 
                        font-size: 10px; 
                        font-weight: 900; 
                        text-transform: uppercase;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 2px;
                        margin-bottom: 4px;
                        width: 100%;
                        text-align: center;
                    }
                    .product-name { 
                        font-size: ${settings.fontSize === 'sm' ? '9px' : settings.fontSize === 'lg' ? '13px' : '11px'}; 
                        font-weight: bold;
                        text-align: center;
                        margin-bottom: 4px;
                    }
                    .barcode-container { flex: 1; display: flex; align-items: center; justify-content: center; }
                    .barcode-container svg { max-width: 100%; max-height: 100%; }
                    .footer { 
                        display: flex; 
                        justify-content: space-between; 
                        width: 100%; 
                        margin-top: 4px;
                        padding-top: 4px;
                        border-top: 1px solid #ddd;
                    }
                    .date { font-size: 9px; font-family: monospace; color: #666; background: #f5f5f5; padding: 2px 4px; border-radius: 2px; }
                    .price { font-size: 12px; font-weight: 900; background: black; color: white; padding: 2px 8px; border-radius: 3px; }
                </style>
            </head>
            <body>
                <div class="print-area">${labelsHTML}</div>
                <script>
                    window.onload = function() {
                        document.querySelectorAll('.barcode-svg').forEach(function(svg) {
                            var value = svg.getAttribute('data-value') || '000000';
                            var showValue = svg.getAttribute('data-show-value') === 'true';
                            try {
                                JsBarcode(svg, value, {
                                    format: "CODE128",
                                    width: 1.8,
                                    height: 40,
                                    displayValue: showValue,
                                    fontSize: 11,
                                    margin: 2,
                                    background: "#fff",
                                    lineColor: "#000",
                                    font: "monospace"
                                });
                            } catch(e) { console.error(e); }
                        });
                        setTimeout(function() { 
                            window.focus();
                            window.print(); 
                        }, 300);
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();

        // Cleanup after print
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
        }, 5000);
    };

    const totalLabels = itemsToPrint.length;
    const currentFormat = PAGE_FORMATS[pageFormat];
    const labelsPerPage = Math.floor(currentFormat.height / settings.height) * gridSettings.columns;
    const totalPages = Math.ceil(totalLabels / labelsPerPage);


    return (
        <Modal title="طباعة الملصقات" onClose={onClose} size="xl">
            <div className="flex gap-6 h-[600px]">

                {/* Left Panel: Controls */}
                <div className="w-80 bg-surface rounded-2xl border border-border flex flex-col overflow-hidden modal-ui">
                    {/* Tabs */}
                    <div className="flex border-b border-border">
                        <button
                            onClick={() => setTab('queue')}
                            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 transition-colors ${tab === 'queue' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-text-muted hover:text-text-main'
                                }`}
                        >
                            <Layers size={14} /> القائمة ({queue.reduce((a, b) => a + b.qty, 0)})
                        </button>
                        <button
                            onClick={() => setTab('settings')}
                            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 transition-colors ${tab === 'settings' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-text-muted hover:text-text-main'
                                }`}
                        >
                            <Settings size={14} /> الإعدادات
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        {tab === 'queue' ? (
                            <div className="space-y-2">
                                {queue.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Tag size={40} className="mx-auto text-text-muted mb-3 opacity-30" />
                                        <p className="text-text-muted text-sm font-bold">قائمة الطباعة فارغة</p>
                                        <p className="text-text-muted text-xs mt-1">أضف منتجات من صفحة المنتجات</p>
                                    </div>
                                ) : (
                                    queue.map((item, idx) => (
                                        <div key={idx} className="bg-bg p-3 rounded-xl border border-border group hover:border-primary/30 transition-all">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="truncate flex-1">
                                                    <p className="text-sm text-text-main font-bold truncate">{item.product.name}</p>
                                                    <p className="text-[10px] text-text-muted font-mono">{item.product.barcode}</p>
                                                </div>
                                                <button
                                                    onClick={() => onRemoveFromQueue && onRemoveFromQueue(idx)}
                                                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-text-muted hover:text-red-500 transition-colors"
                                                    aria-label="حذف العنصر"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            {/* Quantity Controls */}
                                            <div className="flex items-center gap-2 bg-surface rounded-lg border border-border p-1">
                                                <button
                                                    onClick={() => onUpdateQueueQty && onUpdateQueueQty(idx, Math.max(1, item.qty - 1))}
                                                    className="p-2 hover:bg-bg rounded-lg text-text-muted hover:text-text-main transition-colors"
                                                    aria-label="إنقاص العدد"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.qty}
                                                    title="عدد الملصقات"
                                                    aria-label="عدد الملصقات"
                                                    onChange={(e) => onUpdateQueueQty && onUpdateQueueQty(idx, parseInt(e.target.value) || 1)}
                                                    className="flex-1 bg-transparent text-center text-sm font-bold text-primary outline-none w-12"
                                                />
                                                <button
                                                    onClick={() => onUpdateQueueQty && onUpdateQueueQty(idx, item.qty + 1)}
                                                    className="p-2 hover:bg-bg rounded-lg text-text-muted hover:text-text-main transition-colors"
                                                    aria-label="زيادة العدد"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Page Format */}
                                <div>
                                    <h3 className="text-sm font-bold text-text-main flex items-center gap-2 mb-3">
                                        📄 حجم الورق
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(Object.entries(PAGE_FORMATS) as [PageFormatKey, typeof PAGE_FORMATS[PageFormatKey]][]).map(([key, format]) => (
                                            <button
                                                key={key}
                                                onClick={() => setPageFormat(key)}
                                                className={`p-2.5 rounded-xl text-xs font-bold transition-all border ${pageFormat === key
                                                    ? 'bg-primary text-primary-fg border-primary'
                                                    : 'bg-bg border-border text-text-muted hover:border-primary/50 hover:text-text-main'
                                                    }`}
                                            >
                                                <span className="block text-base mb-0.5">{format.icon}</span>
                                                <span>{format.name}</span>
                                                <span className="block text-[9px] opacity-70">{format.width}×{format.height}mm</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Label Presets */}
                                <div>
                                    <h3 className="text-sm font-bold text-text-main flex items-center gap-2 mb-3">
                                        🏷️ أحجام الملصقات الجاهزة
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {LABEL_PRESETS.map((preset, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => applyLabelPreset(preset)}
                                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${settings.width === preset.width && settings.height === preset.height
                                                    ? 'bg-primary/20 text-primary border-primary/50'
                                                    : 'bg-bg border-border text-text-muted hover:border-primary/30'
                                                    }`}
                                            >
                                                {preset.name}
                                                <span className="block text-[9px] font-mono opacity-70">{preset.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom Label Size */}
                                <div>
                                    <h3 className="text-sm font-bold text-text-main flex items-center gap-2 mb-3">
                                        <LayoutTemplate size={16} className="text-primary" /> أبعاد مخصصة
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-[10px] text-text-muted font-bold block mb-1">العرض (mm)</label>
                                            <input
                                                type="number"
                                                aria-label="العرض"
                                                title="عرض الملصق"
                                                className="w-full bg-bg border border-border text-text-main rounded-xl p-2.5 text-center font-mono font-bold text-sm outline-none focus:border-primary transition-colors"
                                                value={settings.width}
                                                onChange={e => setSettings({ ...settings, width: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-text-muted font-bold block mb-1">الارتفاع (mm)</label>
                                            <input
                                                type="number"
                                                aria-label="الارتفاع"
                                                title="ارتفاع الملصق"
                                                className="w-full bg-bg border border-border text-text-main rounded-xl p-2.5 text-center font-mono font-bold text-sm outline-none focus:border-primary transition-colors"
                                                value={settings.height}
                                                onChange={e => setSettings({ ...settings, height: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-text-muted font-bold block mb-1">الخط</label>
                                            <select
                                                title="حجم الخط"
                                                aria-label="حجم الخط"
                                                className="w-full bg-bg border border-border text-text-main rounded-xl p-2.5 text-center font-bold text-sm outline-none focus:border-primary cursor-pointer transition-colors"
                                                value={settings.fontSize}
                                                onChange={e => setSettings({ ...settings, fontSize: e.target.value as 'sm' | 'md' | 'lg' })}
                                            >
                                                <option value="sm">صغير</option>
                                                <option value="md">وسط</option>
                                                <option value="lg">كبير</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Page Layout */}
                                <div>
                                    <h3 className="text-sm font-bold text-text-main flex items-center gap-2 mb-3">
                                        <Grid size={16} className="text-primary" /> تخطيط الصفحة
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-[10px] text-text-muted font-bold block mb-1">الأعمدة</label>
                                            <input
                                                type="number"
                                                aria-label="عدد الأعمدة"
                                                title="عدد الأعمدة"
                                                min="1"
                                                max="10"
                                                className="w-full bg-bg border border-border text-text-main rounded-xl p-2.5 text-center font-mono font-bold text-sm outline-none focus:border-primary transition-colors"
                                                value={gridSettings.columns}
                                                onChange={e => setGridSettings({ ...gridSettings, columns: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-text-muted font-bold block mb-1">الفجوة (mm)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                title="الفجوة بين الملصقات"
                                                className="w-full bg-bg border border-border text-text-main rounded-xl p-2.5 text-center font-mono font-bold text-sm outline-none focus:border-primary transition-colors"
                                                value={gridSettings.gap}
                                                onChange={e => setGridSettings({ ...gridSettings, gap: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-text-muted font-bold block mb-1">الهامش (mm)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                title="هامش الصفحة"
                                                className="w-full bg-bg border border-border text-text-main rounded-xl p-2.5 text-center font-mono font-bold text-sm outline-none focus:border-primary transition-colors"
                                                value={gridSettings.pageMargin}
                                                onChange={e => setGridSettings({ ...gridSettings, pageMargin: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Label Content */}
                                <div>
                                    <h3 className="text-sm font-bold text-text-main flex items-center gap-2 mb-3">
                                        <Type size={16} className="text-primary" /> محتوى الملصق
                                    </h3>
                                    <div className="space-y-2">
                                        <Toggle label="اسم المتجر" icon={Store} checked={settings.showStoreName} onChange={(v: boolean) => setSettings({ ...settings, showStoreName: v })} />
                                        <Toggle label="السعر" icon={Tag} checked={settings.showPrice} onChange={(v: boolean) => setSettings({ ...settings, showPrice: v })} />
                                        <Toggle label="رقم الباركود" checked={settings.showProductCode} onChange={(v: boolean) => setSettings({ ...settings, showProductCode: v })} />
                                        <Toggle label="التاريخ" checked={settings.showDate} onChange={(v: boolean) => setSettings({ ...settings, showDate: v })} />
                                        <Toggle label="خطوط القص" checked={gridSettings.showCutMarks} onChange={(v: boolean) => setGridSettings({ ...gridSettings, showCutMarks: v })} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border bg-bg space-y-3">
                        {/* Summary */}
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-text-muted">إجمالي الملصقات:</span>
                            <span className="font-bold text-text-main">{totalLabels} ملصق</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-text-muted">عدد الصفحات:</span>
                            <span className="font-bold text-text-main">{totalPages} صفحة {currentFormat.name}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={handlePrint}
                                disabled={totalLabels === 0}
                                className="flex-1 bg-primary text-primary-fg py-3 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                <Printer size={16} /> طباعة
                            </button>
                            {queue.length > 0 && (
                                <button
                                    onClick={onClearQueue}
                                    className="px-4 bg-red-500/10 text-red-500 py-3 rounded-xl font-bold border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                                    title="مسح القائمة"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Preview */}
                <div className="flex-1 bg-bg rounded-2xl border border-border overflow-hidden flex flex-col">
                    {/* Preview Header */}
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface">
                        <div className="flex items-center gap-2 text-text-muted text-xs font-bold">
                            <Eye size={14} /> معاينة الطباعة
                        </div>
                        <div className="text-[10px] text-text-muted bg-bg px-2 py-1 rounded border border-border">
                            {currentFormat.icon} {currentFormat.name} ({currentFormat.width}×{currentFormat.height}mm)
                        </div>
                    </div>

                    {/* Preview Content */}
                    <div className="flex-1 overflow-auto custom-scrollbar p-6 flex justify-center bg-surface-active">
                        <div
                            id="print-area"
                            className="bg-white shadow-lg border border-gray-200 transition-all origin-top"

                            style={{
                                width: `${currentFormat.width}mm`,
                                minHeight: `${currentFormat.height}mm`,
                                display: 'grid',
                                gridTemplateColumns: `repeat(${gridSettings.columns}, 1fr)`,
                                gap: `${gridSettings.gap}mm`,
                                padding: `${gridSettings.pageMargin}mm`,
                                alignContent: 'start'
                            }}
                        >
                            {totalLabels === 0 ? (
                                <div className="col-span-full h-[150mm] flex flex-col items-center justify-center text-gray-400 select-none">
                                    <Tag size={64} className="mb-4 opacity-20" />
                                    <span className="font-bold text-lg opacity-50">لا توجد ملصقات</span>
                                    <span className="text-sm opacity-40 mt-1">أضف منتجات من القائمة</span>
                                </div>
                            ) : (
                                itemsToPrint.map((p, i) => (
                                    <div
                                        key={`${p.id}-${i}`}

                                        style={{ border: gridSettings.showCutMarks ? '1px dashed #ddd' : 'none' }}
                                    >
                                        <BarcodeLabel uniqueKey={i} product={p} storeName={prefs?.storeName || 'Store'} settings={settings} prefs={prefs} />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
