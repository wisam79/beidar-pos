
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
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Hero Header - Ultra Compact */}
            <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-3 text-text-main shadow-sm">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                    <Palette size={50} className="text-primary" />
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 text-primary">
                        <Palette size={18} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold tracking-tight">تخصيص المظهر</h2>
                        <p className="text-text-muted text-[10px] opacity-90">اجعل النظام يعكس هويتك وتفضيلاتك</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Main Appearance Controls */}
                <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary">
                            <Monitor size={24} />
                        </div>
                        <h3 className="text-xl font-bold">إعدادات العرض</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] text-text-muted font-bold uppercase mb-2">حجم الخط</label>
                            <div className="relative">
                                <select
                                    className="w-full bg-input-bg border border-border text-text-main rounded-lg py-3 px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-bold appearance-none cursor-pointer transition-all"
                                    value={prefs.fontSize}
                                    onChange={e => handleChange('fontSize', e.target.value as AppPreferences['fontSize'])}
                                    aria-label="حجم الخط"
                                >
                                    <option value="small" className="bg-bg">صغير</option>
                                    <option value="normal" className="bg-bg">متوسط (افتراضي)</option>
                                    <option value="large" className="bg-bg">كبير</option>
                                    <option value="xl" className="bg-bg">كبير جداً</option>
                                    <option value="2xl" className="bg-bg">عملاق</option>
                                </select>
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                                    <Type size={16} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] text-text-muted font-bold uppercase mb-2">اللغة / Language</label>
                            <div className="relative">
                                <select
                                    className="w-full bg-input-bg border border-border text-text-main rounded-lg py-3 px-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-bold appearance-none cursor-pointer transition-all"
                                    value={prefs.language || 'ar'}
                                    onChange={e => {
                                        const newLang = e.target.value;
                                        handleChange('language', newLang);
                                        import('../../../i18n').then(mod => mod.default.changeLanguage(newLang));
                                    }}
                                    aria-label="اللغة"
                                >
                                    <option value="ar" className="bg-bg">العربية</option>
                                    <option value="en" className="bg-bg">English</option>
                                </select>
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                                    <Globe size={16} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Toggles Grid */}
                <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary">
                            <Sparkles size={24} />
                        </div>
                        <h3 className="text-xl font-bold">التأثيرات والتفاعل</h3>
                    </div>

                    <div className="space-y-4">
                        <SettingToggle
                            label="الوضع الليلي"
                            description="واجهة داكنة مريحة للعين"
                            value={prefs.theme === 'dark'}
                            onChange={(v: boolean) => handleChange('theme', v ? 'dark' : 'light')}
                            icon={Moon}
                        />
                        <SettingToggle
                            label="مؤثرات بصرية"
                            description="الحركات والشفافية والتأثيرات"
                            value={prefs.animationsEnabled}
                            onChange={(v: boolean) => handleChange('animationsEnabled', v)}
                            icon={Sparkles}
                        />
                        <SettingToggle
                            label="مؤثرات صوتية"
                            description="أصوات عند النقر والمسح"
                            value={prefs.enableSound}
                            onChange={(v: boolean) => handleChange('enableSound', v)}
                            icon={Volume2}
                        />
                        <SettingToggle
                            label="وضع مضغوط"
                            description="عرض أكثر في مساحة أقل"
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
