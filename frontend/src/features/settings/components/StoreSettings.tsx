
import React from 'react';
import { Store, Upload, Trash2, ImageIcon, Phone, MapPin, FileText, Building2 } from 'lucide-react';
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
        <div className="space-y-5 animate-in fade-in duration-300 pb-8 select-none">
            {/* Header Banner */}
            <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Store size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-text-main">بيانات وإعلانات المتجر</h2>
                        <p className="text-text-muted text-xs font-semibold">إدارة اسم المتجر والشعار والملاحظات على الفاتورة</p>
                    </div>
                </div>
            </div>

            {/* Store Identity Card */}
            <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6">
                <div className="flex flex-col md:flex-row items-start gap-6">
                    {/* Logo Upload - Flat Look */}
                    <div className="relative shrink-0">
                        <div
                            className={`relative w-36 h-36 rounded-2xl border-2 border-dashed transition-colors overflow-hidden cursor-pointer flex items-center justify-center ${prefs.storeLogo
                                ? 'border-emerald-500/40 bg-surface'
                                : 'border-border/80 hover:border-emerald-500/50 hover:bg-surface-hover'
                                }`}
                            onClick={() => logoInputRef.current?.click()}
                        >
                            {prefs.storeLogo ? (
                                <>
                                    <img src={prefs.storeLogo} alt="شعار المتجر" className="w-full h-full object-contain p-3" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                                        <Upload size={24} className="text-white mb-1.5" />
                                        <span className="text-white text-[11px] font-black px-2.5 py-1 bg-white/20 rounded-lg border border-white/10">تغيير الصورة</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-text-muted group-hover:text-emerald-400 transition-colors gap-1.5">
                                    <div className="w-10 h-10 bg-surface-hover rounded-xl flex items-center justify-center">
                                        <ImageIcon size={22} className="opacity-70 text-emerald-400" />
                                    </div>
                                    <span className="text-xs font-black">رفع الشعار</span>
                                    <span className="text-[10px] font-extrabold opacity-60">PNG, JPG</span>
                                </div>
                            )}
                        </div>
                        {prefs.storeLogo && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleChange('storeLogo', '');
                                }}
                                className="mt-2 text-red-400 hover:text-red-300 text-xs font-black flex items-center gap-1 mx-auto cursor-pointer"
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

                    {/* Quick Preview & Info */}
                    <div className="flex-1 space-y-4 pt-1">
                        <div>
                            <h3 className="text-text-muted uppercase tracking-wider text-[10px] font-black mb-1">المعاينة الحالية للمتجر</h3>
                            <h2 className="text-xl font-black text-text-main flex items-center gap-2">
                                {prefs.storeName || 'اسم المتجر غير محدد'}
                                <Building2 size={20} className="text-emerald-400 opacity-60" />
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {prefs.storePhone ? (
                                <div className="p-3 bg-surface-hover/60 rounded-xl border border-border/40 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                        <Phone size={15} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-text-muted font-extrabold">رقم الهاتف</p>
                                        <p className="font-mono text-xs font-black dir-ltr">{prefs.storePhone}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-surface-hover/30 rounded-xl border border-dashed border-border/60 flex items-center gap-2 opacity-60">
                                    <Phone size={15} /> <span className="text-xs font-bold">لم يتم إدخال الهاتف</span>
                                </div>
                            )}

                            {prefs.storeAddress ? (
                                <div className="p-3 bg-surface-hover/60 rounded-xl border border-border/40 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                        <MapPin size={15} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-text-muted font-extrabold">العنوان</p>
                                        <p className="text-xs font-black truncate max-w-[150px]">{prefs.storeAddress}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-surface-hover/30 rounded-xl border border-dashed border-border/60 flex items-center gap-2 opacity-60">
                                    <MapPin size={15} /> <span className="text-xs font-bold">لم يتم إدخال العنوان</span>
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
                            <ImageIcon size={14} className="shrink-0" />
                            <span>نصيحة: استخدم شعاراً خلفيته شفافة (PNG) لمظهر مثالي وجذاب بالفواتير المطبوعة.</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Fields */}
            <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-text-main">تعديل البيانات الأساسية</h3>
                        <p className="text-xs text-text-muted font-bold">هذه المعلومات تظهر على الفواتير والإيصالات الرسمية</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                            placeholder="شكراً لزيارتكم! البضاعة المباعة تستبدل خلال 3 أيام"
                            help="نص ترحيبي أو شروط البيع أسفل الإيصال"
                            icon={FileText}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
