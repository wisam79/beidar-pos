import React, { useState, useEffect, useCallback } from 'react';
import {
    Brain, Sparkles, TrendingUp, TrendingDown, Package,
    RefreshCw, AlertTriangle, Lightbulb, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';
import { getQuickInsight, generateDailySummary, analyzeInventory, predictSalesTrend } from '../core/ai';
import { api, Product, Sale } from '../core/api';

interface AIInsightsPanelProps {
    todayRevenue: number;
    ordersCount: number;
    lowStockCount: number;
    products?: Product[];
    compact?: boolean;
}

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({
    todayRevenue,
    ordersCount,
    lowStockCount,
    products = [],
    compact = false
}) => {
    const [insight, setInsight] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(!compact);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [detailedAnalysis, setDetailedAnalysis] = useState<string>('');
    const [showDetailed, setShowDetailed] = useState(false);

    const fetchInsight = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getQuickInsight(todayRevenue, ordersCount, lowStockCount);
            setInsight(result);
            setLastUpdate(new Date());
        } catch (e) {
            setInsight('تعذر الحصول على رؤية ذكية الآن');
        }
        setLoading(false);
    }, [todayRevenue, ordersCount, lowStockCount]);

    const fetchDetailedAnalysis = async () => {
        if (detailedAnalysis) {
            setShowDetailed(!showDetailed);
            return;
        }

        setLoading(true);
        try {
            const topProducts = products
                .sort((a, b) => b.price - a.price)
                .slice(0, 5)
                .map(p => p.name);

            const result = await generateDailySummary(
                todayRevenue,
                todayRevenue * 0.9, // Mock yesterday for demo
                ordersCount,
                topProducts,
                lowStockCount
            );
            setDetailedAnalysis(result);
            setShowDetailed(true);
        } catch (e) {
            setDetailedAnalysis('تعذر تحميل التحليل المفصل');
        }
        setLoading(false);
    };

    // Manual refresh only - removed auto-fetch

    if (compact) {
        return (
            <div className="bg-bg border border-border rounded-2xl p-4">
                <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-primary/20 rounded-xl border border-purple-500/30 shrink-0">
                        <Brain size={20} className="text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">رؤية ذكية</h4>
                            <button
                                onClick={fetchInsight}
                                disabled={loading}
                                className="p-1.5 hover:bg-surface-hover rounded-lg transition-colors"
                                title="تحديث الرؤية"
                            >
                                <RefreshCw size={14} className={`text-text-muted hover:text-primary ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        {loading ? (
                            <div className="flex items-center gap-2 text-text-muted text-sm">
                                <Loader2 size={14} className="animate-spin text-purple-400" />
                                جاري التحليل...
                            </div>
                        ) : (
                            <p className="text-sm text-text-main font-medium leading-relaxed whitespace-pre-wrap">{insight || 'اضغط ↻ للحصول على رؤية ذكية'}</p>
                        )}
                        {lastUpdate && (
                            <p className="text-[10px] text-text-muted mt-2">آخر تحديث: {lastUpdate.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div
                className="p-4 bg-bg/50 flex items-center justify-between cursor-pointer border-b border-border"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-lg">
                        <Brain size={22} className="text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-text-main flex items-center gap-2">
                            رؤى ذكية
                            <Sparkles size={14} className="text-amber-400" />
                        </h3>
                        <p className="text-[10px] text-text-muted">
                            {lastUpdate ? `آخر تحديث: ${lastUpdate.toLocaleTimeString('ar-IQ')}` : 'لم يتم التحديث بعد'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); fetchInsight(); }}
                        disabled={loading}
                        className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                        title="تحديث"
                    >
                        <RefreshCw size={16} className={`text-text-muted ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {expanded ? <ChevronUp size={18} className="text-text-muted" /> : <ChevronDown size={18} className="text-text-muted" />}
                </div>
            </div>

            {/* Content */}
            {expanded && (
                <div className="p-4 pt-0 space-y-4">
                    {/* Quick Insight */}
                    <div className="bg-bg/50 rounded-xl p-5 border border-border min-h-[80px]">
                        {loading && !insight ? (
                            <div className="flex items-center justify-center gap-3 py-4 text-text-muted">
                                <Loader2 size={20} className="animate-spin text-primary" />
                                <span className="text-sm">جاري تحليل البيانات بالذكاء الاصطناعي...</span>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3">
                                <Lightbulb size={20} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-text-main leading-relaxed whitespace-pre-wrap">{insight || 'اضغط لتحديث للحصول على رؤية ذكية'}</p>
                            </div>
                        )}
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                            <TrendingUp size={18} className="text-emerald-400 mx-auto mb-1" />
                            <p className="text-xl font-black text-emerald-400">{ordersCount}</p>
                            <p className="text-[10px] text-text-muted font-medium">طلب اليوم</p>
                        </div>
                        <div className={`${lowStockCount > 5 ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'} border rounded-xl p-4 text-center`}>
                            {lowStockCount > 5 ? (
                                <AlertTriangle size={18} className="text-red-400 mx-auto mb-1" />
                            ) : (
                                <Package size={18} className="text-amber-400 mx-auto mb-1" />
                            )}
                            <p className={`text-xl font-black ${lowStockCount > 5 ? 'text-red-400' : 'text-amber-400'}`}>{lowStockCount}</p>
                            <p className="text-[10px] text-text-muted font-medium">مخزون منخفض</p>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
                            <TrendingUp size={18} className="text-blue-400 mx-auto mb-1" />
                            <p className="text-xl font-black text-blue-400">{products.length}</p>
                            <p className="text-[10px] text-text-muted font-medium">عميل</p>
                        </div>
                    </div>

                    {/* Detailed Analysis Button */}
                    <button
                        onClick={fetchDetailedAnalysis}
                        disabled={loading}
                        className="w-full py-3.5 bg-surface hover:bg-surface-hover border border-border rounded-xl text-text-main text-sm font-bold transition-all flex items-center justify-center gap-2 touch-target active:scale-[0.98]"
                    >
                        {loading && !detailedAnalysis ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                جاري التحليل...
                            </>
                        ) : (
                            <>
                                <Sparkles size={18} />
                                {showDetailed ? 'إخفاء التحليل المفصل' : 'تحليل مفصل بالذكاء الاصطناعي'}
                            </>
                        )}
                    </button>

                    {/* Detailed Analysis Content */}
                    {showDetailed && detailedAnalysis && (
                        <div className="bg-bg/50 rounded-xl p-5 border border-border">
                            <p className="text-sm text-text-main leading-relaxed whitespace-pre-wrap">{detailedAnalysis}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
