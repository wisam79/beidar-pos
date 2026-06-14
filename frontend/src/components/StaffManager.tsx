import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Edit2, Trash2, Shield, Key, UserCheck, UserX, Mail, Phone, BadgeCheck } from 'lucide-react';
import { api, Staff, StaffRole } from '../core/api';
import { ConfirmModal } from './ConfirmModal';
import { validateStaffInput, pinSchema } from '../core/schemas/staff.schema';
import { ErrorMessage, FieldError } from './ErrorMessage';
import { parseStaffError, getErrorField } from '../utils/parseStaffError';

interface StaffManagerProps {
    isOpen: boolean;
    onClose: () => void;
    notify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const ROLES: { value: StaffRole; label: string; color: string }[] = [
    { value: 'admin', label: 'مدير', color: 'text-red-400 bg-red-500/10' },
    { value: 'manager', label: 'مشرف', color: 'text-amber-400 bg-amber-500/10' },
    { value: 'cashier', label: 'كاشير', color: 'text-blue-400 bg-blue-500/10' },
    { value: 'viewer', label: 'مشاهد', color: 'text-gray-400 bg-gray-500/10' },
];

const PERMISSIONS = [
    { key: 'sales', label: 'المبيعات' },
    { key: 'products', label: 'المنتجات' },
    { key: 'inventory', label: 'المخزون' },
    { key: 'customers', label: 'العملاء' },
    { key: 'invoices', label: 'الفواتير' },
    { key: 'reports', label: 'التقارير' },
    { key: 'finance', label: 'المالية' },
    { key: 'settings', label: 'الإعدادات' },
    { key: 'staff_manage', label: 'إدارة الموظفين' },
    { key: 'discounts', label: 'الخصومات' },
    { key: 'delete_sales', label: 'حذف المبيعات' },
    { key: 'edit_prices', label: 'تعديل الأسعار' },
];

const emptyStaff: Staff = {
    id: '',
    name: '',
    username: '',
    role: 'cashier',
    phone: '',
    email: '',
    active: true,
    permissions: [],
    mustChangePin: false,
    createdAt: 0
};

export const StaffManager: React.FC<StaffManagerProps> = ({ isOpen, onClose, notify }) => {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [formData, setFormData] = useState<Staff>(emptyStaff);
    const [pin, setPin] = useState('');
    const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; type?: 'confirm' | 'warning' | 'error' | 'info'; confirmText?: string; onConfirm: () => void }>({
        open: false, title: '', message: '', onConfirm: () => { }
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [errorHints, setErrorHints] = useState<Record<string, string>>({});
    const [generalError, setGeneralError] = useState<{ message: string; hint?: string } | null>(null);

    useEffect(() => {
        if (isOpen) loadStaff();
    }, [isOpen]);

    const loadStaff = async () => {
        setLoading(true);
        try {
            const data = await api.staff.list();
            setStaffList(data || []);
        } catch (e) {
            notify('فشل تحميل قائمة الموظفين', 'error');
        }
        setLoading(false);
    };

    const handleSubmit = async () => {
        // Clear previous errors
        setErrors({});
        setErrorHints({});
        setGeneralError(null);

        // Validate
        const validation = validateStaffInput(formData);
        let newErrors: Record<string, string> = {};
        const newHints: Record<string, string> = {};

        if (!validation.success) {
            newErrors = validation.errors || {};
        }

        // التحقق من رمز PIN (مطلوب للموظف الجديد)
        if (!editingStaff && !pin) {
            newErrors.pin = 'رمز PIN مطلوب للموظف الجديد';
            newHints.pin = 'أدخل 4 أرقام للدخول';
        } else if (pin) {
            const res = pinSchema.safeParse(pin);
            if (!res.success) {
                newErrors.pin = res.error.errors[0].message;
                newHints.pin = 'أدخل 4 أرقام فقط، تجنب الأرقام المتسلسلة (1234) أو المتكررة (0000)';
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setErrorHints(newHints);

            // Show the first error message in a toast
            const firstErrorKey = Object.keys(newErrors)[0];
            const firstErrorMsg = newErrors[firstErrorKey];
            notify(firstErrorMsg ? `خطأ: ${firstErrorMsg}` : 'يرجى تصحيح الأخطاء في النموذج', 'error');

            setGeneralError({
                message: 'يرجى تصحيح الأخطاء في النموذج',
                hint: 'تحقق من الحقول المميزة باللون الأحمر وصحح البيانات المدخلة'
            });
            return;
        }

        try {
            if (editingStaff) {
                await api.staff.update(formData);
                // تحديث رمز PIN إذا تم إدخاله
                if (pin && pin.length === 4) {
                    try {
                        await api.staff.updatePIN(formData.id, pin);
                    } catch (pinError: unknown) {
                        const errMsg = pinError instanceof Error ? pinError.message : 'فشل تحديث رمز PIN';
                        setGeneralError({
                            message: errMsg,
                            hint: 'تأكد من أن الرمز يتكون من 4 أرقام وليس ضعيفاً'
                        });
                        return;
                    }
                }
                notify('تم تحديث الموظف بنجاح', 'success');
            } else {
                // إنشاء موظف جديد باستخدام PIN
                await api.staff.create(formData, pin);
                notify('تم إضافة الموظف بنجاح', 'success');
            }
            resetForm();
            loadStaff();
        } catch (e: unknown) {
            // Parse structured error from backend
            const staffError = parseStaffError(e);

            // Set field-specific error if available
            const errorField = staffError.field || getErrorField(staffError.code);
            if (errorField) {
                setErrors(prev => ({ ...prev, [errorField]: staffError.message }));
                setErrorHints(prev => ({ ...prev, [errorField]: staffError.hint || '' }));
            }

            setGeneralError({
                message: staffError.message,
                hint: staffError.hint || 'حاول مرة أخرى'
            });
        }
    };

    const handleDelete = (id: string) => {
        const performDelete = async (force: boolean) => {
            try {
                await api.staff.delete(id, force);
                notify('تم حذف الموظف بنجاح', 'success');
                loadStaff();
                setConfirmModal(prev => ({ ...prev, open: false }));
            } catch (err: unknown) {
                // Parse structured error from backend
                // Try to parse the error as JSON (AppError)
                let appError: unknown = null;
                const errStr = String(err);
                try {
                    const jsonPart = errStr.includes('{') ? errStr.substring(errStr.indexOf('{')) : errStr;
                    appError = JSON.parse(jsonPart);
                } catch (e) { /* Not JSON */ }

                // Check for allowForce option
                const appErr = appError as AppError | null;
                if (appErr?.options?.allowForce) {
                    setConfirmModal({
                        open: true,
                        title: 'تعذر الحذف - مطلوب تأكيد إضافي',
                        message: `${appErr.message}\n\n${appErr.hint || ''}`,
                        type: 'warning',
                        confirmText: 'حذف قسري (Force Delete)',
                        onConfirm: () => performDelete(true)
                    });
                    return;
                }

                // Fallback to parseStaffError for standard staff errors
                const staffError = parseStaffError(err);
                notify(staffError.message, 'error');
                setGeneralError({
                    message: staffError.message,
                    hint: staffError.hint || 'حاول مرة أخرى'
                });
                setConfirmModal(prev => ({ ...prev, open: false }));
            }
        };

        setConfirmModal({
            open: true,
            title: 'حذف الموظف',
            message: 'هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.',
            type: 'error',
            confirmText: 'حذف',
            onConfirm: () => performDelete(false)
        });
    };

    const handleToggleStatus = async (id: string) => {
        try {
            await api.staff.toggle(id);
            loadStaff();
        } catch (e) {
            notify('فشل تغيير الحالة', 'error');
        }
    };

    const resetForm = () => {
        setFormData(emptyStaff);
        setPin('');
        setEditingStaff(null);
        setShowForm(false);
        setErrors({});
        setErrorHints({});
        setGeneralError(null);
    };

    const startEdit = (s: Staff) => {
        setEditingStaff(s);
        setFormData(s);
        setPin('');
        setErrors({});
        setErrorHints({});
        setGeneralError(null);
        setShowForm(true);
    };

    const getRoleInfo = (role: StaffRole) => ROLES.find(r => r.value === role) || ROLES[2];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-border flex items-center justify-between bg-gradient-to-l from-purple-500/5 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500/20 rounded-xl">
                            <Users size={24} className="text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-text-main">إدارة الموظفين</h2>
                            <p className="text-xs text-text-muted">{staffList.length} موظف مسجل</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setShowForm(true); setEditingStaff(null); setFormData(emptyStaff); }}
                            className="px-4 py-2 bg-primary text-primary-fg rounded-xl font-bold text-sm flex items-center gap-2 hover:brightness-110 transition-all"
                            title="إضافة موظف جديد"
                        >
                            <Plus size={16} />
                            إضافة موظف
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-xl transition-colors" title="إغلاق">
                            <X size={20} className="text-text-muted" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {showForm ? (
                        /* Staff Form */
                        <div className="max-w-2xl mx-auto space-y-6">
                            <h3 className="font-bold text-text-main text-lg flex items-center gap-2">
                                {editingStaff ? <Edit2 size={18} /> : <Plus size={18} />}
                                {editingStaff ? 'تعديل الموظف' : 'إضافة موظف جديد'}
                            </h3>

                            {/* General Error Display */}
                            {generalError && (
                                <ErrorMessage
                                    message={generalError.message}
                                    hint={generalError.hint}
                                    type="error"
                                />
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-text-muted block mb-2">الاسم الكامل</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="أدخل الاسم"
                                        title="الاسم الكامل"
                                        className={`w-full bg-bg border ${errors.name ? 'border-red-500' : 'border-border'} rounded-xl px-4 py-3 text-text-main outline-none focus:border-primary`}
                                    />
                                    <FieldError error={errors.name} hint={errorHints.name} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-muted block mb-2">اسم المستخدم</label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        placeholder="username"
                                        title="اسم المستخدم"
                                        className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text-main outline-none focus:border-primary"
                                        dir="ltr"
                                    />
                                    <FieldError error={errors.username} hint={errorHints.username || 'يجب أن يكون 3-20 حرفاً، حروف وأرقام فقط'} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* PIN Field */}
                                <div>
                                    <label className="text-xs font-bold text-text-muted block mb-2">
                                        <Key size={12} className="inline ml-1" />
                                        {editingStaff ? 'رمز PIN جديد (اختياري)' : 'رمز PIN للدخول'}
                                    </label>
                                    <input
                                        type="text"
                                        value={pin}
                                        onChange={e => {
                                            const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                                            setPin(digits);
                                        }}
                                        placeholder="••••"
                                        title="رمز PIN"
                                        maxLength={4}
                                        className={`w-full max-w-[200px] bg-bg border ${errors.pin ? 'border-red-500' : 'border-border'} rounded-xl px-4 py-3 text-text-main outline-none focus:border-primary text-center tracking-[0.5em] font-mono text-xl`}
                                        dir="ltr"
                                    />
                                    <FieldError error={errors.pin} hint={errorHints.pin} />
                                    <p className="text-[10px] text-text-muted mt-1">4 أرقام - يستخدم لتسجيل الدخول</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-muted block mb-2">
                                        <Shield size={12} className="inline ml-1" />
                                        الصلاحية
                                    </label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value as StaffRole })}
                                        title="صلاحية الموظف"
                                        className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text-main outline-none focus:border-primary"
                                    >
                                        {ROLES.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-text-muted block mb-2">
                                        <Phone size={12} className="inline ml-1" />
                                        الهاتف
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phone || ''}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="07xxxxxxxxx"
                                        title="رقم الهاتف"
                                        className={`w-full bg-bg border ${errors.phone ? 'border-red-500' : 'border-border'} rounded-xl px-4 py-3 text-text-main outline-none focus:border-primary`}
                                        dir="ltr"
                                    />
                                    <FieldError error={errors.phone} hint={errorHints.phone || 'يجب أن يبدأ بـ 07 ويتكون من 11 رقماً'} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-muted block mb-2">
                                        <Mail size={12} className="inline ml-1" />
                                        البريد الإلكتروني
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="email@example.com"
                                        title="البريد الإلكتروني"
                                        className={`w-full bg-bg border ${errors.email ? 'border-red-500' : 'border-border'} rounded-xl px-4 py-3 text-text-main outline-none focus:border-primary`}
                                        dir="ltr"
                                    />
                                    <FieldError error={errors.email} hint={errorHints.email || 'مثال: user@example.com'} />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4">
                                <button
                                    onClick={resetForm}
                                    className="px-6 py-3 bg-surface-hover border border-border rounded-xl text-text-muted font-bold hover:text-text-main transition-colors"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="px-6 py-3 bg-primary text-primary-fg rounded-xl font-bold hover:brightness-110 transition-all"
                                >
                                    {editingStaff ? 'حفظ التغييرات' : 'إضافة الموظف'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Staff List */
                        <div className="grid gap-4">
                            {loading ? (
                                <div className="text-center py-12 text-text-muted">جاري التحميل...</div>
                            ) : staffList.length === 0 ? (
                                <div className="text-center py-12 text-text-muted border-2 border-dashed border-border rounded-2xl">
                                    <Users size={48} className="mx-auto mb-3 opacity-50" />
                                    <p className="font-bold">لا يوجد موظفون</p>
                                    <p className="text-xs mt-1">اضغط "إضافة موظف" للبدء</p>
                                </div>
                            ) : (
                                staffList.map(s => {
                                    const roleInfo = getRoleInfo(s.role as StaffRole);
                                    return (
                                        <div
                                            key={s.id}
                                            className={`p-4 bg-bg border border-border rounded-2xl flex items-center justify-between hover:border-primary/30 transition-all ${!s.active ? 'opacity-50' : ''}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black ${roleInfo.color}`}>
                                                    {s.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-text-main">{s.name}</h4>
                                                        {s.active ? (
                                                            <BadgeCheck size={14} className="text-emerald-400" />
                                                        ) : (
                                                            <UserX size={14} className="text-red-400" />
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-text-muted">@{s.username}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${roleInfo.color}`}>
                                                    {roleInfo.label}
                                                </span>

                                                <button
                                                    onClick={() => handleToggleStatus(s.id)}
                                                    className={`p-2 rounded-lg transition-colors ${s.active ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-emerald-500/10 text-emerald-400'}`}
                                                    title={s.active ? 'تعطيل' : 'تفعيل'}
                                                >
                                                    {s.active ? <UserX size={18} /> : <UserCheck size={18} />}
                                                </button>
                                                <button
                                                    onClick={() => startEdit(s)}
                                                    className="p-2 hover:bg-blue-500/10 text-blue-400 rounded-lg transition-colors"
                                                    title="تعديل"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(s.id)}
                                                    className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                                                    title="حذف"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.open}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText}
                cancelText="إلغاء"
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, open: false }))}
            />
        </div>
    );
};
