import React, { useRef } from 'react';
import { Package, History, DollarSign, RefreshCw, Sparkles, Layers, FileText, Trash2, Copy, Upload, Image as ImageIcon, X } from 'lucide-react';
import { Modal, EmptyState, Badge } from '../../../components/ui';
import { formatCurrency, compressImage } from '../../../core/utils';
import { Product, AppPreferences, CategoryDef } from '../../../core/types';
import { ErrorMessage, FieldError } from '../../../components/ErrorMessage';

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
            <div className="flex flex-col h-[78vh] max-h-[720px]">
                {/* Modern Sleek Tab Switcher */}
                <div className="flex gap-1 bg-surface-hover/60 backdrop-blur-md p-1 rounded-xl mb-4 border border-border/60 shrink-0">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`flex-1 py-2 px-4 rounded-lg text-xs font-black transition-all duration-200 flex items-center justify-center gap-2 ${
                            activeTab === 'details'
                                ? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary border border-primary/20 shadow-sm shadow-primary/5'
                                : 'text-text-muted hover:text-text-main'
                        }`}
                    >
                        <Package size={14} className={activeTab === 'details' ? 'animate-pulse' : ''} /> تفاصيل المنتج
                    </button>
                    {editingProduct && (
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 py-2 px-4 rounded-lg text-xs font-black transition-all duration-200 flex items-center justify-center gap-2 ${
                                activeTab === 'history'
                                    ? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary border border-primary/20 shadow-sm shadow-primary/5'
                                    : 'text-text-muted hover:text-text-main'
                            }`}
                        >
                            <History size={14} /> سجل الحركات
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-2">
                    {activeTab === 'details' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                            {/* Right Column: Identity, Media & Categorization (col-span-5) */}
                            <div className="lg:col-span-5 bg-surface-hover/10 rounded-2xl border border-border/40 p-5 space-y-4">
                                <h4 className="text-xs font-black text-text-muted flex items-center gap-2 border-b border-border/30 pb-2">
                                    <Package size={14} className="text-primary" /> هوية وبيانات المنتج
                                </h4>

                                {/* Centered Premium Uploader Box */}
                                <div className="flex flex-col items-center justify-center pb-2">
                                    <div className="group relative">
                                        <div className={`w-28 h-28 rounded-2xl border border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 overflow-hidden relative ${
                                            form.image 
                                                ? 'border-transparent bg-bg shadow-md ring-1 ring-border' 
                                                : 'border-border/80 bg-input-bg hover:border-primary/50 hover:bg-primary/5 hover:shadow-[0_0_15px_var(--color-primary-dim)]'
                                        }`}>
                                            {form.image ? (
                                                form.image.startsWith('data') ? (
                                                    <img src={form.image} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" alt="Product" />
                                                ) : (
                                                    <span className="text-5xl group-hover:scale-110 transition-transform duration-300 block select-none">{form.image}</span>
                                                )
                                            ) : (
                                                <div className="text-center group-hover:scale-105 transition-transform duration-300">
                                                    <div className="w-9 h-9 rounded-xl bg-bg border border-border flex items-center justify-center mx-auto mb-1.5 text-text-muted"><ImageIcon size={16} /></div>
                                                    <span className="text-[9px] text-text-muted font-bold block select-none">اضغط للرفع</span>
                                                </div>
                                            )}
                                            {/* Overlay Actions */}
                                            <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-1.5 backdrop-blur-[2px]">
                                                <label className="cursor-pointer bg-white/10 hover:bg-white/20 border border-white/20 p-1.5 rounded-lg text-white transition-all transform hover:scale-110" aria-label="Upload Image">
                                                    <Upload size={14} />
                                                    <input type="file" className="hidden" accept="image/*" onChange={onImageUpload} />
                                                </label>
                                                {form.image && (
                                                    <button 
                                                        onClick={() => setForm({ ...form, image: '' })} 
                                                        className="bg-red-500/80 hover:bg-red-500 border border-red-500/20 text-white p-1.5 rounded-lg transition-all transform hover:scale-110" 
                                                        aria-label="Remove Image"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {form.image && !form.image.startsWith('data') && <p className="text-[9px] text-center mt-1.5 text-text-muted font-mono font-bold select-none">{form.image}</p>}
                                    </div>
                                </div>

                                {/* Name Input with AI integrated inside */}
                                <div className="relative group">
                                    <label className="text-[10px] text-text-muted font-black mb-1.5 block">
                                        اسم المنتج <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            className={`w-full h-10 bg-input-bg border ${errors.name ? 'border-red-500' : 'border-border/80 focus:border-primary/80'} text-text-main rounded-xl pl-10 pr-4 outline-none font-bold text-sm transition-all duration-200`}
                                            placeholder="عصير برتقال طبيعي..."
                                            value={form.name || ''}
                                            onChange={e => { setForm({ ...form, name: e.target.value }); if (errors.name) delete errors.name; }}
                                        />
                                        <button 
                                            onClick={() => onImproveText('name')} 
                                            disabled={isGenerating || !form.name} 
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300 disabled:opacity-30 transition-colors"
                                            title="تحسين الاسم بالذكاء الاصطناعي"
                                        >
                                            <Sparkles size={14} />
                                        </button>
                                    </div>
                                    <FieldError error={errors.name} hint="أدخل اسماً واضحاً للمنتج (على الأقل 2 أحرف)" />
                                </div>

                                {/* Barcode Input */}
                                <div className="relative">
                                    <label className="text-[10px] text-text-muted font-black mb-1.5 block">الباركود (رمز المنتج)</label>
                                    <div className="relative">
                                        <input
                                            className={`w-full h-10 bg-input-bg border ${errors.barcode ? 'border-red-500' : 'border-border/80 focus:border-primary/80'} text-text-main rounded-xl pl-10 pr-4 outline-none font-mono font-bold text-sm transition-all duration-200`}
                                            placeholder="Scan or type..."
                                            value={form.barcode || ''}
                                            onChange={e => setForm({ ...form, barcode: e.target.value })}
                                        />
                                        <button className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-surface rounded-lg text-text-muted transition-colors opacity-50 hover:opacity-100" title="توليد باركود عشوائي">
                                            <RefreshCw size={12} />
                                        </button>
                                    </div>
                                    <FieldError error={errors.barcode} hint="اترك فارغاً للإنشاء التلقائي أو أدخل باركوداً فريداً" />
                                </div>

                                <div className="border-t border-border/30 my-4" />

                                {/* Categorization Row */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Category Select */}
                                    <div>
                                        <label className="text-[10px] text-text-muted font-black mb-1.5 block">الفئة</label>
                                        <div className="relative">
                                            <select
                                                className="w-full h-10 bg-input-bg border border-border/80 focus:border-primary/80 text-text-main rounded-xl px-4 outline-none font-bold text-sm appearance-none transition-all cursor-pointer"
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
                                        <label className="text-[10px] text-text-muted font-black mb-1.5 block">المورد</label>
                                        <div className="relative">
                                            <select
                                                className="w-full h-10 bg-input-bg border border-border/80 focus:border-primary/80 text-text-main rounded-xl px-4 outline-none font-bold text-sm appearance-none transition-all cursor-pointer"
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

                                <div className="border-t border-border/30 my-4" />

                                {/* Description Box */}
                                <div className="relative">
                                    <label className="text-[10px] text-text-muted font-black mb-1.5 block">وصف وتفاصيل إضافية</label>
                                    <textarea
                                        className="w-full bg-input-bg border border-border/80 focus:border-primary/80 text-text-main rounded-xl p-3 outline-none text-xs h-24 resize-none transition-all placeholder:text-text-muted/40 font-bold"
                                        placeholder="تفاصيل المنتج أو ملاحظات الاستخدام..."
                                        value={form.description || ''}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                    />
                                    <button
                                        onClick={onAiGenerateDescription}
                                        disabled={isGenerating}
                                        className="absolute bottom-3 left-3 bg-gradient-to-r from-purple-500/15 to-blue-500/15 hover:from-purple-500/30 hover:to-blue-500/30 border border-purple-500/30 text-purple-400 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black flex items-center gap-1.5 transition-all shadow-sm backdrop-blur-sm active:scale-95 duration-100 hover:shadow-[0_0_15px_rgba(147,51,234,0.15)]"
                                    >
                                        {isGenerating ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />} توليد وصف ذكي
                                    </button>
                                </div>
                            </div>

                            {/* Left Column: Pricing, Inventory & Custom Attributes (col-span-7) */}
                            <div className="lg:col-span-7 bg-surface-hover/10 rounded-2xl border border-border/40 p-5 space-y-4">
                                <h4 className="text-xs font-black text-text-muted flex items-center gap-2 border-b border-border/30 pb-2">
                                    <DollarSign size={14} className="text-primary" /> تفاصيل الأسعار والمخزون
                                </h4>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Selling Price with Sparkles inside */}
                                    <div>
                                        <label className="block text-[10px] text-text-muted font-black mb-1.5">
                                            سعر البيع <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className={`w-full h-10 bg-input-bg border ${errors.price ? 'border-red-500' : 'border-border/80 focus:border-primary/80'} text-text-main rounded-xl pl-16 pr-10 outline-none font-mono font-bold text-sm transition-all duration-200`}
                                                value={form.price || ''}
                                                onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                                                placeholder="0"
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted">{prefs.currency}</span>
                                            <button 
                                                onClick={onAiSuggestPrice} 
                                                disabled={isGenerating} 
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300 disabled:opacity-30 transition-colors"
                                                title="اقتراح السعر بالذكاء الاصطناعي"
                                            >
                                                {isGenerating ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            </button>
                                        </div>
                                        <FieldError error={errors.price} hint="أدخل سعراً صحيحاً للمنتج" />
                                    </div>

                                    {/* Cost Price */}
                                    <div>
                                        <label className="text-[10px] text-text-muted font-black mb-1.5 block">سعر التكلفة</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="w-full h-10 bg-input-bg border border-border/80 focus:border-primary/80 text-text-main rounded-xl pl-16 pr-4 outline-none font-mono font-bold text-sm transition-all duration-200"
                                                value={form.cost || ''}
                                                onChange={e => setForm({ ...form, cost: Number(e.target.value) })}
                                                placeholder="0"
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted">{prefs.currency}</span>
                                        </div>
                                    </div>

                                    {/* Wholesale Price */}
                                    <div>
                                        <label className="text-[10px] text-text-muted font-black mb-1.5 block">سعر الجملة</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="w-full h-10 bg-input-bg border border-border/80 focus:border-primary/80 text-text-main rounded-xl pl-16 pr-4 outline-none font-mono font-bold text-sm transition-all duration-200"
                                                value={form.wholesalePrice || ''}
                                                onChange={e => setForm({ ...form, wholesalePrice: Number(e.target.value) })}
                                                placeholder="0"
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted">{prefs.currency}</span>
                                        </div>
                                    </div>

                                    {/* Inventory Stock */}
                                    <div>
                                        <label className="text-[10px] text-text-muted font-black mb-1.5 block">المخزون المتوفر</label>
                                        <input
                                            type="number"
                                            className="w-full h-10 bg-input-bg border border-border/80 focus:border-primary/80 text-text-main rounded-xl px-4 outline-none font-mono font-bold text-sm transition-all duration-200"
                                            value={form.stock || ''}
                                            onChange={e => setForm({ ...form, stock: Number(e.target.value) })}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {/* Profit Margin Widget Card */}
                                {((form.price ?? 0) > 0 || (form.cost ?? 0) > 0) && (
                                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4 transition-all duration-300">
                                        <div className="absolute -left-12 -bottom-12 w-28 h-28 bg-primary/15 rounded-full blur-xl pointer-events-none" />
                                        
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="space-y-1">
                                                <span className="text-[10px] text-text-muted font-black block">هامش الربح المتوقع</span>
                                                <span className="text-lg font-black font-mono text-text-main">
                                                    {formatCurrency((form.price ?? 0) - (form.cost ?? 0), prefs.currency).replace(prefs.currency, '')} 
                                                    <span className="text-xs font-bold text-text-muted mr-1">{prefs.currency}</span>
                                                </span>
                                            </div>

                                            <div className="text-left">
                                                <span className="text-[10px] text-text-muted font-black block mb-1">نسبة العائد (ROI)</span>
                                                {form.cost && form.cost > 0 ? (
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold font-mono inline-block ${
                                                        (((form.price ?? 0) - (form.cost ?? 0)) / form.cost * 100) >= 20 
                                                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_2px_10px_rgba(16,185,129,0.06)]' 
                                                            : (((form.price ?? 0) - (form.cost ?? 0)) / form.cost * 100) > 0 
                                                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_2px_10px_rgba(245,158,11,0.06)]' 
                                                                : 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_2px_10px_rgba(239,68,68,0.06)]'
                                                    }`}>
                                                        {(((form.price ?? 0) - (form.cost ?? 0)) / form.cost * 100).toFixed(1)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-black text-text-muted">N/A</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Custom Fields section */}
                                {activeCategoryDef?.fields && activeCategoryDef.fields.length > 0 && (
                                    <>
                                        <div className="border-t border-border/30 my-4" />
                                        <div className="space-y-3.5">
                                            <h4 className="text-xs font-black text-text-muted">
                                                خصائص الفئة ({form.category})
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                {activeCategoryDef.fields.map((field, i) => (
                                                    <div key={i}>
                                                        <label className="block text-[10px] text-text-muted font-black mb-1.5">{field.name}</label>
                                                        {field.type === 'select' ? (
                                                            <div className="relative">
                                                                <select
                                                                    className="w-full bg-input-bg border border-border/80 focus:border-primary/80 text-text-main rounded-xl px-4 h-10 outline-none font-bold text-xs cursor-pointer appearance-none transition-all"
                                                                    value={String(form.customDetails?.[field.name] ?? '')}
                                                                    onChange={e => setForm({ ...form, customDetails: { ...form.customDetails, [field.name]: e.target.value } })}
                                                                    aria-label={field.name}
                                                                >
                                                                    <option value="">اختر...</option>
                                                                    {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                                                </select>
                                                            </div>
                                                        ) : (
                                                            <input
                                                                type={field.type === 'number' ? 'number' : 'text'}
                                                                className="w-full bg-input-bg border border-border/80 focus:border-primary/80 text-text-main rounded-xl px-4 h-10 outline-none font-bold text-sm transition-all"
                                                                value={String(form.customDetails?.[field.name] ?? '')}
                                                                onChange={e => setForm({ ...form, customDetails: { ...form.customDetails, [field.name]: e.target.value } })}
                                                                aria-label={field.name}
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* History tab */
                        <div className="space-y-3.5 pt-2">
                            {productHistory.length === 0 ? (
                                <EmptyState icon={History} title="لا توجد حركات مسجلة" description="لم يتم تسجيل أي عمليات بيع، إضافة أو تعديل لهذا المنتج بعد." />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {productHistory.map(m => (
                                        <div key={m.id} className="flex justify-between items-center bg-surface-hover/20 backdrop-blur-md p-4 rounded-2xl border border-border/60 transition-all duration-200 hover:border-border hover:shadow-card">
                                            <div>
                                                <div className="flex items-center gap-2.5">
                                                    <Badge 
                                                        type={m.type === 'sale' ? 'success' : m.type === 'restock' ? 'info' : 'warning'} 
                                                        text={m.type === 'sale' ? 'مبيعات' : m.type === 'restock' ? 'توريد مخزون' : 'تحديث بيانات'} 
                                                    />
                                                    <span className="text-[11px] text-text-muted font-bold">{new Date(m.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                                {m.reason && <p className="text-[10px] text-text-muted/80 mt-2 font-semibold">{m.reason}</p>}
                                            </div>
                                            <span className={`font-mono font-black text-xl ${m.qty > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {m.qty > 0 ? '+' : ''}{m.qty}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Modern Footer Actions */}
                <div className="pt-4 border-t border-border/60 flex gap-3 mt-auto shrink-0 bg-surface/98 backdrop-blur-lg">
                    {editingProduct && (
                        <button 
                            onClick={() => onDelete(editingProduct.id!)} 
                            className="w-11 h-11 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shrink-0 active:scale-95 duration-100 hover:shadow-[0_0_15px_rgba(239,68,68,0.25)]" 
                            aria-label="حذف المنتج" 
                            title="حذف المنتج"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                    {editingProduct && (
                        <button 
                            onClick={() => onDuplicate(editingProduct)} 
                            className="w-11 h-11 bg-surface-hover hover:bg-surface-hover/80 text-text-muted border border-border/80 rounded-xl hover:text-text-main transition-all flex items-center justify-center shrink-0 active:scale-95 duration-100" 
                            title="نسخ وتكرار المنتج"
                        >
                            <Copy size={18} />
                        </button>
                    )}
                    <button 
                        onClick={onSave} 
                        className="flex-1 h-11 bg-primary text-primary-fg font-black rounded-xl hover:brightness-110 shadow-lg shadow-primary/10 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_20px_var(--color-primary-dim)] duration-200"
                    >
                        {editingProduct ? 'حفظ التغييرات والمزامنة' : 'إضافة المنتج الجديد'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
