
import React from 'react';
import { ShieldCheck, Lock, Clock, Users, Database, Download, Upload, AlertTriangle, Trash2, ChevronLeft } from 'lucide-react';
import { AppPreferences } from '../../../core/types';
import { SettingInput, SettingToggle } from './SettingsUI';

interface SecuritySettingsProps {
    prefs: AppPreferences;
    handleChange: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
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
        <div className="space-y-5 animate-in fade-in duration-300 pb-8 select-none">
            {/* Header Banner */}
            <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-text-main">الأمان وإدارة البيانات</h2>
                        <p className="text-text-muted text-xs font-semibold">تغيير الرمز السري، والنسخ الاحتياطي، وصلاحيات الموظفين</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Access Control & PIN */}
                <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Lock size={20} />
                        </div>
                        <h3 className="text-base font-black text-text-main">حماية الوصول والرمز السري</h3>
                    </div>

                    <div className="space-y-4">
                        <SettingInput
                            label="رمز المدير (Admin PIN)"
                            value={prefs.adminPin}
                            onChange={(v: string) => handleChange('adminPin', v)}
                            type="password"
                            placeholder="أدخل 4-6 أرقام"
                            icon={Lock}
                            error={errors.adminPin}
                            help="يُطلب عند العمليات الحساسة كالحذف والتهيئة"
                        />
                        <SettingInput
                            label="القفل التلقائي للشاشة"
                            value={prefs.autoLockTime}
                            onChange={(v: string) => handleChange('autoLockTime', Number(v))}
                            type="number"
                            suffix="دقيقة"
                            icon={Clock}
                            help="0 = معطل • عند الخمول يُقفل التطبيق تلقائياً"
                        />
                    </div>
                </div>

                {/* Automation & Backups */}
                <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Clock size={20} />
                        </div>
                        <h3 className="text-base font-black text-text-main">النسخ الاحتياطي التلقائي</h3>
                    </div>

                    <SettingToggle
                        label="نسخ احتياطي يومي تلقائي"
                        description="أخذ نسخة احتياطية من كافة البيانات يومياً فور فتح النظام"
                        value={prefs.autoBackup}
                        onChange={(v) => handleChange('autoBackup', v)}
                        icon={Download}
                    />
                </div>


                {/* Staff Management */}
                <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6 md:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            <Users size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-text-main">إدارة الكادر والصلاحيات</h3>
                            <p className="text-xs text-text-muted font-medium">إضافة مستخدمين، وتحديد الأدوار وصلاحيات البيع والإلغاء</p>
                        </div>
                    </div>

                    <button
                        onClick={openStaffManager}
                        className="w-full flex items-center justify-between p-4 bg-surface-hover/60 border border-border/60 hover:border-emerald-500/40 rounded-xl transition-colors group cursor-pointer"
                    >
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <Users size={20} />
                            </div>
                            <div className="text-right">
                                <h5 className="font-black text-text-main text-sm">فتح لوحة التحكم بالموظفين</h5>
                                <p className="text-[11px] text-text-muted font-bold">إضافة وتعديل أدوار الكاشير والمدراء</p>
                            </div>
                        </div>
                        <ChevronLeft size={20} className="text-text-muted group-hover:text-emerald-400 transition-colors" />
                    </button>
                </div>
            </div>

            <h3 className="text-base font-black mt-6 mb-3 px-1 flex items-center gap-2 text-text-main">
                <Database size={20} className="text-emerald-400" />
                إدارة قاعدة البيانات والحفظ
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Export */}
                <button
                    onClick={onExportBackup}
                    className="flex items-center gap-4 p-4 sm:p-5 bg-surface border border-border/80 rounded-2xl hover:border-emerald-500/40 transition-colors text-right cursor-pointer"
                >
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <Download size={24} />
                    </div>
                    <div className="flex-1">
                        <h5 className="font-black text-text-main text-sm mb-0.5">تصدير نسخة احتياطية</h5>
                        <p className="text-xs text-text-muted font-medium">حفظ نسخة احتياطية كاملة من البيانات كملف خارجي</p>
                    </div>
                </button>

                {/* Import */}
                <button
                    onClick={onRestoreBackup}
                    className="flex items-center gap-4 p-4 sm:p-5 bg-surface border border-border/80 rounded-2xl hover:border-blue-500/40 transition-colors text-right cursor-pointer"
                >
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                        <Upload size={24} />
                    </div>
                    <div className="flex-1">
                        <h5 className="font-black text-text-main text-sm mb-0.5">استعادة نسخة احتياطية</h5>
                        <p className="text-xs text-text-muted font-medium">استرجاع قاعدة البيانات من ملف محفوظ سابقاً</p>
                    </div>
                </button>
            </div>

            {/* Danger Zone */}
            <div className="mt-6 bg-red-500/10 rounded-2xl border border-red-500/20 p-5 sm:p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-5">
                    <div className="flex-1">
                        <h4 className="font-black text-base text-red-400 mb-1 flex items-center gap-2">
                            <AlertTriangle size={22} /> منطقة العمليات الحساسة (Danger Zone)
                        </h4>
                        <p className="text-xs text-text-muted font-medium leading-relaxed max-w-xl">
                            تهيئة النظام ستؤدي لمسح جميع الفواتير والمنتجات وإعادة التطبيق لحالة ضبط المصنع.
                        </p>
                    </div>

                    <button
                        onClick={onResetDatabase}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-xs transition-transform active:scale-[0.98] cursor-pointer"
                    >
                        <Trash2 size={18} />
                        <span>تهيئة النظام ومسح البيانات</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
