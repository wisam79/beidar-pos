import React, { useState, useEffect } from 'react';
import { TrendingUp, Percent, Package, DollarSign, RotateCcw, PieChart } from 'lucide-react';

export const ProfitCalculator = () => {
    const [cost, setCost] = useState('');
    const [sellPrice, setSellPrice] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [targetMargin, setTargetMargin] = useState('');
    const [vatRate, setVatRate] = useState('0'); // New: VAT support
    const [mode, setMode] = useState<'calculate' | 'findPrice'>('calculate');

    // Calculate profit and margin
    const costNum = parseFloat(cost) || 0;
    const sellNum = parseFloat(sellPrice) || 0;
    const qtyNum = parseFloat(quantity) || 1;
    const marginNum = parseFloat(targetMargin) || 0;
    const vatNum = parseFloat(vatRate) || 0;

    // Calculations
    const unitProfit = sellNum - costNum;
    const totalProfit = unitProfit * qtyNum;
    const profitMargin = sellNum > 0 ? (unitProfit / sellNum) * 100 : 0;
    const markup = costNum > 0 ? (unitProfit / costNum) * 100 : 0;

    // Find Price Mode
    const suggestedPrice = costNum > 0 && marginNum > 0
        ? costNum / (1 - (marginNum / 100))
        : 0;

    const formatNum = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

    const reset = () => {
        setCost('');
        setSellPrice('');
        setQuantity('1');
        setTargetMargin('');
        setVatRate('0');
    };

    const quickMargins = [10, 15, 20, 25, 30];

    return (
        <div className="p-5 w-80 bg-surface border border-border rounded-3xl shadow-2xl flex flex-col gap-5 font-sans select-none">
            {/* Header / Mode Toggle */}
            <div>
                <div className="flex bg-bg/50 p-1 rounded-2xl mb-2">
                    <button
                        onClick={() => setMode('calculate')}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${mode === 'calculate' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' : 'text-text-muted hover:text-text-main'}`}
                    >
                        حساب الربح
                    </button>
                    <button
                        onClick={() => setMode('findPrice')}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${mode === 'findPrice' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'text-text-muted hover:text-text-main'}`}
                    >
                        تحديد السعر
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {/* Cost Input (Common) */}
                <div className="relative group">
                    <label className="text-[10px] text-text-muted font-bold mb-1.5 block px-1">سعر الشراء (التكلفة)</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={cost}
                            onChange={(e) => setCost(e.target.value)}
                            placeholder="0"
                            className="w-full h-12 bg-bg/50 rounded-2xl border border-transparent focus:border-primary/30 focus:bg-bg px-4 pr-10 text-lg font-mono font-bold focus:outline-none transition-all placeholder:text-text-muted/30"
                        />
                        <div className="absolute top-1/2 -translate-y-1/2 left-4 text-text-muted text-xs font-bold">$</div>
                    </div>
                </div>

                {mode === 'calculate' ? (
                    <>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <label className="text-[10px] text-text-muted font-bold mb-1.5 block px-1">سعر البيع</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={sellPrice}
                                        onChange={(e) => setSellPrice(e.target.value)}
                                        placeholder="0"
                                        className="w-full h-12 bg-bg/50 rounded-2xl border border-transparent focus:border-emerald-500/30 focus:bg-bg px-4 pr-10 text-lg font-mono font-bold focus:outline-none transition-all placeholder:text-text-muted/30"
                                    />
                                    <TrendingUp size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500/50" />
                                </div>
                            </div>
                            <div className="relative w-24">
                                <label className="text-[10px] text-text-muted font-bold mb-1.5 block px-1">الكمية</label>
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    placeholder="1"
                                    min="1"
                                    className="w-full h-12 bg-bg/50 rounded-2xl border border-transparent focus:border-primary/30 focus:bg-bg px-2 text-center text-lg font-mono font-bold focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Visual Breakdown Bar */}
                        {sellNum > 0 && (
                            <div className="py-1">
                                <div className="flex justify-between text-[10px] font-bold text-text-muted mb-2 px-1">
                                    <span>التكلفة ({Math.round((costNum / sellNum) * 100)}%)</span>
                                    <span>الربح ({Math.round(profitMargin)}%)</span>
                                </div>
                                <div className="h-4 w-full bg-bg rounded-full overflow-hidden flex shadow-inner">
                                    <div
                                        className="h-full bg-text-muted/20 transition-all duration-500"
                                        style={{ width: `${Math.min((costNum / sellNum) * 100, 100)}%` }}
                                    />
                                    <div
                                        className={`h-full transition-all duration-500 ${unitProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                        style={{ width: `${Math.min(Math.abs((unitProfit / sellNum) * 100), 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Results Card */}
                        <div className="bg-gradient-to-br from-emerald-500/5 to-blue-500/5 border border-emerald-500/10 rounded-3xl p-5 space-y-3 mt-1">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-text-muted">صافي الربح</span>
                                <span className={`font-mono font-black text-3xl tracking-tight ${totalProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {formatNum(totalProfit)}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-dashed border-emerald-500/10">
                                <div className="bg-surface/80 rounded-2xl p-2.5 text-center">
                                    <div className="text-[10px] font-bold text-text-muted mb-1">هامش الربح</div>
                                    <div className={`font-mono font-bold text-lg ${profitMargin >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                        {profitMargin.toFixed(1)}%
                                    </div>
                                </div>
                                <div className="bg-surface/80 rounded-2xl p-2.5 text-center">
                                    <div className="text-[10px] font-bold text-text-muted mb-1">Markup</div>
                                    <div className="font-mono font-bold text-lg text-purple-500">
                                        {markup.toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Find Price Mode Inputs */}
                        <div>
                            <label className="text-[10px] text-text-muted font-bold mb-2 block px-1">هامش الربح المطلوب</label>
                            <div className="flex gap-2 flex-wrap mb-3">
                                {quickMargins.map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setTargetMargin(String(m))}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${targetMargin === String(m) ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-bg border border-border text-text-muted hover:text-text-main hover:border-blue-500/50'}`}
                                    >
                                        {m}%
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={targetMargin}
                                    onChange={(e) => setTargetMargin(e.target.value)}
                                    placeholder="20"
                                    className="w-full h-12 bg-bg/50 rounded-2xl border border-transparent focus:border-blue-500/30 focus:bg-bg px-4 pr-10 text-lg font-mono font-bold focus:outline-none transition-all"
                                />
                                <Percent size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50" />
                            </div>
                        </div>

                        {/* Suggested Price Result */}
                        <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/10 rounded-3xl p-6 text-center mt-2">
                            <div className="text-xs font-bold text-blue-500/70 mb-2">سعر البيع المقترح</div>
                            <div className="text-4xl font-black text-blue-500 font-mono tracking-tighter">
                                {suggestedPrice > 0 ? formatNum(suggestedPrice) : '--'}
                            </div>
                            {suggestedPrice > 0 && (
                                <div className="text-[10px] font-bold text-text-muted mt-3 bg-blue-500/10 rounded-xl py-1.5 px-3 inline-block">
                                    الربح: <span className="text-emerald-500">{formatNum(suggestedPrice - costNum)}</span>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Reset */}
            <button
                onClick={reset}
                className="w-full py-3 bg-bg/50 hover:bg-red-500/5 rounded-2xl text-xs font-bold text-text-muted hover:text-red-500 transition-all flex items-center justify-center gap-2 mt-auto"
            >
                <RotateCcw size={14} />
                تصفير الحاسبة
            </button>
        </div>
    );
};

