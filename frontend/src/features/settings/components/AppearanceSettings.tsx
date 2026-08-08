
import React from 'react';
import { Palette, Moon, Sparkles, Volume2, Monitor, Type, Globe } from 'lucide-react';
import { AppPreferences } from '../../../core/types';
import { SettingToggle } from './SettingsUI';

interface AppearanceSettingsProps {
    prefs: AppPreferences;
    handleChange: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
}

export const AppearanceSettings = ({ prefs, handleChange }: AppearanceSettingsProps) => {
    return (
        <div className="space-y-5 animate-in fade-in duration-300 pb-8 select-none">
            {/* Header Banner */}
            <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Palette size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-text-main">تخصيص المظهر والتفاعل</h2>
                        <p className="text-text-muted text-xs font-semibold">تخصيص الألوان، وحجم الخطوط، والمؤثرات الصوتية والنمط الداكن</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Main Appearance Controls */}
                <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Monitor size={20} />
                        </div>
                        <h3 className="text-base font-black text-text-main">إعدادات الشاشة واللغة</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-text-muted mb-2">حجم الخط والنصوص</label>
                            <div className="relative">
                                <select
                                    className="w-full min-h-[48px] bg-input-bg border border-border/80 text-text-main rounded-xl py-3 px-4 outline-none focus:border-emerald-400 text-xs font-black appearance-none cursor-pointer transition-colors"
                                    value={prefs.fontSize}
                                    onChange={e => handleChange('fontSize', e.target.value as AppPreferences['fontSize'])}
                                    aria-label="حجم الخط"
                                >
                                    <option value="small" className="bg-surface">صغير</option>
                                    <option value="normal" className="bg-surface">متوسط (افتراضي)</option>
                                    <option value="large" className="bg-surface">كبير</option>
                                    <option value="xl" className="bg-surface">كبير جداً</option>
                                    <option value="2xl" className="bg-surface">عملاق</option>
                                </select>
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                                    <Type size={16} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-text-muted mb-2">لغة النظام / Language</label>
                            <div className="relative">
                                <select
                                    className="w-full min-h-[48px] bg-input-bg border border-border/80 text-text-main rounded-xl py-3 px-4 outline-none focus:border-emerald-400 text-xs font-black appearance-none cursor-pointer transition-colors"
                                    value={prefs.language || 'ar'}
                                    onChange={e => {
                                        const newLang = e.target.value;
                                        handleChange('language', newLang);
                                        import('../../../i18n').then(mod => mod.default.changeLanguage(newLang));
                                    }}
                                    aria-label="اللغة"
                                >
                                    <option value="ar" className="bg-surface">العربية (Arabic)</option>
                                    <option value="en" className="bg-surface">English (الانكليزية)</option>
                                </select>
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                                    <Globe size={16} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Toggles Grid */}
                <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Sparkles size={20} />
                        </div>
                        <h3 className="text-base font-black text-text-main">التأثيرات والوضع الداكن</h3>
                    </div>

                    <div className="space-y-3">
                        <SettingToggle
                            label="الوضع الداكن (Dark Mode)"
                            description="واجهة ليلية مريحة للعين وموفرة للطاقة"
                            value={prefs.theme === 'dark'}
                            onChange={(v: boolean) => handleChange('theme', v ? 'dark' : 'light')}
                            icon={Moon}
                        />
                        <SettingToggle
                            label="المؤثرات الحركة"
                            description="تفعيل التنقلات السلسة بين الصفحات"
                            value={prefs.animationsEnabled}
                            onChange={(v: boolean) => handleChange('animationsEnabled', v)}
                            icon={Sparkles}
                        />
                        <SettingToggle
                            label="التنبيهات الصوتية"
                            description="أصوات تفاعلية عند النقر وتأكيد الحفظ"
                            value={prefs.enableSound}
                            onChange={(v: boolean) => handleChange('enableSound', v)}
                            icon={Volume2}
                        />
                        <SettingToggle
                            label="الوضع المضغوط (Compact)"
                            description="تقليل المسافات لعرض معلومات أكثر بالشاشة"
                            value={prefs.compactMode}
                            onChange={(v: boolean) => handleChange('compactMode', v)}
                            icon={Monitor}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
