import React, { useState, useEffect } from 'react';
import {
    Monitor, Code2, Instagram, ShieldCheck, Zap, Award, Globe, Database
} from 'lucide-react';
import { desktopApi } from '../../../core/api';

export const AboutSettings = () => {
    const [version, setVersion] = useState('...');

    useEffect(() => {
        desktopApi.update.getCurrentVersion().then(v => setVersion(v || 'dev')).catch(() => setVersion('dev'));
    }, []);

    return (
        <div className="space-y-4 animate-in fade-in duration-200 select-none">
            {/* Main Brand Card */}
            <div className="bg-surface border border-border/80 rounded-xl p-5 text-center shadow-3xs">
                <div className="relative inline-block mb-2">
                    <div className="w-14 h-14 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-center mx-auto text-primary">
                        <Monitor size={28} />
                    </div>
                </div>

                <h1 className="text-lg font-black text-text-main mb-0.5">
                    Beidar POS <span className="text-primary">ERP</span>
                </h1>
                <p className="text-[11px] text-text-muted font-bold mb-3">نظام إداري متكامل لنقاط البيع والمخزون</p>

                <div className="flex items-center justify-center gap-2">
                    <div className="px-3 py-1 bg-surface-hover rounded-lg flex items-center gap-1.5 border border-border/60">
                        <span className="text-text-muted text-[11px] font-semibold">الإصدار:</span>
                        <code className="text-primary font-mono font-black text-[11px]">{version}</code>
                    </div>
                    <div className="px-2.5 py-1 bg-warning/10 rounded-lg flex items-center gap-1 border border-warning/20">
                        <Award size={12} className="text-warning" />
                        <span className="text-warning font-black text-[10px]">PRO EDITION</span>
                    </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Code2 size={16} className="text-primary" />
                        <div className="text-right">
                            <p className="text-[9px] text-text-muted font-extrabold uppercase">المطور الرئيسي</p>
                            <p className="font-black text-xs text-text-main">Wisam Samir</p>
                        </div>
                    </div>
                    <a
                        href="https://instagram.com/ly1r"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg font-black text-xs hover:brightness-110 transition-all cursor-pointer"
                    >
                        <Instagram size={14} />
                        <span>@ly1r</span>
                    </a>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-surface rounded-xl border border-border/80 text-center shadow-3xs">
                    <Database size={18} className="text-primary mx-auto mb-1" />
                    <p className="font-black text-xs text-text-main">تخزين محلي</p>
                    <p className="text-[9px] text-text-muted font-bold">SQLite WAL</p>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-border/80 text-center shadow-3xs">
                    <Zap size={18} className="text-warning mx-auto mb-1" />
                    <p className="font-black text-xs text-text-main">سرعة أداء</p>
                    <p className="text-[9px] text-text-muted font-bold">Go Core</p>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-border/80 text-center shadow-3xs">
                    <ShieldCheck size={18} className="text-primary mx-auto mb-1" />
                    <p className="font-black text-xs text-text-main">أمان عالي</p>
                    <p className="text-[9px] text-text-muted font-bold">AES Encrypted</p>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-border/80 text-center shadow-3xs">
                    <Globe size={18} className="text-primary mx-auto mb-1" />
                    <p className="font-black text-xs text-text-main">واجهة عربية</p>
                    <p className="text-[9px] text-text-muted font-bold">RTL Native</p>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-1">
                <p className="text-[10px] text-text-muted font-bold opacity-60">© 2026 جميع الحقوق محفوظة - Beidar System</p>
            </div>
        </div>
    );
};
