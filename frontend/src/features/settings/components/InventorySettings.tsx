
import React from 'react';
import { Database, AlertTriangle, Package, Bell, TrendingDown, BarChart3, ShieldCheck } from 'lucide-react';

import { AppPreferences } from '../../../core/types';
import { SettingInput, SettingToggle } from './SettingsUI';

interface InventorySettingsProps {
    prefs: AppPreferences;
    handleChange: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
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
        <div className="space-y-5 animate-in fade-in duration-300 pb-8 select-none">
            {/* Header Banner */}
            <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Database size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-text-main">سياسات وإعدادات المخزون</h2>
                        <p className="text-text-muted text-xs font-semibold">إدارة تنبيهات الحدود الأدنى وقواعد البيع عند النفاذ</p>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface border border-border/80 rounded-2xl p-4 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <Package size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] text-text-muted font-black uppercase tracking-wider">حد تنبيه النقص</p>
                        <p className="text-lg font-black font-mono text-text-main">{prefs.lowStockTrigger || 5}</p>
                    </div>
                </div>
                <div className="bg-surface border border-border/80 rounded-2xl p-4 flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${prefs.allowNegativeStock ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                        <TrendingDown size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] text-text-muted font-black uppercase tracking-wider">المخزون السالب</p>
                        <p className={`text-lg font-black ${prefs.allowNegativeStock ? 'text-red-400' : 'text-emerald-400'}`}>{prefs.allowNegativeStock ? 'مسموح' : 'محظور'}</p>
                    </div>
                </div>
                <div className="bg-surface border border-border/80 rounded-2xl p-4 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <BarChart3 size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] text-text-muted font-black uppercase tracking-wider">حماية الحسابات</p>
                        <p className="text-lg font-black text-blue-400">مفعلة</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Low Stock Config */}
                <div className="bg-surface rounded-2xl border border-border/80 p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
                            <Bell size={20} className="text-amber-400" />
                        </div>
                        <div>
                            <h4 className="font-black text-text-main text-base">تنبيهات نقص المنتجات</h4>
                            <p className="text-xs text-text-muted font-medium">إشعار عند انخفاض الكمية</p>
                        </div>
                    </div>

                    <SettingInput
                        label="حد التنبيه (الكمية الأدنى)"
                        value={prefs.lowStockTrigger}
                        onChange={(v: string) => handleChange('lowStockTrigger', Number(v))}
                        type="number"
                        help="الكمية المتبقية للتنبيه"
                        error={errors.lowStockTrigger}
                    />

                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-2.5 items-start">
                        <div className="p-1 bg-amber-500/20 rounded-full mt-0.5 shrink-0">
                            <Bell size={12} className="text-amber-400" />
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed font-semibold">
                            عندما تصل كمية أي منتج إلى <span className="font-mono font-black text-amber-400 mx-1">{prefs.lowStockTrigger || 5}</span> قطعة أو أقل، سيتم تمييزه باللون الأحمر في قائمة المخزون وتقارير النواقص.
                        </p>
                    </div>
                </div>

                {/* Negative Stock Config */}
                <div className="bg-surface rounded-2xl border border-border/80 p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${prefs.allowNegativeStock ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h4 className="font-black text-text-main text-base">سياسة البيع المكشوف (المكشوف)</h4>
                            <p className="text-xs text-text-muted font-medium">السماح بالبيع عند انعدام الكمية بالمخزن</p>
                        </div>
                    </div>

                    <SettingToggle
                        label="السماح بالمخزون السالب"
                        description="إمكانية إتمام البيع حتى لو كان رصيد المنتج 0"
                        value={prefs.allowNegativeStock}
                        onChange={(v: boolean) => handleChange('allowNegativeStock', v)}
                        icon={AlertTriangle}
                    />

                    {prefs.allowNegativeStock ? (
                        <div className="mt-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold flex items-center gap-2.5">
                            <AlertTriangle size={18} className="shrink-0" />
                            <span>تنبيه: تفعيل البيع المكشوف قد يسبب تباين في تقارير الأرباح والجرد إذا لم تضاف الشحنات لاحقاً.</span>
                        </div>
                    ) : (
                        <div className="mt-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2.5">
                            <ShieldCheck size={18} className="shrink-0" />
                            <span>حماية نشطة: سيمنع النظام إكمال أي فاتورة تحتوي على منتجات غير متوفرة بالمخزن.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
