
import React from 'react';
import { ShieldCheck, Lock, Clock, Users, Database, Download, Upload, AlertTriangle, Trash2, ChevronLeft } from 'lucide-react';
import { AppPreferences } from '../../../core/types';
import { SettingInput, SettingToggle } from './SettingsUI';

interface SecuritySettingsProps {
    prefs: AppPreferences;
    handleChange: (key: keyof AppPreferences, value: unknown) => void;
    errors: Record<string, string>;
    openStaffManager: () => void;
    onExportBackup: () => void;
    onRestoreBackup: () => void;
    onResetDatabase: () => void;
}

export const SecuritySettings = ({
    prefs,
    handleChange,
    errors,
    openStaffManager,
    onExportBackup,
    onRestoreBackup,
    onResetDatabase
}: SecuritySettingsProps) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Hero Header - Ultra Compact */}
            <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-3 text-text-main shadow-sm">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                    <ShieldCheck size={50} className="text-primary" />
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 text-primary">
                        <ShieldCheck size={18} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold tracking-tight">الأمان والبيانات</h2>
                        <p className="text-text-muted text-[10px] opacity-90">حماية النظام، إدارة الصلاحيات، والنسخ الاحتياطي</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Access Control & PIN */}
                <div className="bg-surface/50 border border-border rounded-lg p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary">
                            <Lock size={24} />
                        </div>
                        <h3 className="text-xl font-bold">حماية الوصول</h3>
                    </div>

                    <div className="space-y-4">
                        <SettingInput
                            label="رمز المدير (PIN)"
                            value={prefs.adminPin}
                            onChange={(v: string) => handleChange('adminPin', v)}
                            type="password"
                            placeholder="أدخل 4-6 أرقام"
                            icon={Lock}
                            error={errors.adminPin}
                            help="يُطلب عند العمليات الحساسة مثل الحذف والتهيئة"
                        />
                        <SettingInput
                            label="قفل تلقائي بعد"
                            value={prefs.autoLockTime}
                            onChange={(v: string) => handleChange('autoLockTime', Number(v))}
                            type="number"
                            suffix="دقيقة"
                            icon={Clock}
                            help="0 = معطل • عند الخمول يُقفل النظام تلقائياً"
                        />
                    </div>
                </div>

                {/* Automation & Backups */}
                <div className="bg-surface/50 border border-border rounded-lg p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary">
                            <Clock size={24} />
                        </div>
                        <h3 className="text-xl font-bold">النسخ الاحتياطي التلقائي</h3>
                    </div>

                    <SettingToggle
                        label="نسخ احتياطي يومي"
                        description="سيتم أخذ نسخة احتياطية من قاعدة البيانات تلقائياً عند فتح التطبيق مرة واحدة يومياً."
                        value={prefs.autoBackup}
                        onChange={(v) => handleChange('autoBackup', v)}
                        icon={Download}
                    />
                </div>


                {/* Staff Management */}
                <div className="bg-surface/50 border border-border rounded-lg p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary">
                            <Users size={24} />
                        </div>
                        <h3 className="text-xl font-bold">الموظفين والصلاحيات</h3>
                    </div>

                    <div className="flex-1 flex flex-col gap-4">
                        <p className="text-sm text-text-muted leading-relaxed">
                            إدارة حسابات الموظفين وتحديد صلاحيات دقيقة لكل مستخدم لضمان أمان البيانات وتنظيم العمل.
                        </p>

                        <button
                            onClick={openStaffManager}
                            className="w-full mt-auto flex items-center justify-between p-5 bg-surface/50 border border-border hover:border-primary/30 rounded-lg hover:shadow-lg hover:shadow-primary/5 transition-all group cursor-pointer hover:bg-surface-hover"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:scale-110 transition-transform">
                                    <Users size={24} />
                                </div>
                                <div className="text-right">
                                    <h5 className="font-bold text-text-main mb-1">إدارة الموظفين</h5>
                                    <p className="text-[10px] text-text-muted">إضافة، تعديل، وحذف المستخدمين</p>
                                </div>
                            </div>
                            <ChevronLeft size={20} className="text-primary opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                        </button>
                    </div>
                </div>
            </div>

            <h3 className="text-xl font-bold mt-8 mb-4 px-2 flex items-center gap-2">
                <Database size={24} className="text-primary" />
                إدارة البيانات
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Export */}
                <button
                    onClick={onExportBackup}
                    className="flex items-center gap-4 p-6 bg-surface border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all group text-right shadow-sm hover:shadow-md"
                >
                    <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Download size={28} />
                    </div>
                    <div className="flex-1">
                        <h5 className="font-bold text-text-main text-lg mb-1">تصدير نسخة احتياطية</h5>
                        <p className="text-xs text-text-muted leading-relaxed opacity-80">حفظ نسخة كاملة من قاعدة البيانات كملف JSON آمن</p>
                    </div>
                </button>

                {/* Import */}
                <button
                    onClick={onRestoreBackup}
                    className="flex items-center gap-4 p-6 bg-surface border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all group text-right shadow-sm hover:shadow-md"
                >
                    <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Upload size={28} />
                    </div>
                    <div className="flex-1">
                        <h5 className="font-bold text-text-main text-lg mb-1">استعادة نسخة احتياطية</h5>
                        <p className="text-xs text-text-muted leading-relaxed opacity-80">استرجاع البيانات من ملف محفوظ مسبقاً</p>
                    </div>
                </button>
            </div>

            {/* Danger Zone */}
            <div className="mt-8 bg-red-500/5 rounded-lg border border-red-500/20 p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent opacity-50" />

                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1">
                        <h4 className="font-black text-2xl text-red-600 mb-2 flex items-center gap-3">
                            <AlertTriangle size={28} /> منطقة الخطر
                        </h4>
                        <p className="text-sm text-text-muted leading-relaxed max-w-xl">
                            الإجراءات هنا حرجة جداً ولا يمكن التراجع عنها. تأكد تماماً قبل القيام بأي عملية، وينصح دائماً بأخذ نسخة احتياطية أولاً.
                        </p>
                    </div>

                    <button
                        onClick={onResetDatabase}
                        className="flex-shrink-0 flex items-center gap-4 px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg shadow-red-500/20 hover:shadow-red-600/30 transition-all transform hover:scale-[1.02] active:scale-95"
                    >
                        <Trash2 size={24} />
                        <div className="text-right">
                            <h5 className="font-bold text-sm">تهيئة النظام بالكامل</h5>
                            <p className="text-[10px] text-red-200">Factory Reset</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};
