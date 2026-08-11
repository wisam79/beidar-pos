
import React from 'react';
import { Store, Trash2, ImageIcon, Phone, MapPin, FileText, Building2 } from 'lucide-react';
import { AppPreferences } from '../../../core/types';
import { SettingInput } from './SettingsUI';

interface StoreSettingsProps {
    prefs: AppPreferences;
    handleChange: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
    errors: Record<string, string>;
    logoInputRef: React.RefObject<HTMLInputElement>;
    handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const StoreSettings = ({ prefs, handleChange, errors, logoInputRef, handleLogoUpload }: StoreSettingsProps) => {
    return (
        <div className="space-y-4 animate-in fade-in duration-200 select-none">
            {/* Identity & Logo Grid */}
            <div className="bg-surface border border-border/80 rounded-xl p-4 space-y-4 shadow-3xs">
                <h3 className="text-xs font-black text-text-main flex items-center gap-2 pb-2 border-b border-border/60">
                    <Store size={16} className="text-primary" />
                    بيانات المتجر وشعار الفاتورة
                </h3>

                <div className="flex flex-col sm:flex-row gap-5 items-start">
                    {/* Compact Logo Upload Zone */}
                    <div className="relative shrink-0">
                        <div
                            className={`relative w-28 h-28 rounded-xl border-2 border-dashed transition-all duration-150 overflow-hidden cursor-pointer flex items-center justify-center group ${prefs.storeLogo
                                ? 'border-primary/40 bg-surface'
                                : 'border-border/80 hover:border-primary/60 hover:bg-surface-hover'
                                }`}
                            onClick={() => logoInputRef.current?.click()}
                        >
                            {prefs.storeLogo ? (
                                <>
                                    <img src={prefs.storeLogo} alt="شعار المتجر" className="w-full h-full object-contain p-2" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <span className="text-white text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded border border-white/10">تغيير</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-text-muted group-hover:text-primary transition-colors gap-1 p-2 text-center">
                                    <ImageIcon size={20} className="opacity-70 text-primary" />
                                    <span className="text-[11px] font-bold">رفع الشعار</span>
                                </div>
                            )}
                        </div>
                        {prefs.storeLogo && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleChange('storeLogo', '');
                                }}
                                className="mt-1.5 text-danger hover:text-danger text-[11px] font-bold flex items-center gap-1 mx-auto cursor-pointer"
                            >
                                <Trash2 size={12} /> حذف الشعار
                            </button>
                        )}
                        <input
                            type="file"
                            ref={logoInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            title="تحميل شعار المتجر"
                        />
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 w-full">
                        <SettingInput
                            label="اسم المتجر"
                            value={prefs.storeName}
                            onChange={(v: string) => handleChange('storeName', v)}
                            placeholder="مثال: مجمع السلام"
                            error={errors.storeName}
                            icon={Building2}
                        />
                        <SettingInput
                            label="رقم الهاتف"
                            value={prefs.storePhone}
                            onChange={(v: string) => handleChange('storePhone', v)}
                            placeholder="07xxxxxxxx"
                            error={errors.storePhone}
                            icon={Phone}
                        />
                        <div className="md:col-span-2">
                            <SettingInput
                                label="العنوان"
                                value={prefs.storeAddress}
                                onChange={(v: string) => handleChange('storeAddress', v)}
                                placeholder="بغداد - شارع فلسطين"
                                icon={MapPin}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <SettingInput
                                label="تذييل الفاتورة"
                                value={prefs.receiptFooter}
                                onChange={(v: string) => handleChange('receiptFooter', v)}
                                placeholder="شكراً لزيارتكم!"
                                help="نص أسفل الإيصال"
                                icon={FileText}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
