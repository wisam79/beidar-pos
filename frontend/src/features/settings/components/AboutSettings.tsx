import React, { useState, useEffect } from 'react';
import {
    Monitor, Code2, Instagram, ShieldCheck, Zap, Cloud,
    Heart, Award, Globe, Cpu, Database, Star, Info, Terminal
} from 'lucide-react';
import { desktopApi } from '../../../core/api';

export const AboutSettings = () => {
    const [version, setVersion] = useState('...');

    useEffect(() => {
        desktopApi.update.getCurrentVersion().then(v => setVersion(v || 'dev')).catch(() => setVersion('dev'));
    }, []);

    return (
        <div className="space-y-5 animate-in fade-in duration-300 pb-8 select-none">
            {/* Header Banner */}
            <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Terminal size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-text-main">حول النظام والإصدار</h2>
                        <p className="text-text-muted text-xs font-semibold">معلومات النسخة، والمطور، وترخيص التطبيق</p>
                    </div>
                </div>
            </div>

            {/* Main Brand Card */}
            <div className="bg-surface border border-border/80 rounded-2xl overflow-hidden p-6 text-center relative">
                <div className="relative inline-block mb-3">
                    <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
                        <Monitor size={32} />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center justify-center">
                        <Star size={12} className="text-amber-400 fill-amber-400" />
                    </div>
                </div>

                <h1 className="text-xl font-black text-text-main mb-0.5">
                    Beidar POS <span className="text-emerald-400">ERP</span>
                </h1>
                <p className="text-xs text-text-muted font-bold mb-4">نظام إداري متكامل لنقاط البيع والمخزون والحسابات</p>

                <div className="flex items-center justify-center gap-2 flex-wrap">
                    <div className="px-3.5 py-1 bg-surface-hover rounded-xl flex items-center gap-2 border border-border/60">
                        <span className="text-text-muted text-xs font-semibold">الإصدار:</span>
                        <code className="text-emerald-400 font-mono font-black text-xs">{version}</code>
                    </div>
                    <div className="px-3 py-1 bg-amber-500/10 rounded-xl flex items-center gap-1.5 border border-amber-500/20">
                        <Award size={13} className="text-amber-400" />
                        <span className="text-amber-400 font-black text-xs">PRO EDITION</span>
                    </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-surface-hover rounded-xl border border-border/60 flex items-center justify-center text-emerald-400">
                            <Code2 size={18} />
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-text-muted font-extrabold uppercase">المطور الرئيسي</p>
                            <p className="font-black text-xs text-text-main">Wisam Samir</p>
                        </div>
                    </div>
                    <a
                        href="https://instagram.com/ly1r"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-emerald-500 text-black rounded-xl font-black text-xs hover:bg-emerald-400 transition-colors cursor-pointer border border-emerald-400"
                    >
                        <Instagram size={14} />
                        <span>@ly1r</span>
                    </a>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-surface rounded-2xl border border-border/80 text-center">
                    <Database size={20} className="text-emerald-400 mx-auto mb-1" />
                    <p className="font-black text-xs text-text-main">تخزين محلي</p>
                    <p className="text-[10px] text-text-muted font-bold">SQLite WAL</p>
                </div>
                <div className="p-3.5 bg-surface rounded-2xl border border-border/80 text-center">
                    <Zap size={20} className="text-amber-400 mx-auto mb-1" />
                    <p className="font-black text-xs text-text-main">سرعة أداء</p>
                    <p className="text-[10px] text-text-muted font-bold">Go Core</p>
                </div>
                <div className="p-3.5 bg-surface rounded-2xl border border-border/80 text-center">
                    <ShieldCheck size={20} className="text-blue-400 mx-auto mb-1" />
                    <p className="font-black text-xs text-text-main">أمان عالي</p>
                    <p className="text-[10px] text-text-muted font-bold">AES Encrypted</p>
                </div>
                <div className="p-3.5 bg-surface rounded-2xl border border-border/80 text-center">
                    <Globe size={20} className="text-purple-400 mx-auto mb-1" />
                    <p className="font-black text-xs text-text-main">واجهة عربية</p>
                    <p className="text-[10px] text-text-muted font-bold">RTL Native</p>
                </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-surface border border-border/80 rounded-2xl flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
                        <Cpu size={18} />
                    </div>
                    <div>
                        <h4 className="font-black text-xs text-text-main">ذكاء اصطناعي محلي</h4>
                        <p className="text-[10px] text-text-muted font-semibold">تحليل متقدم وأوصاف للمنتجات</p>
                    </div>
                </div>
                <div className="p-4 bg-surface border border-border/80 rounded-2xl flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                        <Cloud size={18} />
                    </div>
                    <div>
                        <h4 className="font-black text-xs text-text-main">نسخ سحابي ومحلي</h4>
                        <p className="text-[10px] text-text-muted font-semibold">حفظ آمن واستعادة فورية</p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-2">
                <p className="text-xs font-extrabold text-text-muted flex items-center justify-center gap-1">
                    صُنع بـ <Heart size={12} className="text-red-500 fill-red-500" /> في العراق
                </p>
                <p className="text-[10px] text-text-muted mt-0.5 font-bold opacity-60">© 2026 جميع الحقوق محفوظة - Beidar System</p>
            </div>
        </div>
    );
};
