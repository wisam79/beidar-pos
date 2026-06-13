import React, { useRef } from 'react';
import { Package, History, DollarSign, RefreshCw, Sparkles, Layers, FileText, Trash2, Copy, Upload, Image as ImageIcon, X } from 'lucide-react';
import { Modal, EmptyState, Badge } from '../ui';
import { formatCurrency, compressImage } from '../../core/utils';
import { Product, AppPreferences, CategoryDef } from '../../core/types';
import { ErrorMessage, FieldError } from '../ErrorMessage';

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingProduct: Product | null;
    form: Partial<Product>;
    setForm: (form: Partial<Product>) => void;
    activeTab: 'details' | 'history';
    setActiveTab: (tab: 'details' | 'history') => void;
    categories: CategoryDef[];
    suppliers: { id: string; name: string; companyName: string }[];
    errors: Record<string, string>;
    isGenerating: boolean;
    prefs: AppPreferences;
    productHistory: { id: string; qty: number; type: string; timestamp: string; reason?: string }[];
    onSave: () => void;
    onDelete: (id: string) => void;
    onDuplicate: (product: Product) => void;
    onAiGenerateDescription: () => void;
    onAiSuggestPrice: () => void;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    activeCategoryDef?: CategoryDef;
    onImproveText: (field: 'name' | 'description') => void;
}

export const ProductFormModal = ({
    isOpen, onClose, editingProduct, form, setForm, activeTab, setActiveTab,
    categories, suppliers, errors, isGenerating, prefs, productHistory,
    onSave, onDelete, onDuplicate, onAiGenerateDescription, onAiSuggestPrice, onImageUpload,
    activeCategoryDef, onImproveText
}: ProductFormModalProps) => {

    if (!isOpen) return null;

    return (
        <Modal title={editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'} onClose={onClose} size="lg">
            <div className="flex flex-col h-[75vh]">
                {/* Header with Icon */}
                {!editingProduct && (
                    <div className="flex items-center gap-4 pb-5 mb-5 border-b border-border">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Package size={28} className="text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-text-main">إضافة منتج جديد</h3>
                            <p className="text-text-muted text-xs">أدخل تفاصيل المنتج الجديد لإضافته للمخزون</p>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 bg-bg p-1 rounded-2xl mb-6 border border-border">
                    <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'details' ? 'bg-surface text-text-main shadow-sm border border-border' : 'text-text-muted hover:text-text-main'}`}>
                        <Package size={14} /> تفاصيل المنتج
                    </button>
                    {editingProduct && (
                        <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-surface text-text-main shadow-sm border border-border' : 'text-text-muted hover:text-text-main'}`}>
                            <History size={14} /> سجل الحركات
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                    {activeTab === 'details' ? (
                        <div className="space-y-6">
                            {/* Image & Basic Info */}
                            <div className="flex gap-6">
                                <div className="group relative">
                                    <div className={`w-36 h-36 rounded-3xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden ${form.image ? 'border-transparent bg-surface relative' : 'border-border hover:border-primary/50 hover:bg-primary/5'}`}>
                                        {form.image ? (
                                            form.image.startsWith('data') ? <img src={form.image} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" alt="Product" /> : <span className="text-6xl group-hover:scale-110 transition-transform block">{form.image}</span>
                                        ) : (
                                            <div className="text-center group-hover:scale-105 transition-transform">
                                                <div className="w-12 h-12 rounded-xl bg-bg border border-border flex items-center justify-center mx-auto mb-2 text-text-muted"><ImageIcon size={20} /></div>
                                                <span className="text-[10px] text-text-muted font-bold block">اضغط للرفع</span>
                                            </div>
                                        )}
                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                            <label className="cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-md p-2 rounded-xl text-white transition-all transform hover:scale-110" aria-label="Upload Image">
                                                <Upload size={16} />
                                                <input type="file" className="hidden" accept="image/*" onChange={onImageUpload} />
                                            </label>
                                            {form.image && <button onClick={() => setForm({ ...form, image: '' })} className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-xl backdrop-blur-md transition-all transform hover:scale-110" aria-label="Remove Image"><Trash2 size={16} /></button>}
                                        </div>
                                    </div>
                                    {form.image && !form.image.startsWith('data') && <p className="text-[9px] text-center mt-2 text-text-muted font-mono">{form.image}</p>}
                                </div>

                                <div className="flex-1 space-y-4">
                                    {/* Name Input */}
                                    <div className="relative group">
                                        <label className="text-[10px] text-text-muted font-bold uppercase mb-1.5 flex justify-between">
                                            اسم المنتج <span className="text-red-500">*</span>
                                            <button onClick={() => onImproveText('name')} disabled={isGenerating || !form.name} className="flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"><Sparkles size={10} /> تحسين الاسم</button>
                                        </label>
                                        <input
                                            className={`w-full bg-input-bg border ${errors.name ? 'border-red-500' : 'border-border'} text-text-main rounded-xl px-4 py-3 outline-none focus:border-primary focus:shadow-glow font-bold text-sm transition-all`}
                                            placeholder="مثال: عصير برتقال طبيعي"
                                            value={form.name || ''}
                                            onChange={e => { setForm({ ...form, name: e.target.value }); if (errors.name) delete errors.name; }}
                                        />
                                        <FieldError error={errors.name} hint="أدخل اسماً واضحاً للمنتج (على الأقل 2 أحرف)" />
                                    </div>

                                    {/* Barcode Input */}
                                    <div className="relative">
                                        <label className="text-[10px] text-text-muted font-bold uppercase mb-1.5 block">الباركود</label>
                                        <div className="relative">
                                            <input
                                                className={`w-full bg-input-bg border ${errors.barcode ? 'border-red-500' : 'border-border'} text-text-main rounded-xl px-4 py-3 outline-none focus:border-primary font-mono font-bold text-sm transition-all`}
                                                placeholder="Scan or type..."
                                                value={form.barcode || ''}
                                                onChange={e => setForm({ ...form, barcode: e.target.value })}
                                            />
                                            <button className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-surface rounded-lg text-text-muted transition-colors opacity-50 hover:opacity-100" title="Generate Random">
                                                <RefreshCw size={14} />
                                            </button>
                                        </div>
                                        <FieldError error={errors.barcode} hint="اتركه فارغاً للتوليد التلقائي أو أدخل باركوداً فريداً" />
                                    </div>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Category Select */}
                                <div>
                                    <label className="text-[10px] text-text-muted font-bold uppercase mb-1.5 block">الفئة</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-input-bg border border-border text-text-main rounded-xl px-4 py-3 outline-none focus:border-primary font-bold text-sm appearance-none transition-all"
                                            value={form.category}
                                            onChange={e => setForm({ ...form, category: e.target.value })}
                                            aria-label="Product Category"
                                        >
                                            <option value="General">عام</option>
                                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted opacity-50"><Layers size={14} /></div>
                                    </div>
                                </div>

                                {/* Supplier Select */}
                                <div>
                                    <label className="text-[10px] text-text-muted font-bold uppercase mb-1.5 block">المورد</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-input-bg border border-border text-text-main rounded-xl px-4 py-3 outline-none focus:border-primary font-bold text-sm appearance-none transition-all"
                                            value={form.supplier || ''}
                                            onChange={e => setForm({ ...form, supplier: e.target.value })}
                                            aria-label="Supplier"
                                        >
                                            <option value="">(اختياري)</option>
                                            {suppliers.map(s => <option key={s.id} value={s.companyName}>{s.companyName}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Pricing & Stock Section */}
                            <div className="bg-bg p-5 rounded-3xl border border-border">
                                <h4 className="text-xs font-bold text-text-muted mb-4 flex items-center gap-2">
                                    <DollarSign size={14} /> السعر والمخزون
                                </h4>
                                <div className="grid grid-cols-4 gap-4">
                                    {/* Selling Price */}
                                    <div>
                                        <label className="flex justify-between items-center text-xs text-text-muted font-bold mb-2">
                                            سعر البيع
                                            <button
                                                onClick={onAiSuggestPrice}
                                                disabled={isGenerating}
                                                className="text-purple-400 hover:text-purple-300 text-[10px] flex items-center gap-1 bg-purple-500/10 px-2 py-1 rounded-lg hover:bg-purple-500/20 transition-all"
                                                title="اقتراح السعر بالذكاء الاصطناعي"
                                            >
                                                {isGenerating ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />} AI
                                            </button>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="w-full bg-input-bg border border-border text-text-main rounded-xl px-4 py-3 outline-none focus:border-primary font-mono font-bold text-sm pl-14 transition-all"
                                                value={form.price}
                                                onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                                                placeholder="0"
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted">{prefs.currency}</span>
                                        </div>
                                        <FieldError error={errors.price} hint="أدخل سعراً صحيحاً بالدينار العراقي (مثال: 5000)" />
                                    </div>

                                    {/* Cost Price */}
                                    <div>
                                        <label className="flex items-center gap-2 text-xs text-text-muted font-bold mb-2">
                                            سعر التكلفة
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="w-full bg-input-bg border border-border text-text-main rounded-xl px-4 py-3 outline-none focus:border-primary font-mono font-bold text-sm pl-14 transition-all"
                                                value={form.cost}
                                                onChange={e => setForm({ ...form, cost: Number(e.target.value) })}
                                                placeholder="0"
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted">{prefs.currency}</span>
                                        </div>
                                    </div>

                                    {/* Wholesale Price - New Field */}
                                    <div>
                                        <label className="flex items-center gap-2 text-xs text-text-muted font-bold mb-2">
                                            سعر الجملة
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="w-full bg-input-bg border border-border text-text-main rounded-xl px-4 py-3 outline-none focus:border-primary font-mono font-bold text-sm pl-14 transition-all"
                                                value={form.wholesalePrice}
                                                onChange={e => setForm({ ...form, wholesalePrice: Number(e.target.value) })}
                                                placeholder="0"
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted">{prefs.currency}</span>
                                        </div>
                                    </div>

                                    {/* Stock */}
                                    <div>
                                        <label className="flex items-center gap-2 text-xs text-text-muted font-bold mb-2">
                                            <Package size={12} /> المخزون
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full bg-input-bg border border-border text-text-main rounded-xl px-4 py-3 outline-none focus:border-primary font-mono font-bold text-sm transition-all"
                                            value={form.stock}
                                            onChange={e => setForm({ ...form, stock: Number(e.target.value) })}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {/* Profit Indicator */}
                                {(form.price ?? 0) > 0 && (form.cost ?? 0) > 0 && (
                                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                                        <span className="text-xs text-text-muted font-bold">هامش الربح</span>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-bold text-text-main">{formatCurrency((form.price ?? 0) - (form.cost ?? 0), prefs.currency).replace(prefs.currency, '')} {prefs.currency}</span>
                                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${(((form.price ?? 0) - (form.cost ?? 0)) / (form.cost ?? 1) * 100) >= 20 ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-orange-500/10 text-orange-500 border border-orange-500/20'}`}>
                                                {(((form.price ?? 0) - (form.cost ?? 0)) / (form.cost ?? 1) * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Custom Fields based on Category */}
                            {activeCategoryDef?.fields && activeCategoryDef.fields.length > 0 && (
                                <div className="space-y-3 border-t border-border pt-4">
                                    <h4 className="text-xs font-bold text-text-muted">خصائص {form.category}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {activeCategoryDef.fields.map((field, i) => (
                                            <div key={i}>
                                                <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">{field.name}</label>
                                                {field.type === 'select' ? (
                                                    <select
                                                        className="w-full bg-input-bg border border-border text-text-main rounded-xl px-4 py-2.5 outline-none focus:border-primary font-bold text-xs"
                                                        value={String(form.customDetails?.[field.name] ?? '')}
                                                        onChange={e => setForm({ ...form, customDetails: { ...form.customDetails, [field.name]: e.target.value } })}
                                                        aria-label={field.name}
                                                    >
                                                        <option value="">اختر...</option>
                                                        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type={field.type === 'number' ? 'number' : 'text'}
                                                        className="w-full bg-input-bg border border-border text-text-main rounded-xl px-4 py-2.5 outline-none focus:border-primary font-bold text-sm"
                                                        value={String(form.customDetails?.[field.name] ?? '')}
                                                        onChange={e => setForm({ ...form, customDetails: { ...form.customDetails, [field.name]: e.target.value } })}
                                                        aria-label={field.name}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="relative">
                                <textarea className="w-full bg-input-bg border border-border text-text-main rounded-xl p-4 outline-none focus:border-primary text-sm h-24 resize-none" placeholder="وصف إضافي للمنتج..." value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
                                <button
                                    onClick={onAiGenerateDescription}
                                    disabled={isGenerating}
                                    className="absolute bottom-2 left-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-purple-400 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-sm backdrop-blur-sm"
                                >
                                    {isGenerating ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />} توليد وصف
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {productHistory.length === 0 ? <EmptyState icon={History} title="لا توجد حركات" description="لم يتم تسجيل أي عمليات بيع أو تعديل لهذا المنتج." /> :
                                productHistory.map(m => (
                                    <div key={m.id} className="flex justify-between items-center bg-surface-hover p-3 rounded-xl border border-border">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Badge type={m.type === 'sale' ? 'success' : m.type === 'restock' ? 'info' : 'warning'} text={m.type === 'sale' ? 'بيع' : m.type === 'restock' ? 'إضافة' : 'تعديل'} />
                                                <span className="text-xs text-text-muted font-bold">{new Date(m.timestamp).toLocaleDateString('en-GB')}</span>
                                            </div>
                                            {m.reason && <p className="text-[10px] text-text-muted mt-1">{m.reason}</p>}
                                        </div>
                                        <span className={`font-mono font-black text-lg ${m.qty > 0 ? 'text-green-500' : 'text-red-500'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</span>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-border flex gap-3 mt-auto">
                    {editingProduct && (
                        <button onClick={() => onDelete(editingProduct.id!)} className="px-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all" aria-label="حذف المنتج" title="حذف المنتج"><Trash2 size={20} /></button>
                    )}
                    {editingProduct && (
                        <button onClick={() => onDuplicate(editingProduct)} className="px-4 bg-surface hover:bg-surface-hover text-text-muted border border-border rounded-xl hover:text-text-main transition-all" title="نسخ المنتج"><Copy size={20} /></button>
                    )}
                    <button onClick={onSave} className="flex-1 bg-primary text-primary-fg font-black py-4 rounded-xl hover:brightness-110 shadow-[0_0_20px_var(--color-primary-dim)] active:scale-95 transition-all text-sm">حفظ التغييرات</button>
                </div>
            </div >
        </Modal >
    );
};
