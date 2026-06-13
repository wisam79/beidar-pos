
import React from 'react';
import { Database, AlertTriangle, Package, Bell, TrendingDown, BarChart3, ShieldCheck } from 'lucide-react';

import { AppPreferences } from '../../core/types';
import { SettingInput, SettingToggle } from './SettingsUI';

interface InventorySettingsProps {
    prefs: AppPreferences;
    handleChange: (key: keyof AppPreferences, value: unknown) => void;
    errors: Record<string, string>;
}

// Stats card component
const InventoryStatCard = ({ icon: Icon, title, value, color }: {
    icon: React.ElementType, title: string, value: string | number, color: string
}) => (
    <div className={`bg-${color}-500/10 border border-${color}-500/20 rounded-2xl p-4 text-center`}>
        <Icon size={24} className={`text-${color}-400 mx-auto mb-2`} />
        <p className={`text-xl font-black text-${color}-400`}>{value}</p>
        <p className="text-[10px] text-text-muted font-medium">{title}</p>
    </div>
);

export const InventorySettings = ({ prefs, handleChange, errors }: InventorySettingsProps) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Hero Header - Ultra Compact */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-3 text-text-main shadow-sm">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                    <Database size={50} className="text-primary" />
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 dark:bg-white/5 rounded-lg border border-primary/20 dark:border-white/10 text-primary">
                        <Database size={18} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold tracking-tight">سياسات المخزون</h2>
                        <p className="text-text-muted text-[10px] opacity-90">إدارة التنبيهات وقواعد الجرد والنقص</p>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface/50 border border-border rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <Package size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-text-muted font-bold uppercase tracking-wider">حد التنبيه</p>
                        <p className="text-xl font-black text-text-main">{prefs.lowStockTrigger || 5}</p>
                    </div>
                </div>
                <div className="bg-surface/50 border border-border rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${prefs.allowNegativeStock ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        <TrendingDown size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-text-muted font-bold uppercase tracking-wider">المخزون السالب</p>
                        <p className={`text-xl font-black ${prefs.allowNegativeStock ? 'text-red-500' : 'text-emerald-500'}`}>{prefs.allowNegativeStock ? 'مسموح' : 'محظور'}</p>
                    </div>
                </div>
                <div className="bg-surface/50 border border-border rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-text-muted font-bold uppercase tracking-wider">الحالة</p>
                        <p className="text-xl font-black text-primary">نشط</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Low Stock Config */}
                <div className="bg-surface/50 rounded-3xl border border-border p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                            <Bell size={20} className="text-amber-500" />
                        </div>
                        <div>
                            <h4 className="font-bold text-text-main text-lg">تنبيهات النقص</h4>
                            <p className="text-xs text-text-muted">إشعار عند انخفاض كمية أي منتج</p>
                        </div>
                    </div>

                    <SettingInput
                        label="حد التنبيه"
                        value={prefs.lowStockTrigger}
                        onChange={(v: string) => handleChange('lowStockTrigger', Number(v))}
                        type="number"
                        help="الكمية التي يبدأ عندها التنبيه"
                        error={errors.lowStockTrigger}
                    />

                    <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex gap-3 items-start">
                        <div className="p-1 bg-amber-500/20 rounded-full mt-0.5">
                            <Bell size={10} className="text-amber-600" />
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed">
                            عندما تصل كمية أي منتج إلى <span className="font-bold text-amber-600 mx-1">{prefs.lowStockTrigger || 5}</span> قطع أو أقل، سيتم تمييزه باللون الأحمر في قائمة المخزون وسيظهر في تقرير النواقص.
                        </p>
                    </div>
                </div>

                {/* Negative Stock Config */}
                <div className={`rounded-3xl border-2 p-6 transition-all duration-300 ${prefs.allowNegativeStock ? 'bg-red-500/5 border-red-500/20 shadow-red-500/5' : 'bg-surface/50 border-border shadow-sm'}`}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${prefs.allowNegativeStock ? 'bg-red-500/20 text-red-600' : 'bg-surface-active text-text-muted'}`}>
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-text-main text-lg">سياسة البيع المكشوف</h4>
                            <p className="text-xs text-text-muted">التحكم في البيع عند نفاذ الكمية</p>
                        </div>
                    </div>

                    <SettingToggle
                        label="سماح بالمخزون السالب"
                        description="البيع حتى عند نفاذ الكمية - سيصبح الرصيد بالسالب"
                        value={prefs.allowNegativeStock}
                        onChange={(v: boolean) => handleChange('allowNegativeStock', v)}
                        icon={AlertTriangle}
                    />

                    {prefs.allowNegativeStock ? (
                        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertTriangle size={18} />
                            <span>تحذير: تفعيل هذا الخيار قد يسبب مشاكل في دقة الجرد وحساب الأرباح إذا لم يتم تسوية المخزون لاحقاً.</span>
                        </div>
                    ) : (
                        <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-600 text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <ShieldCheck size={18} /> {/* Note: ShieldCheck needs import if not available, using existing imports */}
                            <span>حماية نشطة: النظام سيمنع عمليات البيع إذا كانت الكمية غير كافية.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
