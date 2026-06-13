import React, { useState, useEffect } from 'react';
import {
    Monitor, Sparkles, Code2, Instagram, ShieldCheck, Zap, Cloud,
    Heart, Award, Globe, Cpu, Database, Star, Info, Terminal, ChevronRight
} from 'lucide-react';
import { desktopApi } from '../../../core/api';

export const AboutSettings = () => {
    const [version, setVersion] = useState('...');

    useEffect(() => {
        desktopApi.update.getCurrentVersion().then(v => setVersion(v || 'dev')).catch(() => setVersion('dev'));
    }, []);

    return (
        <div className="space-y-5 animate-in fade-in duration-500 pb-10">
            {/* Hero Header - Ultra Compact */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-3 text-text-main shadow-sm">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                    <Terminal size={50} className="text-primary" />
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 dark:bg-white/5 rounded-lg border border-primary/20 dark:border-white/10 text-primary">
                        <Info size={18} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold tracking-tight">حول النظام</h2>
                        <p className="text-text-muted text-[10px] opacity-90">معلومات الإصدار، الترخيص، وفريق التطوير</p>
                    </div>
                </div>
            </div>

            {/* Main Brand Card */}
            <div className="relative bg-surface/50 border border-border rounded-2xl overflow-hidden">
                {/* Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />

                <div className="relative p-6 text-center">
                    {/* Logo */}
                    <div className="relative inline-block mb-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-primary to-emerald-500 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 transform hover:scale-105 transition-transform">
                            <Monitor size={36} className="text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-400 rounded-lg flex items-center justify-center shadow-lg">
                            <Star size={14} className="text-amber-900 fill-amber-900" />
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-500 mb-1">
                        Baidar POS
                    </h1>
                    <p className="text-sm text-text-muted mb-4">نظام نقاط البيع الذكي والمتكامل</p>

                    {/* Version & Edition Badges */}
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                        <div className="px-3 py-1.5 bg-surface-active rounded-full flex items-center gap-2 border border-border">
                            <code className="text-primary font-bold text-sm">{version}</code>
                        </div>
                        <div className="px-3 py-1.5 bg-amber-500/10 rounded-full flex items-center gap-1.5 border border-amber-500/20">
                            <Award size={12} className="text-amber-500" />
                            <span className="text-amber-600 dark:text-amber-400 font-bold text-xs">PRO</span>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                {/* Developer Section */}
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-black rounded-xl flex items-center justify-center shadow-lg">
                            <Code2 size={18} className="text-white" />
                        </div>
                        <div>
                            <p className="text-xs text-text-muted">تطوير</p>
                            <p className="font-bold text-sm text-text-main">Wisam Samir</p>
                        </div>
                    </div>
                    <a
                        href="https://instagram.com/ly1r"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-primary text-black rounded-xl font-bold text-xs hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02] transition-all"
                    >
                        <Instagram size={14} />
                        @ly1r
                    </a>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2">
                <div className="p-3 bg-surface/50 rounded-xl border border-border text-center hover:border-primary/30 transition-colors group">
                    <Database size={18} className="text-primary mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
                    <p className="font-bold text-sm text-text-main">محلي</p>
                    <p className="text-[9px] text-text-muted">تخزين سريع</p>
                </div>
                <div className="p-3 bg-surface/50 rounded-xl border border-border text-center hover:border-primary/30 transition-colors group">
                    <Zap size={18} className="text-primary mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
                    <p className="font-bold text-sm text-text-main">فائق</p>
                    <p className="text-[9px] text-text-muted">أداء عالي</p>
                </div>
                <div className="p-3 bg-surface/50 rounded-xl border border-border text-center hover:border-primary/30 transition-colors group">
                    <ShieldCheck size={18} className="text-primary mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
                    <p className="font-bold text-sm text-text-main">آمن</p>
                    <p className="text-[9px] text-text-muted">بنية محمية</p>
                </div>
                <div className="p-3 bg-surface/50 rounded-xl border border-border text-center hover:border-primary/30 transition-colors group">
                    <Globe size={18} className="text-primary mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
                    <p className="font-bold text-sm text-text-main">عربي</p>
                    <p className="text-[9px] text-text-muted">واجهة كاملة</p>
                </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-surface/50 border border-border rounded-xl flex items-center gap-3 hover:border-primary/30 transition-all group">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Cpu size={20} className="text-primary" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-text-main">ذكاء اصطناعي</h4>
                        <p className="text-[10px] text-text-muted">تحليل متقدم للبيانات</p>
                    </div>
                </div>
                <div className="p-4 bg-surface/50 border border-border rounded-xl flex items-center gap-3 hover:border-primary/30 transition-all group">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Cloud size={20} className="text-primary" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-text-main">نسخ سحابي</h4>
                        <p className="text-[10px] text-text-muted">حفظ آمن للبيانات</p>
                    </div>
                </div>
            </div>


            {/* Footer */}
            <div className="text-center pt-2">
                <p className="text-[10px] text-text-muted flex items-center justify-center gap-1">
                    صُنع بـ <Heart size={10} className="text-red-500 fill-red-500" /> في العراق
                </p>
                <p className="text-[9px] text-text-muted mt-0.5 opacity-60">© 2024 جميع الحقوق محفوظة</p>
            </div>
        </div>
    );
};
