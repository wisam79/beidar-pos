import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui';
import { api, Discount } from '../../../core/api';
import {
    Tag, Percent, DollarSign, Calendar, Hash, Trash2,
    Plus, Edit2, Power, Gift, ShoppingBag, Layers, X, Check,
    Sparkles
} from 'lucide-react';
import { formatCurrency } from '../../../core/utils';
import { validateDiscountInput } from '../../../core/schemas/discount.schema';

interface DiscountManagerProps {
    isOpen: boolean;
    onClose: () => void;
    notify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const DISCOUNT_TYPES = [
    { id: 'percentage', name: 'نسبة مئوية', icon: Percent, desc: 'خصم 10%، 20%، إلخ' },
    { id: 'fixed', name: 'مبلغ ثابت', icon: DollarSign, desc: 'خصم 5000 د.ع مثلاً' },
    { id: 'quantity', name: 'خصم الكمية', icon: Layers, desc: 'خصم عند شراء كمية معينة' },
    { id: 'buyXgetY', name: 'اشتري واحصل', icon: Gift, desc: 'اشتري 2 واحصل على 1 مجاناً' },
];

const emptyDiscount: Partial<Discount> = {
    name: '',
    type: 'percentage',
    value: 10,
    minPurchase: 0,
    maxDiscount: 0,
    code: '',
    startDate: '',
    endDate: '',
    usageLimit: 0,
    active: true,
};

export const DiscountManager: React.FC<DiscountManagerProps> = ({ isOpen, onClose, notify }) => {
    const [discounts, setDiscounts] = useState<Discount[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingDiscount, setEditingDiscount] = useState<Partial<Discount> | null>(null);
    const [form, setForm] = useState<Partial<Discount>>(emptyDiscount);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen) loadDiscounts();
    }, [isOpen]);

    const loadDiscounts = async () => {
        setLoading(true);
        try {
            const data = await api.discounts.list();
            setDiscounts(data || []);
        } catch (e) {
            console.error('Failed to load discounts', e);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        // Validate form
        const validation = validateDiscountInput(form);
        if (!validation.success) {
            setErrors(validation.errors || {});
            // Notify the first specific error
            const firstErrorKey = Object.keys(validation.errors || {})[0];
            const firstErrorMsg = (validation.errors || {})[firstErrorKey];
            notify(firstErrorMsg ? `خطأ: ${firstErrorMsg}` : 'يرجى التحقق من المدخلات', 'error');
            return;
        }

        try {
            if (editingDiscount?.id) {
                await api.discounts.update({ ...form, id: editingDiscount.id } as Discount);
                notify('تم تحديث الخصم بنجاح', 'success');
            } else {
                await api.discounts.save(form as Discount);
                notify('تم إنشاء الخصم بنجاح', 'success');
            }
            setShowForm(false);
            setEditingDiscount(null);
            setForm(emptyDiscount);
            setErrors({});
            loadDiscounts();
        } catch (e) {
            notify('فشل في حفظ الخصم', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.discounts.delete(id);
            notify('تم حذف الخصم', 'success');
            loadDiscounts();
        } catch (e) {
            notify('فشل في الحذف', 'error');
        }
    };

    const handleToggle = async (id: string) => {
        try {
            await api.discounts.toggle(id);
            loadDiscounts();
        } catch (e) {
            notify('فشل في تغيير الحالة', 'error');
        }
    };

    const openEdit = (d: Discount) => {
        setEditingDiscount(d);
        setForm(d);
        setShowForm(true);
    };

    const openNew = () => {
        setEditingDiscount(null);
        setForm(emptyDiscount);
        setShowForm(true);
    };

    if (!isOpen) return null;

    return (
        <Modal title="إدارة الخصومات والعروض" onClose={onClose} size="xl">
            <div className="flex gap-6 h-[550px]">

                {/* Left: Form or List */}
                <div className="flex-1 flex flex-col">
                    {showForm ? (
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 p-1">
                            {/* Form Header */}
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                                    <Sparkles className="text-primary" size={20} />
                                    {editingDiscount ? 'تعديل الخصم' : 'خصم جديد'}
                                </h3>
                                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-surface rounded-lg" aria-label="إغلاق النموذج">
                                    <X size={18} className="text-text-muted" />
                                </button>
                            </div>

                            {/* Discount Type */}
                            <div>
                                <label className="block text-xs font-bold text-text-muted mb-2">نوع الخصم</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {DISCOUNT_TYPES.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setForm({ ...form, type: t.id })}
                                            className={`p-3 rounded-xl border text-right transition-all ${form.type === t.id
                                                ? 'bg-primary/10 border-primary text-primary'
                                                : 'bg-surface border-border text-text-muted hover:border-primary/30'
                                                }`}
                                        >
                                            <t.icon size={18} className="mb-1" />
                                            <p className="font-bold text-sm">{t.name}</p>
                                            <p className="text-[10px] opacity-70">{t.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Name & Code */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-text-muted mb-1">اسم العرض *</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => { setForm({ ...form, name: e.target.value }); if (errors.name) setErrors({ ...errors, name: '' }); }}
                                        placeholder="عرض نهاية الأسبوع"
                                        className={`w-full bg-bg border ${errors.name ? 'border-red-500' : 'border-border'} rounded-xl p-3 text-text-main outline-none focus:border-primary`}
                                    />
                                    {errors.name && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.name}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-muted mb-1">كود الكوبون</label>
                                    <input
                                        type="text"
                                        value={form.code || ''}
                                        onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                        placeholder="SAVE20"
                                        className="w-full bg-bg border border-border rounded-xl p-3 text-text-main font-mono outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            {/* Value & Limits */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-text-muted mb-1">
                                        القيمة * {form.type === 'percentage' ? '(%)' : ''}
                                    </label>
                                    <input
                                        type="number"
                                        value={form.value}
                                        onChange={e => { setForm({ ...form, value: Number(e.target.value) }); if (errors.value) setErrors({ ...errors, value: '' }); }}
                                        placeholder="10"
                                        aria-label="قيمة الخصم"
                                        className={`w-full bg-bg border ${errors.value ? 'border-red-500' : 'border-border'} rounded-xl p-3 text-text-main text-center font-bold outline-none focus:border-primary`}
                                    />
                                    {errors.value && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.value}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-muted mb-1">الحد الأدنى للشراء</label>
                                    <input
                                        type="number"
                                        value={form.minPurchase}
                                        onChange={e => setForm({ ...form, minPurchase: Number(e.target.value) })}
                                        placeholder="0"
                                        className="w-full bg-bg border border-border rounded-xl p-3 text-text-main text-center outline-none focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-muted mb-1">الحد الأقصى للخصم</label>
                                    <input
                                        type="number"
                                        value={form.maxDiscount}
                                        onChange={e => setForm({ ...form, maxDiscount: Number(e.target.value) })}
                                        placeholder="0 = بلا حد"
                                        className="w-full bg-bg border border-border rounded-xl p-3 text-text-main text-center outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            {/* Date Range */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-text-muted mb-1">تاريخ البدء</label>
                                    <input
                                        type="date"
                                        value={form.startDate || ''}
                                        onChange={e => setForm({ ...form, startDate: e.target.value })}
                                        className="w-full bg-bg border border-border rounded-xl p-3 text-text-main outline-none focus:border-primary"
                                        aria-label="تاريخ البدء"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-muted mb-1">تاريخ الانتهاء</label>
                                    <input
                                        type="date"
                                        value={form.endDate || ''}
                                        onChange={e => setForm({ ...form, endDate: e.target.value })}
                                        className="w-full bg-bg border border-border rounded-xl p-3 text-text-main outline-none focus:border-primary"
                                        aria-label="تاريخ الانتهاء"
                                    />
                                </div>
                            </div>

                            {/* Usage Limit */}
                            <div>
                                <label className="block text-xs font-bold text-text-muted mb-1">حد الاستخدام (0 = غير محدود)</label>
                                <input
                                    type="number"
                                    value={form.usageLimit}
                                    onChange={e => setForm({ ...form, usageLimit: Number(e.target.value) })}
                                    className="w-full bg-bg border border-border rounded-xl p-3 text-text-main text-center outline-none focus:border-primary"
                                    placeholder="0"
                                    aria-label="حد الاستخدام"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-4">
                                <button
                                    onClick={handleSave}
                                    className="flex-1 bg-primary text-primary-fg py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                                >
                                    <Check size={18} /> حفظ
                                </button>
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="px-6 bg-surface border border-border text-text-muted py-3 rounded-xl font-bold hover:bg-surface-hover transition-all"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-text-muted">
                                    {discounts.length} خصم/عرض
                                </h3>
                                <button
                                    onClick={openNew}
                                    className="px-4 py-2 bg-primary text-primary-fg rounded-xl font-bold text-sm flex items-center gap-2 hover:brightness-110 transition-all"
                                >
                                    <Plus size={16} /> إضافة خصم
                                </button>
                            </div>

                            {/* Discounts List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                                {loading ? (
                                    <div className="text-center py-12 text-text-muted">جاري التحميل...</div>
                                ) : discounts.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Tag size={48} className="mx-auto text-text-muted opacity-30 mb-3" />
                                        <p className="text-text-muted font-bold">لا توجد خصومات</p>
                                        <p className="text-text-muted text-sm mt-1">أضف خصماً جديداً للبدء</p>
                                    </div>
                                ) : (
                                    discounts.map(d => (
                                        <div
                                            key={d.id}
                                            className={`p-4 rounded-xl border transition-all ${d.active
                                                ? 'bg-surface border-primary/30'
                                                : 'bg-bg border-border opacity-60'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`w-2 h-2 rounded-full ${d.active ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                                                        <h4 className="font-bold text-text-main">{d.name}</h4>
                                                        {d.code && (
                                                            <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-mono rounded">
                                                                {d.code}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-text-muted">
                                                        {d.type === 'percentage' && `خصم ${d.value}%`}
                                                        {d.type === 'fixed' && `خصم ${formatCurrency(d.value)}`}
                                                        {d.type === 'quantity' && `خصم عند شراء ${d.value}+ قطعة`}
                                                        {d.type === 'buyXgetY' && `اشتري ${d.value} واحصل على 1 مجاناً`}
                                                        {(d.minPurchase ?? 0) > 0 && ` • الحد الأدنى: ${formatCurrency(d.minPurchase ?? 0)}`}
                                                    </p>
                                                    {(d.usageLimit ?? 0) > 0 && (
                                                        <p className="text-xs text-text-muted mt-1">
                                                            استخدم {d.usageCount}/{d.usageLimit} مرة
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleToggle(d.id)}
                                                        title={d.active ? 'إيقاف' : 'تفعيل'}
                                                        className={`p-2 rounded-lg transition-colors ${d.active
                                                            ? 'text-emerald-500 hover:bg-emerald-500/10'
                                                            : 'text-text-muted hover:bg-surface'
                                                            }`}
                                                    >
                                                        <Power size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => openEdit(d)}
                                                        className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                                        aria-label="تعديل الخصم"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(d.id)}
                                                        className="p-2 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                                        aria-label="حذف الخصم"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Right: Quick Stats */}
                <div className="w-64 bg-surface rounded-2xl border border-border p-4 flex flex-col">
                    <h3 className="text-sm font-bold text-text-main mb-4 flex items-center gap-2">
                        <ShoppingBag size={16} className="text-primary" /> إحصائيات
                    </h3>

                    <div className="space-y-3">
                        <div className="bg-bg rounded-xl p-3 border border-border">
                            <p className="text-[10px] text-text-muted font-bold">إجمالي الخصومات</p>
                            <p className="text-2xl font-black text-primary">{discounts.length}</p>
                        </div>
                        <div className="bg-bg rounded-xl p-3 border border-border">
                            <p className="text-[10px] text-text-muted font-bold">الخصومات النشطة</p>
                            <p className="text-2xl font-black text-emerald-500">
                                {discounts.filter(d => d.active).length}
                            </p>
                        </div>
                        <div className="bg-bg rounded-xl p-3 border border-border">
                            <p className="text-[10px] text-text-muted font-bold">الكوبونات</p>
                            <p className="text-2xl font-black text-amber-500">
                                {discounts.filter(d => d.code).length}
                            </p>
                        </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-border">
                        <p className="text-[10px] text-text-muted text-center">
                            💡 أضف كود كوبون ليتمكن العملاء من استخدامه عند الشراء
                        </p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
