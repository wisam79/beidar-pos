
import React from 'react';
import { CreditCard, Printer, Zap, Tag, ChevronLeft } from 'lucide-react';
import { AppPreferences } from '../../../core/types';
import { SettingInput, SettingToggle } from './SettingsUI';

interface SalesSettingsProps {
    prefs: AppPreferences;
    handleChange: (key: keyof AppPreferences, value: unknown) => void;
    errors: Record<string, string>;
    setShowDiscountManager: (show: boolean) => void;
}

export const SalesSettings = ({ prefs, handleChange, errors, setShowDiscountManager }: SalesSettingsProps) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Hero Header - Ultra Compact */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-3 text-text-main shadow-sm">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                    <CreditCard size={50} className="text-primary" />
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 dark:bg-white/5 rounded-lg border border-primary/20 dark:border-white/10 text-primary">
                        <CreditCard size={18} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold tracking-tight">إعدادات المبيعات</h2>
                        <p className="text-text-muted text-[10px] opacity-90">تخصيص تجربة نقطة البيع والطباعة</p>
                    </div>
                </div>
            </div>

            {/* Main Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* General Sales Behavior */}
                <div className="bg-surface/50 border border-border rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary/10 rounded-xl text-primary">
                            <Zap size={24} />
                        </div>
                        <h3 className="text-xl font-bold">سلوك البيع</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <SettingInput label="العملة" value={prefs.currency} onChange={(v: string) => handleChange('currency', v)} placeholder="IQD" />
                            <SettingInput label="الهدف اليومي" value={prefs.dailySalesTarget} onChange={(v: string) => handleChange('dailySalesTarget', Number(v))} type="number" suffix={prefs.currency} error={errors.dailySalesTarget} />
                        </div>
                        <div className="pt-2">
                            <SettingToggle
                                label="البيع السريع"
                                description="إتمام المبيعات النقدية بنقرة واحدة دون تأكيد"
                                value={prefs.quickSell}
                                onChange={(v: boolean) => handleChange('quickSell', v)}
                                icon={Zap}
                            />
                            <SettingToggle
                                label="نظام الشفتات"
                                description="طلب فتح شفت قبل إتمام أي عملية بيع"
                                value={prefs.requireShift || false}
                                onChange={(v: boolean) => handleChange('requireShift', v)}
                                icon={CreditCard}
                            />
                        </div>
                    </div>
                </div>

                {/* Print Configuration */}
                <div className="bg-surface/50 border border-border rounded-3xl p-6 shadow-sm md:row-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary/10 rounded-xl text-primary">
                            <Printer size={24} />
                        </div>
                        <h3 className="text-xl font-bold">إعدادات الطباعة</h3>
                    </div>

                    <div className="space-y-4">
                        {/* Auto Print Toggle */}
                        <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-border hover:border-primary/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${prefs.autoPrint ? 'bg-primary text-black' : 'bg-gray-200 dark:bg-gray-700 text-text-muted'} transition-colors`}>
                                    <Printer size={18} />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">طباية تلقائية</p>
                                    <p className="text-[10px] text-text-muted">طباعة الفاتورة مباشرة بعد البيع</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={prefs.autoPrint}
                                    onChange={() => handleChange('autoPrint', !prefs.autoPrint)}
                                    aria-label="تفعيل الطباعة التلقائية"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                            </label>
                        </div>

                        <div className="p-4 bg-surface rounded-xl border border-border">
                            <label className="text-[10px] font-bold text-text-muted block mb-3 uppercase tracking-wider">عدد النسخ</label>
                            <div className="flex items-center gap-2">
                                {[1, 2, 3].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => handleChange('printCopies', n)}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all relative overflow-hidden ${(prefs.printCopies || 1) === n
                                            ? 'bg-primary text-black shadow-lg shadow-primary/20'
                                            : 'bg-surface-active text-text-muted hover:text-text-main'}`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-surface rounded-xl border border-border">
                            <label className="text-[10px] font-bold text-text-muted block mb-3 uppercase tracking-wider">تنسيق الطباعة</label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleChange('autoPrintFormat', 'thermal')}
                                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${(prefs.autoPrintFormat || 'thermal') === 'thermal' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'bg-surface-active text-text-muted hover:text-text-main'}`}
                                >
                                    حراري (Thermal)
                                </button>
                                <button
                                    onClick={() => handleChange('autoPrintFormat', 'a4')}
                                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${prefs.autoPrintFormat === 'a4' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'bg-surface-active text-text-muted hover:text-text-main'}`}
                                >
                                    A4 عادي
                                </button>
                            </div>

                            {(prefs.autoPrintFormat || 'thermal') === 'thermal' && (
                                <div className="mt-4 pt-4 border-t border-border border-dashed">
                                    <label className="text-[10px] font-bold text-text-muted block mb-2">عرض الورق الحراري</label>
                                    <div className="flex gap-2">
                                        {['58mm', '80mm', '110mm'].map(size => (
                                            <button
                                                key={size}
                                                onClick={() => handleChange('thermalPaperSize', size)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${(prefs.thermalPaperSize || '80mm') === size ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-active text-text-muted'}`}
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
                <div className="bg-surface/50 border border-border rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary/10 rounded-xl text-primary">
                            <Tag size={24} />
                        </div>
                        <h3 className="text-xl font-bold">تعيين الطابعات</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-surface rounded-xl border border-border">
                            <label className="text-[10px] font-bold text-text-muted block mb-2">طابعة الفواتير</label>
                            <input
                                 type="text"
                                value={prefs.receiptPrinter || ''}
                                onChange={e => handleChange('receiptPrinter', e.target.value)}
                                placeholder="اسم الطابعة أو فارغ للافتراضية"
                                className="w-full bg-surface-active/50 border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-primary transition-colors"
                            />
                        </div>
                        <div className="p-4 bg-surface rounded-xl border border-border">
                            <label className="text-[10px] font-bold text-text-muted block mb-2">طابعة الملصقات (Barcode)</label>
                            <input
                                type="text"
                                value={prefs.labelPrinter || ''}
                                onChange={e => handleChange('labelPrinter', e.target.value)}
                                placeholder="اسم الطابعة أو فارغ للافتراضية"
                                className="w-full bg-surface-active/50 border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-primary transition-colors"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Discounts Banner */}
            <div
                onClick={() => setShowDiscountManager(true)}
                className="group relative overflow-hidden bg-surface/50 border border-border hover:border-primary/30 rounded-3xl p-6 text-text-main cursor-pointer shadow-sm transform hover:scale-[1.01] transition-all duration-300 hover:bg-surface-hover"
            >
                <div className="absolute top-0 left-0 p-4 opacity-10">
                    <Tag size={120} className="text-primary" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-primary/10 dark:bg-white/5 rounded-2xl border border-primary/20 dark:border-white/10 text-primary group-hover:rotate-12 transition-transform duration-300">
                            <Tag size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black mb-1">إدارة الخصومات والعروض</h3>
                            <p className="text-text-muted opacity-90 text-sm">إنشاء وإدارة كوبونات الخصم والعروض الترويجية</p>
                        </div>
                    </div>
                    <div className="bg-surface-active p-3 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
                        <ChevronLeft size={24} />
                    </div>
                </div>
            </div>
        </div>
    );

};
