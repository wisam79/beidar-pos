
import React from 'react';
import { Store, Upload, Trash2, ImageIcon, Phone, MapPin, FileText, Building2 } from 'lucide-react';
import { AppPreferences } from '../../../core/types';
import { SettingInput } from './SettingsUI';

interface StoreSettingsProps {
    prefs: AppPreferences;
    handleChange: (key: keyof AppPreferences, value: unknown) => void;
    errors: Record<string, string>;
    logoInputRef: React.RefObject<HTMLInputElement>;
    handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const StoreSettings = ({ prefs, handleChange, errors, logoInputRef, handleLogoUpload }: StoreSettingsProps) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Hero Header - Ultra Compact */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-3 text-text-main shadow-sm">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                    <Store size={50} className="text-primary" />
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 dark:bg-white/5 rounded-lg border border-primary/20 dark:border-white/10 text-primary">
                        <Store size={18} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold tracking-tight">إعدادات المتجر</h2>
                        <p className="text-text-muted text-[10px] opacity-90">إدارة معلومات المتجر والشعار والعملة</p>
                    </div>
                </div>
            </div>

            {/* Store Identity Card */}
            <div className="bg-surface/50 border border-border rounded-3xl p-6 shadow-sm overflow-hidden relative group hover:border-primary/30 transition-all duration-300">
                <div className="flex flex-col md:flex-row items-start gap-8">
                    {/* Logo Upload - Premium Look */}
                    <div className="relative shrink-0">
                        <div
                            className={`relative w-40 h-40 rounded-3xl border-2 border-dashed transition-all overflow-hidden cursor-pointer flex items-center justify-center shadow-inner ${prefs.storeLogo
                                ? 'border-primary/30 bg-surface/80'
                                : 'border-border hover:border-primary/50 hover:bg-surface-active'
                                }`}
                            onClick={() => logoInputRef.current?.click()}
                        >
                            {prefs.storeLogo ? (
                                <>
                                    <img src={prefs.storeLogo} alt="شعار المتجر" className="w-full h-full object-contain p-4" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all backdrop-blur-sm">
                                        <Upload size={28} className="text-white mb-2" />
                                        <span className="text-white text-xs font-bold px-3 py-1 bg-white/20 rounded-full border border-white/30">تغيير الصورة</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-text-muted group-hover:text-primary transition-colors gap-2">
                                    <div className="w-12 h-12 bg-surface-active rounded-full flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                        <ImageIcon size={24} className="opacity-70" />
                                    </div>
                                    <span className="text-xs font-bold">رفع الشعار</span>
                                    <span className="text-[9px] opacity-60">PNG, JPG</span>
                                </div>
                            )}
                        </div>
                        {prefs.storeLogo && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleChange('storeLogo', '');
                                }}
                                className="absolute -bottom-2 md:-bottom-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] px-3 py-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 flex items-center gap-1 z-10"
                            >
                                <Trash2 size={10} /> حذف
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

                    {/* Quick Preview & Info */}
                    <div className="flex-1 space-y-4 pt-2">
                        <div>
                            <h3 className="text-lg font-bold text-text-muted uppercase tracking-wider text-[10px] mb-1">المعاينة الحالية</h3>
                            <h2 className="text-2xl font-black text-text-main flex items-center gap-2">
                                {prefs.storeName || 'اسم المتجر غير محدد'}
                                <Building2 size={24} className="text-primary opacity-50" />
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {prefs.storePhone ? (
                                <div className="p-3 bg-surface-active rounded-xl border border-border/50 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                        <Phone size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-text-muted font-bold">الهاتف</p>
                                        <p className="font-mono text-sm dir-ltr">{prefs.storePhone}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-surface-active/30 rounded-xl border border-dashed border-border flex items-center gap-3 opacity-60">
                                    <Phone size={16} /> <span className="text-xs">لم يتم إضافة هاتف</span>
                                </div>
                            )}

                            {prefs.storeAddress ? (
                                <div className="p-3 bg-surface-active rounded-xl border border-border/50 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                        <MapPin size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-text-muted font-bold">العنوان</p>
                                        <p className="text-sm truncate max-w-[150px]">{prefs.storeAddress}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-surface-active/30 rounded-xl border border-dashed border-border flex items-center gap-3 opacity-60">
                                    <MapPin size={16} /> <span className="text-xs">لم يتم إضافة عنوان</span>
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl text-primary/80 text-xs flex items-center gap-2">
                            <ImageIcon size={14} className="shrink-0" />
                            <span>نصيحة: استخدم شعاراً بخلفية شفافة (PNG) بحجم 400x400 بكسل للحصول على أفضل دقة في الفواتير.</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Fields */}
            <div className="bg-surface/50 border border-border rounded-3xl p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">تعديل البيانات</h3>
                        <p className="text-sm text-text-muted">هذه المعلومات ستظهر في جميع الفواتير المطبوعة</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SettingInput
                        label="اسم المتجر"
                        value={prefs.storeName}
                        onChange={(v: string) => handleChange('storeName', v)}
                        placeholder="مثال: سوبرماركت الأمل"
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
                            placeholder="العراق، بغداد، المنصور"
                            icon={MapPin}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <SettingInput
                            label="تذييل الفاتورة"
                            value={prefs.receiptFooter}
                            onChange={(v: string) => handleChange('receiptFooter', v)}
                            placeholder="شكراً لزيارتكم! نتمنى لكم يوماً سعيداً"
                            help="رسالة تظهر أسفل كل فاتورة"
                            icon={FileText}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
