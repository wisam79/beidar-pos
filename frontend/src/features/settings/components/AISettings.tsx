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
    <div className="bg-surface border border-border p-5 rounded-2xl hover:scale-105 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-default group">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform text-primary">
            <Icon size={20} />
        </div>
        <h6 className="font-bold text-text-main text-sm mb-1">{title}</h6>
        <p className="text-[10px] text-text-muted leading-relaxed">{description}</p>
    </div>
);

export const AISettings = ({ prefs, handleChange }: AISettingsProps) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Hero Header - Ultra Compact */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-3 text-text-main shadow-sm">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                    <Sparkles size={50} className="text-primary" />
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 dark:bg-white/5 rounded-lg border border-primary/20 dark:border-white/10 text-primary">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold tracking-tight">الذكاء الاصطناعي</h2>
                        <p className="text-text-muted text-[10px] opacity-90">ميزات ذكية مدمجة لإدارة المتجر والمبيعات تلقائياً</p>
                    </div>
                </div>
            </div>

            {/* AI Status Banner */}
            <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Brain className="text-primary" size={20} />
                        محرك الذكاء الاصطناعي
                    </h3>
                    <p className="text-xs text-text-muted mt-1">
                        النظام متصل بالخادم السحابي وجاهز لمعالجة الطلبات
                    </p>
                </div>
                <div className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full font-bold text-xs border border-emerald-500/20 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    متصل (Active)
                </div>
            </div>

            {/* AI Features Grid */}
            <div>
                <h4 className="text-sm font-bold text-text-muted mb-4 flex items-center gap-2 px-1">
                    <Star size={14} className="text-primary" />
                    الميزات الذكية النشطة
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AIFeatureCard
                        icon={Type}
                        title="وصف المنتجات"
                        description="إنشاء أوصاف احترافية وتسويقية للمنتجات تلقائياً بنقرة واحدة"
                    />
                    <AIFeatureCard
                        icon={Target}
                        title="تحسين الأسماء"
                        description="اقتراح أسماء جذابة ومناسبة للمنتجات لزيادة المبيعات"
                    />
                    <AIFeatureCard
                        icon={DollarSign}
                        title="تسعير ذكي"
                        description="اقتراح أسعار بيع تنافسية بناءً على تكلفة المنتج وهوامش الربح"
                    />
                    <AIFeatureCard
                        icon={MessageCircle}
                        title="مساعد ذكي"
                        description="شات بوت للمساعدة في إدارة النظام والإجابة على الأسئلة"
                    />
                    <AIFeatureCard
                        icon={Lightbulb}
                        title="تحليل الأداء"
                        description="رؤى وتوصيات ذكية لتحسين المبيعات وتقليل الهدر"
                    />
                    <AIFeatureCard
                        icon={Brain}
                        title="تصنيف المصروفات"
                        description="تصنيف تلقائي للمصروفات حسب نوعها (إيجار، رواتب، فواتير...)"
                    />
                </div>
            </div>
        </div>
    );
};
