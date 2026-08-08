
import React from 'react';
import { CreditCard, Printer, Zap, Tag, ChevronLeft } from 'lucide-react';
import { AppPreferences } from '../../../core/types';
import { SettingInput, SettingToggle } from './SettingsUI';

interface SalesSettingsProps {
    prefs: AppPreferences;
    handleChange: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
    errors: Record<string, string>;
    setShowDiscountManager: (show: boolean) => void;
}

export const SalesSettings = ({ prefs, handleChange, errors, setShowDiscountManager }: SalesSettingsProps) => {
    return (
        <div className="space-y-5 animate-in fade-in duration-300 pb-8 select-none">
            {/* Header Banner */}
            <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CreditCard size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-text-main">إعدادات المبيعات والطباعة</h2>
                        <p className="text-text-muted text-xs font-semibold">تخصيص سلوك نقطة البيع والطباعة التلقائية</p>
                    </div>
                </div>
            </div>

            {/* Main Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* General Sales Behavior */}
                <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Zap size={20} />
                        </div>
                        <h3 className="text-base font-black text-text-main">سلوك عملية البيع</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <SettingInput label="العملة" value={prefs.currency} onChange={(v: string) => handleChange('currency', v)} placeholder="IQD" />
                            <SettingInput label="الهدف اليومي" value={prefs.dailySalesTarget} onChange={(v: string) => handleChange('dailySalesTarget', Number(v))} type="number" suffix={prefs.currency} error={errors.dailySalesTarget} />
                        </div>
                        <div className="space-y-3 pt-2">
                            <SettingToggle
                                label="البيع السريع النظري"
                                description="إتمام المبيعات النقدية مباشرة دون التأكيد"
                                value={prefs.quickSell}
                                onChange={(v: boolean) => handleChange('quickSell', v)}
                                icon={Zap}
                            />
                            <SettingToggle
                                label="إلزامية فتح الشفت"
                                description="طلب فتح شفت قبل إتمام أي عملية بيع"
                                value={prefs.requireShift || false}
                                onChange={(v: boolean) => handleChange('requireShift', v)}
                                icon={CreditCard}
                            />
                        </div>
                    </div>
                </div>

                {/* Print Configuration */}
                <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6 md:row-span-2">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Printer size={20} />
                        </div>
                        <h3 className="text-base font-black text-text-main">إعدادات طباعة الفاتورة</h3>
                    </div>

                    <div className="space-y-4">
                        {/* Auto Print Toggle */}
                        <div className="flex items-center justify-between p-4 bg-surface-hover/60 rounded-xl border border-border/60">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl border ${prefs.autoPrint ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-surface-hover text-text-muted border-border/60'}`}>
                                    <Printer size={18} />
                                </div>
                                <div>
                                    <p className="font-black text-xs text-text-main">طباعة تلقائية</p>
                                    <p className="text-[11px] text-text-muted font-medium">إرسال أمر الطباعة تلقائياً بعد البيع</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleChange('autoPrint', !prefs.autoPrint)}
                                className={`w-12 h-7 rounded-full transition-colors duration-200 relative border cursor-pointer ${prefs.autoPrint ? 'bg-emerald-500 border-emerald-400' : 'bg-surface-hover border-border/80'}`}
                            >
                                <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${prefs.autoPrint ? 'right-0.5 bg-black' : 'right-[calc(100%-22px)] bg-text-muted'}`} />
                            </button>
                        </div>

                        <div className="p-4 bg-surface-hover/60 rounded-xl border border-border/60">
                            <label className="text-[10px] font-black text-text-muted block mb-2.5 uppercase tracking-wider">عدد النسخ المطبوعة</label>
                            <div className="flex items-center gap-2">
                                {[1, 2, 3].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => handleChange('printCopies', n)}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-colors cursor-pointer border ${(prefs.printCopies || 1) === n
                                            ? 'bg-emerald-500 text-black border-emerald-400'
                                            : 'bg-surface border-border/80 text-text-muted hover:text-text-main'}`}
                                    >
                                        {n} {n === 1 ? 'نسخة' : 'نسخ'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-surface-hover/60 rounded-xl border border-border/60">
                            <label className="text-[10px] font-black text-text-muted block mb-2.5 uppercase tracking-wider">تنسيق ورق الفاتورة</label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleChange('autoPrintFormat', 'thermal')}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-colors cursor-pointer border ${(prefs.autoPrintFormat || 'thermal') === 'thermal' ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-surface border-border/80 text-text-muted hover:text-text-main'}`}
                                >
                                    حراري (Thermal)
                                </button>
                                <button
                                    onClick={() => handleChange('autoPrintFormat', 'a4')}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-colors cursor-pointer border ${prefs.autoPrintFormat === 'a4' ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-surface border-border/80 text-text-muted hover:text-text-main'}`}
                                >
                                    A4 عادي
                                </button>
                            </div>

                            {(prefs.autoPrintFormat || 'thermal') === 'thermal' && (
                                <div className="mt-3.5 pt-3.5 border-t border-border/40 border-dashed">
                                    <label className="text-[10px] font-black text-text-muted block mb-2">عرض الورق الحراري</label>
                                    <div className="flex gap-2">
                                        {['58mm', '80mm', '110mm'].map(size => (
                                            <button
                                                key={size}
                                                onClick={() => handleChange('thermalPaperSize', size)}
                                                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer border ${(prefs.thermalPaperSize || '80mm') === size ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-surface border-border/60 text-text-muted'}`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Printer Assignment */}
                <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            <Tag size={20} />
                        </div>
                        <h3 className="text-base font-black text-text-main">تعيين أسماء الطابعات</h3>
                    </div>

                    <div className="space-y-3.5">
                        <SettingInput
                            label="طابعة الفواتير"
                            value={prefs.receiptPrinter || ''}
                            onChange={(v: string) => handleChange('receiptPrinter', v)}
                            placeholder="اسم الطابعة أو اتركها فارغة للافتراضية"
                        />
                        <SettingInput
                            label="طابعة الملصقات (Barcode)"
                            value={prefs.labelPrinter || ''}
                            onChange={(v: string) => handleChange('labelPrinter', v)}
                            placeholder="اسم الطابعة أو اتركها فارغة للافتراضية"
                        />
                    </div>
                </div>
            </div>

            {/* Discounts Banner */}
            <div
                onClick={() => setShowDiscountManager(true)}
                className="bg-surface border border-border/80 hover:border-emerald-500/40 rounded-2xl p-5 text-text-main cursor-pointer transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                        <Tag size={24} />
                    </div>
                    <div>
                        <h3 className="text-base font-black mb-0.5">إدارة الخصومات والعروض الترويجية</h3>
                        <p className="text-text-muted text-xs font-semibold">إنشاء وضبط كودات الخصم والعروض الخاصة</p>
                    </div>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-hover text-text-muted hover:text-emerald-400 border border-border/60">
                    <ChevronLeft size={20} />
                </div>
            </div>
        </div>
    );
};
