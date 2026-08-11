import React from 'react';
import { Sparkles, Type, Target, DollarSign, Brain, Lightbulb, MessageCircle } from 'lucide-react';
import { AppPreferences } from '../../../core/types';

interface AISettingsProps {
    prefs: AppPreferences;
    handleChange: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
}

const AIFeatureCard = ({ icon: Icon, title }: {
    icon: React.ElementType, title: string
}) => (
    <div className="bg-surface border border-border/80 p-3.5 sm:p-4 rounded-xl cursor-default transition-colors hover:border-success/40 flex items-center gap-3">
        <div className="w-9 h-9 bg-success/10 border border-success/20 text-success rounded-xl flex items-center justify-center shrink-0">
            <Icon size={18} />
        </div>
        <h6 className="font-black text-text-main text-xs">{title}</h6>
    </div>
);

export const AISettings = ({ prefs, handleChange }: AISettingsProps) => {
    return (
        <div className="space-y-4 animate-in fade-in duration-200 select-none">
            {/* Status */}
            <div className="bg-surface border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-3xs">
                <div className="flex items-center gap-3">
                    <Brain size={18} className="text-primary" />
                    <div>
                        <h3 className="text-xs font-black text-text-main">محرك التحليل الذكي</h3>
                        <p className="text-[11px] text-text-muted font-bold">معالجة الاستعلامات وتوقعات المبيعات</p>
                    </div>
                </div>
                <div className="px-2.5 py-1 bg-success/10 text-success rounded-lg font-bold text-xs border border-success/20 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <span>جاهز</span>
                </div>
            </div>

            {/* Features */}
            <div className="bg-surface border border-border/80 rounded-xl p-4 space-y-3 shadow-3xs">
                <h4 className="text-xs font-black text-text-main flex items-center gap-2 pb-2 border-b border-border/60">
                    <Sparkles size={16} className="text-primary" />
                    ميزات الذكاء الاصطناعي
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                    <AIFeatureCard icon={Type} title="توليد الأوصاف" />
                    <AIFeatureCard icon={Target} title="تحسين الأسماء" />
                    <AIFeatureCard icon={DollarSign} title="توصيات التسعير" />
                    <AIFeatureCard icon={MessageCircle} title="المساعد الذكي" />
                    <AIFeatureCard icon={Lightbulb} title="تحليل المبيعات" />
                    <AIFeatureCard icon={Brain} title="تصنيف المصاريف" />
                </div>
            </div>
        </div>
    );
};
