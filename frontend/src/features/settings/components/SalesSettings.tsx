
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
        <div className="space-y-4 animate-in fade-in duration-200 select-none">
            {/* Main Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Sales Behavior */}
                <div className="bg-surface border border-border/80 rounded-xl p-4 space-y-4 shadow-3xs">
                    <h3 className="text-xs font-black text-text-main flex items-center gap-2 pb-2 border-b border-border/60">
                        <Zap size={16} className="text-primary" />
                        سلوك عملية البيع
                    </h3>

                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <SettingInput label="العملة" value={prefs.currency} onChange={(v: string) => handleChange('currency', v)} placeholder="IQD" />
                            <SettingInput label="الهدف اليومي" value={prefs.dailySalesTarget} onChange={(v: string) => handleChange('dailySalesTarget', Number(v))} type="number" suffix={prefs.currency} error={errors.dailySalesTarget} />
                        </div>
                        <div className="space-y-2 pt-1">
                            <SettingToggle
                                label="البيع السريع المباشر"
                                value={prefs.quickSell}
                                onChange={(v: boolean) => handleChange('quickSell', v)}
                                icon={Zap}
                            />
                            <SettingToggle
                                label="إلزامية فتح الشفت للبيع"
                                value={prefs.requireShift || false}
                                onChange={(v: boolean) => handleChange('requireShift', v)}
                                icon={CreditCard}
                            />
                        </div>
                    </div>
                </div>

                {/* Printer Assignment */}
                <div className="bg-surface border border-border/80 rounded-xl p-4 space-y-4 shadow-3xs">
                    <h3 className="text-xs font-black text-text-main flex items-center gap-2 pb-2 border-b border-border/60">
                        <Printer size={16} className="text-primary" />
                        أسماء الطابعات
                    </h3>

                    <div className="space-y-3">
                        <SettingInput
                            label="طابعة الفواتير"
                            value={prefs.receiptPrinter || ''}
                            onChange={(v: string) => handleChange('receiptPrinter', v)}
                            placeholder="الافتراضية"
                        />
                        <SettingInput
                            label="طابعة الباركود"
                            value={prefs.labelPrinter || ''}
                            onChange={(v: string) => handleChange('labelPrinter', v)}
                            placeholder="الافتراضية"
                        />
                    </div>
                </div>

                {/* Print Options */}
                <div className="bg-surface border border-border/80 rounded-xl p-4 space-y-4 shadow-3xs md:col-span-2">
                    <h3 className="text-xs font-black text-text-main flex items-center gap-2 pb-2 border-b border-border/60">
                        <Printer size={16} className="text-primary" />
                        إعدادات الطباعة والخصومات
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Auto Print */}
                        <div className="flex items-center justify-between p-3 bg-bg/80 dark:bg-black/30 rounded-lg border border-border/80">
                            <div>
                                <p className="font-bold text-xs text-text-main">طباعة تلقائية</p>
                                <p className="text-[10px] text-text-muted">طباعة الإيصال بعد كل عملية بيع</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleChange('autoPrint', !prefs.autoPrint)}
                                className={`w-10 h-6 rounded-full transition-colors relative border cursor-pointer ${prefs.autoPrint ? 'bg-primary border-primary' : 'bg-surface-hover border-border/80'}`}
                            >
                                <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${prefs.autoPrint ? 'right-0.5 bg-black' : 'right-[calc(100%-18px)] bg-text-muted'}`} />
                            </button>
                        </div>

                        {/* Copies */}
                        <div className="p-3 bg-bg/80 dark:bg-black/30 rounded-lg border border-border/80">
                            <label className="text-[10px] font-bold text-text-muted block mb-1.5 uppercase">عدد النسخ</label>
                            <div className="flex items-center gap-1.5">
                                {[1, 2, 3].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => handleChange('printCopies', n)}
                                        className={`flex-1 py-1.5 rounded-md text-xs font-black transition-colors cursor-pointer border ${(prefs.printCopies || 1) === n
                                            ? 'bg-primary text-white border-primary'
                                            : 'bg-surface border-border/80 text-text-muted hover:text-text-main'}`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Paper Format */}
                        <div className="p-3 bg-bg/80 dark:bg-black/30 rounded-lg border border-border/80">
                            <label className="text-[10px] font-bold text-text-muted block mb-1.5 uppercase">نوع الورق</label>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => handleChange('autoPrintFormat', 'thermal')}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-black transition-colors cursor-pointer border ${(prefs.autoPrintFormat || 'thermal') === 'thermal' ? 'bg-primary text-white border-primary' : 'bg-surface border-border/80 text-text-muted hover:text-text-main'}`}
                                >
                                    حراري
                                </button>
                                <button
                                    onClick={() => handleChange('autoPrintFormat', 'a4')}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-black transition-colors cursor-pointer border ${prefs.autoPrintFormat === 'a4' ? 'bg-primary text-white border-primary' : 'bg-surface border-border/80 text-text-muted hover:text-text-main'}`}
                                >
                                    A4
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Discounts trigger button */}
                    <button
                        type="button"
                        onClick={() => setShowDiscountManager(true)}
                        className="w-full flex items-center justify-between p-3 bg-bg/80 dark:bg-black/30 border border-border/80 hover:border-primary/50 rounded-lg transition-all cursor-pointer group active:scale-[0.99]"
                    >
                        <div className="flex items-center gap-2.5">
                            <Tag size={16} className="text-primary" />
                            <span className="font-bold text-text-main text-xs">إدارة كودات الخصم والعروض الترويجية</span>
                        </div>
                        <ChevronLeft size={16} className="text-text-muted group-hover:text-primary transition-colors" />
                    </button>
                </div>
            </div>
        </div>
    );
};
