import React from 'react';
import { Sparkles, Type, Target, DollarSign, Brain, Lightbulb, MessageCircle, Star } from 'lucide-react';
import { AppPreferences } from '../../../core/types';

interface AISettingsProps {
    prefs: AppPreferences;
    handleChange: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
}

// Feature card component
const AIFeatureCard = ({ icon: Icon, title, description }: {
    icon: React.ElementType, title: string, description: string
}) => (
    <div className="bg-surface border border-border/80 p-4 sm:p-5 rounded-2xl cursor-default transition-colors hover:border-emerald-500/40">
        <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center mb-3">
            <Icon size={20} />
        </div>
        <h6 className="font-black text-text-main text-sm mb-1">{title}</h6>
        <p className="text-xs text-text-muted leading-relaxed font-semibold">{description}</p>
    </div>
);

export const AISettings = ({ prefs, handleChange }: AISettingsProps) => {
    return (
        <div className="space-y-5 animate-in fade-in duration-300 pb-8 select-none">
            {/* Header Banner */}
            <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Sparkles size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-text-main">مساعد الذكاء الاصطناعي (AI Core)</h2>
                        <p className="text-text-muted text-xs font-semibold">ميزات ذكية مدمجة لتحليل المبيعات والتسعير وإنشاء الأوصاف</p>
                    </div>
                </div>
            </div>

            {/* AI Status Banner */}
            <div className="bg-surface border border-border/80 rounded-2xl p-5 sm:p-6 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Brain size={22} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-text-main flex items-center gap-2">
                            محرك التنبؤات والتحليل الذكي
                        </h3>
                        <p className="text-xs text-text-muted font-semibold mt-0.5">
                            المحرك يعمل محلياً ومستعد لمعالجة استعلاماتك وتوقعات المبيعات
                        </p>
                    </div>
                </div>
                <div className="px-3.5 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-xl font-black text-xs border border-emerald-500/20 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    جاهز (Ready)
                </div>
            </div>

            {/* AI Features Grid */}
            <div>
                <h4 className="text-xs font-black text-text-muted mb-3 flex items-center gap-1.5 px-1">
                    <Star size={14} className="text-amber-400" />
                    الميزات المتاحة بالنظام
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AIFeatureCard
                        icon={Type}
                        title="توليد أوصاف المنتجات"
                        description="إنشاء أوصاف تسويقية دقيقة للمنتجات تلقائياً بنقرة واحدة"
                    />
                    <AIFeatureCard
                        icon={Target}
                        title="تحسين أسماء الأصناف"
                        description="اقتراح أسماء جذابة ومناسبة للمنتجات لزيادة المبيعات"
                    />
                    <AIFeatureCard
                        icon={DollarSign}
                        title="توصيات التسعير"
                        description="اقتراح أسعار بيع تنافسية بناءً على التكلفة وهامش الربح"
                    />
                    <AIFeatureCard
                        icon={MessageCircle}
                        title="المساعد الذكي (AI Chat)"
                        description="شات بوت تفاعلي للإجابة عن التساؤلات وإصدار التقارير"
                    />
                    <AIFeatureCard
                        icon={Lightbulb}
                        title="تحليل الأداء اليومي"
                        description="رؤى وتوصيات ذكية لتحسين مبيعات المحل وتجنب النواقص"
                    />
                    <AIFeatureCard
                        icon={Brain}
                        title="التصنيف التلقائي للمصاريف"
                        description="تصنيف مصروفات النظام تلقائياً (إيجار، رواتب، تجهيزات...)"
                    />
                </div>
            </div>
        </div>
    );
};
