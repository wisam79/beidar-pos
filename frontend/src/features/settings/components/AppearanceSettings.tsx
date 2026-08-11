
import React from 'react';
import { Moon, Sparkles, Volume2, Monitor, Type, Globe } from 'lucide-react';
import { AppPreferences } from '../../../core/types';
import { SettingToggle } from './SettingsUI';

interface AppearanceSettingsProps {
    prefs: AppPreferences;
    handleChange: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
}

export const AppearanceSettings = ({ prefs, handleChange }: AppearanceSettingsProps) => {
    return (
        <div className="space-y-4 animate-in fade-in duration-200 select-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Screen & Language */}
                <div className="bg-surface border border-border/80 rounded-xl p-4 space-y-4 shadow-3xs">
                    <h3 className="text-xs font-black text-text-main flex items-center gap-2 pb-2 border-b border-border/60">
                        <Monitor size={16} className="text-primary" />
                        الشاشة واللغة
                    </h3>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-[11px] font-bold text-text-muted mb-1 px-0.5">حجم الخط</label>
                            <div className="relative">
                                <select
                                    className="w-full h-10 bg-bg/80 dark:bg-black/30 border border-border/80 text-text-main rounded-lg px-3 outline-none focus:border-primary text-xs font-bold appearance-none cursor-pointer"
                                    value={prefs.fontSize || 'normal'}
                                    onChange={e => handleChange('fontSize', e.target.value as AppPreferences['fontSize'])}
                                    aria-label="حجم الخط"
                                >
                                    <option value="small" className="bg-surface">صغير</option>
                                    <option value="normal" className="bg-surface">متوسط (افتراضي)</option>
                                    <option value="large" className="bg-surface">كبير</option>
                                    <option value="xl" className="bg-surface">كبير جداً</option>
                                    <option value="2xl" className="bg-surface">عملاق</option>
                                </select>
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                                    <Type size={14} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-text-muted mb-1 px-0.5">لغة النظام</label>
                            <div className="relative">
                                <select
                                    className="w-full h-10 bg-bg/80 dark:bg-black/30 border border-border/80 text-text-main rounded-lg px-3 outline-none focus:border-primary text-xs font-bold appearance-none cursor-pointer"
                                    value={prefs.language || 'ar'}
                                    onChange={e => {
                                        const newLang = e.target.value;
                                        handleChange('language', newLang);
                                        import('../../../i18n').then(mod => mod.default.changeLanguage(newLang));
                                    }}
                                    aria-label="اللغة"
                                >
                                    <option value="ar" className="bg-surface">العربية</option>
                                    <option value="en" className="bg-surface">English</option>
                                </select>
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                                    <Globe size={14} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Theme & Options */}
                <div className="bg-surface border border-border/80 rounded-xl p-4 space-y-4 shadow-3xs">
                    <h3 className="text-xs font-black text-text-main flex items-center gap-2 pb-2 border-b border-border/60">
                        <Sparkles size={16} className="text-primary" />
                        المظهر والتأثيرات
                    </h3>

                    <div className="space-y-2">
                        <SettingToggle
                            label="الوضع الداكن"
                            value={prefs.theme === 'dark'}
                            onChange={(v: boolean) => handleChange('theme', v ? 'dark' : 'light')}
                            icon={Moon}
                        />
                        <SettingToggle
                            label="المؤثرات الحركية"
                            value={prefs.animationsEnabled}
                            onChange={(v: boolean) => handleChange('animationsEnabled', v)}
                            icon={Sparkles}
                        />
                        <SettingToggle
                            label="الأصوات والتنبيهات"
                            value={prefs.enableSound}
                            onChange={(v: boolean) => handleChange('enableSound', v)}
                            icon={Volume2}
                        />
                        <SettingToggle
                            label="الواجهة المضغوطة"
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
