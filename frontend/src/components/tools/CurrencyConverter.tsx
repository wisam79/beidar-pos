import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, DollarSign, Settings2, Zap, Calculator as CalcIcon } from 'lucide-react';

interface Currency {
    code: string;
    name: string;
    symbol: string;
    flag: string;
}

const CURRENCIES: Currency[] = [
    { code: 'USD', name: 'دولار أمريكي', symbol: '$', flag: '🇺🇸' },
    { code: 'IQD', name: 'دينار عراقي', symbol: 'IQD', flag: '🇮🇶' },
    { code: 'EUR', name: 'يورو', symbol: '€', flag: '🇪🇺' },
    { code: 'GBP', name: 'جنيه إسترليني', symbol: '£', flag: '🇬🇧' },
    { code: 'AED', name: 'درهم إماراتي', symbol: 'AED', flag: '🇦🇪' },
    { code: 'SAR', name: 'ريال سعودي', symbol: 'SAR', flag: '🇸🇦' },
    { code: 'TRY', name: 'ليرة تركية', symbol: '₺', flag: '🇹🇷' },
];

const DEFAULT_RATES: Record<string, number> = {
    'USD': 1500,
    'IQD': 1,
    'EUR': 1600,
    'GBP': 1900,
    'AED': 400,
    'SAR': 400,
    'TRY': 45,
};

const QUICK_AMOUNTS = [1, 5, 10, 50, 100, 500];

export const CurrencyConverter = () => {
    const [rates, setRates] = useState(DEFAULT_RATES);
    const [amount, setAmount] = useState('');
    const [fromCurrency, setFromCurrency] = useState('USD');
    const [toCurrency, setToCurrency] = useState('IQD');
    const [isEditingRates, setIsEditingRates] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        const savedRates = localStorage.getItem('beidar_exchange_rates');
        if (savedRates) {
            try {
                setRates({ ...DEFAULT_RATES, ...JSON.parse(savedRates) });
            } catch (e) { /* ignore */ }
        }
    }, []);

    const saveRate = (code: string, value: number) => {
        const newRates = { ...rates, [code]: value };
        setRates(newRates);
        localStorage.setItem('beidar_exchange_rates', JSON.stringify(newRates));
    };

    // Safe math evaluation for input (e.g., "50*5")
    const evaluateAmount = (expr: string): number => {
        try {
            if (!expr) return 0;
            // Allow basic math chars only
            const sanitized = expr.replace(/[^0-9+\-*/.]/g, '');
            if (!sanitized) return 0;
            // Check if ends with operator
            if (/[+\-*/]$/.test(sanitized)) return 0;
            const result = Function('"use strict"; return (' + sanitized + ')')();
            return typeof result === 'number' && isFinite(result) ? result : 0;
        } catch {
            return 0;
        }
    };

    const convert = () => {
        const val = evaluateAmount(amount);
        if (val <= 0) return 0;
        const inIQD = val * (rates[fromCurrency] || 1);
        const result = inIQD / (rates[toCurrency] || 1);
        return result;
    };

    const swapCurrencies = () => {
        setIsAnimating(true);
        setFromCurrency(toCurrency);
        setToCurrency(fromCurrency);
        setTimeout(() => setIsAnimating(false), 500);
    };

    const result = convert();
    const fromCurr = CURRENCIES.find(c => c.code === fromCurrency)!;
    const toCurr = CURRENCIES.find(c => c.code === toCurrency)!;

    // Check if input has math operation
    const hasMath = new RegExp('[+\\-*/]').test(amount);

    return (
        <div className="p-4 w-80 bg-surface flex flex-col gap-4 font-sans select-none">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center border border-blue-500/10">
                        <DollarSign size={16} className="text-blue-400" />
                    </div>
                    <span className="text-xs font-bold text-text-main">
                        سعر الصرف: <span className="font-mono text-emerald-400">{rates['USD']}</span> IQD
                    </span>
                </div>
                <button
                    onClick={() => setIsEditingRates(!isEditingRates)}
                    className={`p-2 rounded-xl transition-all ${isEditingRates ? 'bg-primary/20 text-primary' : 'hover:bg-white/10 text-text-muted hover:text-text-main'}`}
                    title="تعديل الأسعار"
                >
                    <Settings2 size={16} />
                </button>
            </div>

            {/* Rate Editor */}
            {isEditingRates && (
                <div className="bg-bg/50 p-3 rounded-xl border border-dashed border-white/10 space-y-2 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                        {CURRENCIES.filter(c => c.code !== 'IQD').map(curr => (
                            <div key={curr.code} className="flex items-center gap-1.5">
                                <span className="text-xs w-6">{curr.flag}</span>
                                <input
                                    type="number"
                                    value={rates[curr.code]}
                                    onChange={(e) => saveRate(curr.code, parseFloat(e.target.value) || 0)}
                                    className="flex-1 bg-bg border border-border rounded-lg p-1 text-xs font-mono text-center focus:outline-none focus:border-primary"
                                    placeholder="Rate"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Converter Area */}
            <div className="relative">
                {/* Inputs Stack */}
                <div className="flex flex-col gap-3">
                    {/* FROM */}
                    <div className="bg-bg rounded-2xl p-3 border border-border focus-within:border-primary/50 transition-colors">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-text-muted font-bold">من</span>
                            {hasMath && <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1"><CalcIcon size={10} /> عملية حسابية</span>}
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                title="عملة المصدر"
                                value={fromCurrency}
                                onChange={(e) => setFromCurrency(e.target.value)}
                                className="bg-transparent text-sm font-bold text-text-muted focus:outline-none cursor-pointer appearance-none py-1"
                            >
                                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} {c.flag}</option>)}
                            </select>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0"
                                className="flex-1 bg-transparent text-right text-2xl font-bold font-mono focus:outline-none text-text-main placeholder:text-text-muted/30"
                            />
                        </div>
                        {hasMath && (
                            <div className="text-right text-[10px] text-text-muted/70 font-mono mt-1 border-t border-white/5 pt-1">
                                = {evaluateAmount(amount).toLocaleString()}
                            </div>
                        )}
                    </div>

                    {/* Swap Button (Absolute Centered) */}
                    <button
                        title="تبديل العملات"
                        onClick={swapCurrencies}
                        className={`
                            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10
                            w-10 h-10 rounded-full bg-surface border-4 border-surface shadow-xl
                            flex items-center justify-center text-primary transition-all hover:scale-110 active:scale-90
                            ${isAnimating ? 'rotate-180' : ''}
                        `}
                    >
                        <ArrowRightLeft size={16} />
                    </button>

                    {/* TO */}
                    <div className="bg-bg rounded-2xl p-3 border border-border focus-within:border-emerald-500/50 transition-colors">
                        <div className="text-[10px] text-text-muted font-bold mb-1">إلى</div>
                        <div className="flex items-center gap-2">
                            <select
                                title="عملة الهدف"
                                value={toCurrency}
                                onChange={(e) => setToCurrency(e.target.value)}
                                className="bg-transparent text-sm font-bold text-text-muted focus:outline-none cursor-pointer appearance-none py-1"
                            >
                                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} {c.flag}</option>)}
                            </select>
                            <div className="flex-1 text-right text-2xl font-bold font-mono text-emerald-400 overflow-hidden text-ellipsis">
                                {result > 0 ? result.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Amounts */}
            <div className="flex flex-wrap gap-1.5 justify-center">
                {QUICK_AMOUNTS.map(amt => (
                    <button
                        key={amt}
                        onClick={() => setAmount(String(amt))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${amount === String(amt) ? 'bg-primary text-primary-fg shadow-lg' : 'bg-surface border border-border text-text-muted hover:text-text-main hover:border-primary/50'}`}
                    >
                        {amt}
                    </button>
                ))}
            </div>

            {/* Conversion Rate */}
            {result > 0 && (
                <div className="text-center text-[10px] text-text-muted bg-surface/50 rounded-lg py-1">
                    1 {fromCurr.code} = {(rates[fromCurrency] / rates[toCurrency]).toLocaleString('en-US', { maximumFractionDigits: 4 })} {toCurr.code}
                </div>
            )}
        </div>
    );
};
