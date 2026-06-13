import React from 'react';
import { ScanLine, Folder, Truck, Tag, DollarSign, Calculator, Package, Minus, Plus, FileText, Layers, Printer, Copy, Search, Trash2, Settings } from 'lucide-react';
import { Modal, Badge } from '../../../components/ui';
import { Product, AppPreferences, NotifyFunction } from '../../../core/types';
import { formatCurrency } from '../../../core/utils';

interface ScannedProductModalProps {
    scannedProduct: Product | null;
    onClose: () => void;
    prefs: AppPreferences;
    onInitEdit: (product: Product) => void;
    onDelete: (id: string) => void;
    onDuplicate: (product: Product) => void;
    onAddToPrintQueue: (product: Product, qty: number) => void;
    onUpdateStock: (product: Product, change: number) => void;
    onSearch: (query: string) => void;
    setScannedProduct: (product: Product | null) => void;
    notify: NotifyFunction;
}

const resolveImage = (img: string | undefined) => {
    if (!img) return null;
    if (img.startsWith('data') || img.startsWith('http')) return img;
    if (img.includes('.')) return `/local-image/${img}`;
    return null;
};

export const ScannedProductModal = ({
    scannedProduct, onClose, prefs, onInitEdit, onDelete, onDuplicate,
    onAddToPrintQueue, onUpdateStock, onSearch, setScannedProduct, notify
}: ScannedProductModalProps) => {

    if (!scannedProduct) return null;

    const profitMargin = scannedProduct.cost > 0 ? ((scannedProduct.price - scannedProduct.cost) / scannedProduct.cost * 100) : 0;
    const profitAmount = scannedProduct.price - (scannedProduct.cost || 0);
    const stockValue = scannedProduct.stock * scannedProduct.price;
    const abcClass = stockValue > 100000 ? 'A' : stockValue > 50000 ? 'B' : 'C';

    return (
        <Modal title="" onClose={onClose} size="lg">
            <div className="space-y-6 -mt-4">
                {/* Premium Header with Gradient */}
                <div className="relative bg-gradient-to-br from-primary/10 via-purple-500/5 to-blue-500/10 rounded-3xl p-6 border border-primary/20 overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-primary rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl"></div>
                    </div>

                    <div className="relative flex gap-5 items-start">
                        {/* Large Product Image */}
                        <div className="w-28 h-28 rounded-2xl bg-surface border-2 border-border flex items-center justify-center overflow-hidden shrink-0 shadow-xl">
                            {resolveImage(scannedProduct.image) ? (
                                <img src={resolveImage(scannedProduct.image)!} className="w-full h-full object-cover" alt={scannedProduct.name} />
                            ) : (
                                <span className="text-6xl">{scannedProduct.image || '📦'}</span>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            {/* Status Badges */}
                            <div className="flex gap-2 mb-2 flex-wrap">
                                <Badge type={scannedProduct.stock === 0 ? 'error' : scannedProduct.stock <= (scannedProduct.minStock || 5) ? 'warning' : 'success'}
                                    text={scannedProduct.stock === 0 ? 'نافذ' : scannedProduct.stock <= (scannedProduct.minStock || 5) ? 'مخزون منخفض' : 'متوفر'} />
                                <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-lg border ${abcClass === 'A' ? 'bg-green-500/10 text-green-500 border-green-500/20' : abcClass === 'B' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
                                    تصنيف {abcClass}
                                </span>
                            </div>

                            {/* Product Name */}
                            <h2 className="font-black text-text-main text-xl leading-tight">{scannedProduct.name}</h2>

                            {/* Barcode & Category */}
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <span className="text-text-muted text-xs font-mono flex items-center gap-1.5 bg-bg/50 px-2 py-1 rounded-lg border border-border">
                                    <ScanLine size={12} className="text-primary" /> {scannedProduct.barcode}
                                </span>
                                <span className="text-[11px] text-text-muted flex items-center gap-1.5 bg-bg/50 px-2 py-1 rounded-lg border border-border">
                                    <Folder size={12} /> {scannedProduct.category}
                                </span>
                                {scannedProduct.supplier && (
                                    <span className="text-[11px] text-text-muted flex items-center gap-1.5 bg-bg/50 px-2 py-1 rounded-lg border border-border">
                                        <Truck size={12} /> {scannedProduct.supplier}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Selling Price */}
                    <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-4 rounded-2xl border border-primary/20 group hover:border-primary/40 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                                <Tag size={14} className="text-primary" />
                            </div>
                            <p className="text-[10px] text-text-muted font-bold uppercase">سعر البيع</p>
                        </div>
                        <p className="font-mono font-black text-primary text-2xl">{formatCurrency(scannedProduct.price, prefs.currency).replace(prefs.currency, '')}</p>
                        <p className="text-[9px] text-text-muted mt-1">دينار عراقي</p>
                    </div>

                    {/* Cost Price */}
                    <div className="bg-surface p-4 rounded-2xl border border-border group hover:border-sky-500/30 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                                <DollarSign size={14} className="text-sky-500" />
                            </div>
                            <p className="text-[10px] text-text-muted font-bold uppercase">التكلفة</p>
                        </div>
                        <p className="font-mono font-bold text-text-main text-xl">{formatCurrency(scannedProduct.cost || 0, prefs.currency).replace(prefs.currency, '')}</p>
                        <p className="text-[9px] text-text-muted mt-1">سعر الشراء</p>
                    </div>

                    {/* Profit */}
                    <div className="bg-surface p-4 rounded-2xl border border-border group hover:border-green-500/30 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <Calculator size={14} className="text-green-500" />
                            </div>
                            <p className="text-[10px] text-text-muted font-bold uppercase">الربح</p>
                        </div>
                        <p className="font-mono font-bold text-green-500 text-xl">{formatCurrency(profitAmount, prefs.currency).replace(prefs.currency, '')}</p>
                        <p className={`text-[10px] mt-1 font-bold ${profitMargin >= 20 ? 'text-green-500' : profitMargin >= 10 ? 'text-orange-500' : 'text-red-500'}`}>
                            {profitMargin.toFixed(1)}% هامش ربح
                        </p>
                    </div>

                    {/* Stock with Quick Adjust */}
                    <div className="bg-surface p-4 rounded-2xl border border-border group hover:border-blue-500/30 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${scannedProduct.stock === 0 ? 'bg-red-500/10' : scannedProduct.stock <= (scannedProduct.minStock || 5) ? 'bg-orange-500/10' : 'bg-blue-500/10'}`}>
                                    <Package size={14} className={scannedProduct.stock === 0 ? 'text-red-500' : scannedProduct.stock <= (scannedProduct.minStock || 5) ? 'text-orange-500' : 'text-blue-500'} />
                                </div>
                                <p className="text-[10px] text-text-muted font-bold uppercase">المخزون</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <p className={`font-mono font-black text-2xl ${scannedProduct.stock === 0 ? 'text-red-500' : scannedProduct.stock <= (scannedProduct.minStock || 5) ? 'text-orange-500' : 'text-text-main'}`}>
                                {scannedProduct.stock}
                            </p>
                            {/* Quick Stock Adjust */}
                            <div className="flex items-center gap-1 bg-bg rounded-lg p-1 border border-border">
                                <button
                                    onClick={() => { onUpdateStock(scannedProduct, -1); setScannedProduct({ ...scannedProduct, stock: Math.max(0, scannedProduct.stock - 1) }); }}
                                    className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                                    aria-label="إنقاص المخزون"
                                >
                                    <Minus size={14} />
                                </button>
                                <button
                                    onClick={() => { onUpdateStock(scannedProduct, 1); setScannedProduct({ ...scannedProduct, stock: scannedProduct.stock + 1 }); }}
                                    className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-green-500 hover:bg-green-500/10 rounded-md transition-all"
                                    aria-label="زيادة المخزون"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                        <p className="text-[9px] text-text-muted mt-1">الحد الأدنى: {scannedProduct.minStock || 5}</p>
                    </div>
                </div>

                {/* Description */}
                {scannedProduct.description && (
                    <div className="bg-bg p-4 rounded-2xl border border-border">
                        <div className="flex items-center gap-2 mb-2">
                            <FileText size={14} className="text-text-muted" />
                            <p className="text-[10px] text-text-muted font-bold uppercase">الوصف</p>
                        </div>
                        <p className="text-sm text-text-main leading-relaxed">{scannedProduct.description}</p>
                    </div>
                )}

                {/* Stock Value Info */}
                <div className="bg-gradient-to-r from-emerald-500/5 to-teal-500/5 p-4 rounded-2xl border border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <Layers size={18} className="text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-[10px] text-text-muted font-bold uppercase">قيمة المخزون (بسعر البيع)</p>
                            <p className="font-mono font-black text-emerald-500 text-lg">{formatCurrency(stockValue, prefs.currency).replace(prefs.currency, '')} <span className="text-xs font-normal">{prefs.currency}</span></p>
                        </div>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] text-text-muted font-bold">الربح المتوقع</p>
                        <p className="font-mono font-bold text-green-500">{formatCurrency(profitAmount * scannedProduct.stock, prefs.currency).replace(prefs.currency, '')}</p>
                    </div>
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <button
                        onClick={() => { onAddToPrintQueue(scannedProduct, 1); notify('تمت الإضافة لقائمة الطباعة', 'success'); }}
                        className="p-3 bg-surface hover:bg-surface-hover text-text-main border border-border rounded-xl font-bold text-xs flex flex-col items-center gap-2 transition-all hover:border-primary/30 group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-bg group-hover:bg-primary/10 flex items-center justify-center transition-all">
                            <Printer size={18} className="group-hover:text-primary transition-colors" />
                        </div>
                        طباعة ملصق
                    </button>

                    <button
                        onClick={() => { onDuplicate(scannedProduct); setScannedProduct(null); }}
                        className="p-3 bg-surface hover:bg-surface-hover text-text-main border border-border rounded-xl font-bold text-xs flex flex-col items-center gap-2 transition-all hover:border-blue-500/30 group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-bg group-hover:bg-blue-500/10 flex items-center justify-center transition-all">
                            <Copy size={18} className="group-hover:text-blue-500 transition-colors" />
                        </div>
                        نسخ المنتج
                    </button>

                    <button
                        onClick={() => { onSearch(scannedProduct.barcode); setScannedProduct(null); }}
                        className="p-3 bg-surface hover:bg-surface-hover text-text-main border border-border rounded-xl font-bold text-xs flex flex-col items-center gap-2 transition-all hover:border-purple-500/30 group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-bg group-hover:bg-purple-500/10 flex items-center justify-center transition-all">
                            <Search size={18} className="group-hover:text-purple-500 transition-colors" />
                        </div>
                        عرض في القائمة
                    </button>

                    <button
                        onClick={() => { if (scannedProduct.id) onDelete(scannedProduct.id); setScannedProduct(null); }}
                        className="p-3 bg-surface hover:bg-red-500/5 text-text-main border border-border rounded-xl font-bold text-xs flex flex-col items-center gap-2 transition-all hover:border-red-500/30 group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-bg group-hover:bg-red-500/10 flex items-center justify-center transition-all">
                            <Trash2 size={18} className="group-hover:text-red-500 transition-colors" />
                        </div>
                        حذف المنتج
                    </button>
                </div>

                {/* Main Action */}
                <button
                    onClick={() => { onInitEdit(scannedProduct); setScannedProduct(null); }}
                    className="w-full bg-gradient-to-r from-primary to-primary/80 text-black font-black py-4 rounded-2xl hover:brightness-110 shadow-xl shadow-primary/30 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-3"
                >
                    <Settings size={18} /> تعديل المنتج بالكامل
                </button>
            </div>
        </Modal>
    );
};
