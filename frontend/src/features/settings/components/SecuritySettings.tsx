
import React from 'react';
import { Lock, Clock, Users, Database, Download, Upload, Trash2, ChevronLeft } from 'lucide-react';
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
        <div className="space-y-4 animate-in fade-in duration-200 select-none">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Access & PIN */}
                <div className="bg-surface border border-border/80 rounded-xl p-4 space-y-4 shadow-3xs">
                    <h3 className="text-xs font-black text-text-main flex items-center gap-2 pb-2 border-b border-border/60">
                        <Lock size={16} className="text-primary" />
                        حماية الوصول
                    </h3>

                    <div className="space-y-3">
                        <SettingInput
                            label="رمز المدير (PIN)"
                            value={prefs.adminPin}
                            onChange={(v: string) => handleChange('adminPin', v)}
                            type="password"
                            placeholder="4-6 أرقام"
                            icon={Lock}
                            error={errors.adminPin}
                        />
                        <SettingInput
                            label="القفل التلقائي"
                            value={prefs.autoLockTime}
                            onChange={(v: string) => handleChange('autoLockTime', Number(v))}
                            type="number"
                            suffix="دقيقة"
                            icon={Clock}
                        />
                    </div>
                </div>

                {/* Auto Backup & Staff Action */}
                <div className="bg-surface border border-border/80 rounded-xl p-4 space-y-4 shadow-3xs flex flex-col justify-between">
                    <div>
                        <h3 className="text-xs font-black text-text-main flex items-center gap-2 pb-2 border-b border-border/60 mb-3">
                            <Users size={16} className="text-primary" />
                            الكادر والنسخ التلقائي
                        </h3>

                        <SettingToggle
                            label="نسخ احتياطي يومي"
                            value={prefs.autoBackup}
                            onChange={(v) => handleChange('autoBackup', v)}
                            icon={Download}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={openStaffManager}
                        className="w-full flex items-center justify-between p-3 bg-bg/80 dark:bg-black/30 border border-border/80 hover:border-primary/50 rounded-lg transition-all group cursor-pointer active:scale-[0.99]"
                    >
                        <div className="flex items-center gap-2.5">
                            <Users size={16} className="text-primary" />
                            <span className="font-bold text-text-main text-xs">إدارة الموظفين والصلاحيات</span>
                        </div>
                        <ChevronLeft size={16} className="text-text-muted group-hover:text-primary transition-colors" />
                    </button>
                </div>
            </div>

            {/* Database & Danger Zone */}
            <div className="bg-surface border border-border/80 rounded-xl p-4 space-y-4 shadow-3xs">
                <h3 className="text-xs font-black text-text-main flex items-center gap-2 pb-2 border-b border-border/60">
                    <Database size={16} className="text-primary" />
                    إدارة بيانات النظام
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                        type="button"
                        onClick={onExportBackup}
                        className="flex items-center justify-center gap-2 p-3 bg-bg/80 dark:bg-black/30 border border-border/80 rounded-lg hover:border-primary/50 transition-all font-bold text-xs text-text-main cursor-pointer active:scale-[0.98]"
                    >
                        <Download size={16} className="text-primary" />
                        <span>تصدير نسخة احتياطية</span>
                    </button>

                    <button
                        type="button"
                        onClick={onRestoreBackup}
                        className="flex items-center justify-center gap-2 p-3 bg-bg/80 dark:bg-black/30 border border-border/80 rounded-lg hover:border-primary/50 transition-all font-bold text-xs text-text-main cursor-pointer active:scale-[0.98]"
                    >
                        <Upload size={16} className="text-primary" />
                        <span>استعادة نسخة احتياطية</span>
                    </button>

                    <button
                        type="button"
                        onClick={onResetDatabase}
                        className="flex items-center justify-center gap-2 p-3 bg-danger/10 border border-danger/20 hover:bg-danger hover:text-white transition-all font-bold text-xs text-danger rounded-lg cursor-pointer active:scale-[0.98]"
                    >
                        <Trash2 size={16} />
                        <span>تصفير النظام</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
