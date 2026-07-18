import React, { useState, useEffect, useRef } from 'react';
import { Clock, Copy, Check, Delete } from 'lucide-react';

export const Calculator = () => {
    const [expression, setExpression] = useState('');
    const [history, setHistory] = useState<{ expr: string; result: string }[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [copied, setCopied] = useState(false);

    const resultRef = useRef<HTMLDivElement>(null);
    const expressionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const savedHistory = localStorage.getItem('beidar_calc_history');
        if (savedHistory) {
            try { setHistory(JSON.parse(savedHistory)); } catch { /* ignore */ }
        }
    }, []);

    useEffect(() => {
        if (history.length > 0) {
            localStorage.setItem('beidar_calc_history', JSON.stringify(history.slice(0, 20)));
        }
    }, [history]);

    const formatNumber = (val: string) => {
        if (val === 'Error' || !val) return val || '0';
        const num = parseFloat(val);
        if (isNaN(num)) return val;
        return num.toLocaleString('en-US', { maximumFractionDigits: 10 });
    };

    const safeCalculate = (expr: string): string => {
        try {
            if (!expr || expr.trim() === '') return '';
            const sanitized = expr
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .replace(/−/g, '-')
                .replace(/[^0-9+\-*/.() ]/g, '');

            if (/[+\-*/]$/.test(sanitized.trim())) return '';

            // JavaScript automatically handles PEMDAS (Parentheses, Exponents, Multiplication/Division, Addition/Subtraction)
            const result = Function('"use strict"; return (' + sanitized + ')')();
            if (typeof result === 'number' && isFinite(result)) {
                return String(Math.round(result * 1e10) / 1e10);
            }
            return '';
        } catch {
            return '';
        }
    };

    const displayExpression = expression
        .replace(/\*/g, '×')
        .replace(/\//g, '÷')
        .replace(/-/g, '−');

    const liveResult = safeCalculate(expression);

    // Dynamic font size classes based on content length
    const getExpressionSizeClass = () => {
        const len = expression.length;
        if (len > 20) return 'text-xl';
        if (len > 15) return 'text-2xl';
        return 'text-3xl';
    };

    const getResultSizeClass = () => {
        const len = liveResult.length;
        if (len > 12) return 'text-2xl';
        if (len > 8) return 'text-3xl';
        return 'text-4xl';
    };

    const inputDigit = (digit: string) => {
        if (digit === '.') {
            const parts = expression.split(/[+\-*/]/);
            const lastPart = parts[parts.length - 1];
            if (lastPart.includes('.')) return;
        }
        setExpression(prev => prev + digit);
    };

    const inputOperator = (op: string) => {
        if (!expression && op !== '-') return; // Allow negative start
        if (/[+\-*/]$/.test(expression)) {
            setExpression(prev => prev.slice(0, -1) + op);
        } else {
            setExpression(prev => prev + op);
        }
    };

    const calculateEquals = () => {
        if (!expression || !liveResult) return;
        setHistory(prev => [{ expr: displayExpression, result: liveResult }, ...prev.slice(0, 19)]);
        setExpression(liveResult);
    };

    const inputPercent = () => {
        if (!expression) return;
        // Try to evaluate current number part to apply percent
        // For simple calculator behavior: valid number / 100
        // For expression behavior: wrap last number in (/100) or just append /100?
        // Let's implement standard "value / 100" logic which works well in chains
        setExpression(prev => prev + '/100');
    };

    const toggleSign = () => {
        if (!expression) return;
        // Logic to toggle sign of the *last number* in the expression
        const parts = expression.split(/([+\-*/])/).filter(Boolean);
        if (parts.length === 0) return;

        const lastToken = parts[parts.length - 1];

        // If last token is an operator, don't toggle
        if (/[+\-*/]/.test(lastToken)) return;

        // Toggle the number
        let newLastToken;
        if (lastToken.startsWith('(-') && lastToken.endsWith(')')) {
            newLastToken = lastToken.slice(2, -1); // Remove parens and minus
        } else if (lastToken.startsWith('-')) {
            newLastToken = lastToken.slice(1);
        } else {
            newLastToken = `(-${lastToken})`;
        }

        parts[parts.length - 1] = newLastToken;
        setExpression(parts.join(''));
    };

    const clearAll = () => setExpression('');
    const backspace = () => setExpression(prev => prev.slice(0, -1));

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key;
            if (/[0-9]/.test(key)) inputDigit(key);
            else if (key === '.') inputDigit('.');
            else if (key === '+') inputOperator('+');
            else if (key === '-') inputOperator('-');
            else if (key === '*') inputOperator('*');
            else if (key === '/') inputOperator('/');
            else if (key === 'Enter' || key === '=') calculateEquals();
            else if (key === 'Backspace') backspace();
            else if (key === 'Escape') clearAll();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    });

    const Button = ({ label, onClick, className = '' }: { label: string; onClick: () => void; className?: string }) => (
        <button
            onClick={onClick}
            className={`h-12 rounded-xl text-lg font-medium transition-all active:scale-95 flex items-center justify-center select-none ${className}`}
        >
            {label}
        </button>
    );

    return (
        <div className="w-80 bg-gradient-to-b from-surface to-surface/80  rounded-b-2xl p-4 shadow-2xl select-none font-sans">
            {/* Display Area */}
            {/* FORCE LTR direction for math expressions so they read correctly (5 + 9, not 9 + 5) */}
            <div className="min-h-28 flex flex-col justify-end items-end mb-3 relative group px-2" dir="ltr">
                {/* Action buttons (Absolute positioned relative to LTR container, so left is left) */}
                <div className="absolute top-0 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" dir="rtl">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`p-1.5 rounded-lg transition-all ${showHistory ? 'bg-primary/20 text-primary' : 'hover:bg-surface-hover text-text-muted'}`}
                        title="السجل"
                    >
                        <Clock size={14} />
                    </button>
                    <button onClick={backspace} className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted hover:text-red-400" title="مسح">
                        <Delete size={14} />
                    </button>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(liveResult || expression);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1000);
                        }}
                        className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted"
                        title="نسخ"
                    >
                        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                </div>

                {/* History Panel */}
                {showHistory && (
                    <div className="absolute inset-0 bg-surface z-20  rounded-xl flex flex-col p-2 overflow-y-auto custom-scrollbar border border-white/10" dir="rtl">
                        <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-2">
                            <span className="text-xs font-bold text-text-muted">السجل</span>
                            <button onClick={() => { setHistory([]); localStorage.removeItem('beidar_calc_history'); }} className="text-[10px] text-red-400">مسح</button>
                        </div>
                        {history.length ? history.map((h, i) => (
                            <div key={i} onClick={() => { setExpression(h.result); setShowHistory(false); }} className="text-right p-2 rounded-lg hover:bg-surface-hover cursor-pointer" dir="ltr">
                                <div className="text-[10px] text-text-muted font-mono">{h.expr}</div>
                                <div className="text-sm text-primary font-mono font-bold">= {formatNumber(h.result)}</div>
                            </div>
                        )) : <div className="text-text-muted text-center py-4 text-xs">لا يوجد سجل</div>}
                    </div>
                )}

                {/* Expression */}
                <div
                    ref={expressionRef}
                    className={`w-full text-right text-text-main font-mono tracking-tight leading-tight overflow-x-auto whitespace-nowrap scrollbar-none transition-all ${getExpressionSizeClass()}`}
                >
                    {displayExpression || <span className="text-text-muted">0</span>}
                </div>

                {/* Live Result */}
                <div
                    ref={resultRef}
                    className={`w-full text-right font-mono tracking-tight leading-none mt-1 transition-all ${getResultSizeClass()} ${liveResult ? 'text-primary' : 'text-text-muted/50'}`}
                >
                    {liveResult ? formatNumber(liveResult) : ''}
                </div>
            </div>

            {/* Buttons Grid */}
            <div className="grid grid-cols-4 gap-2">
                <Button label={expression ? "C" : "AC"} onClick={clearAll} className="bg-surface-hover text-text-main hover:bg-surface-active font-bold text-red-400" />
                <Button label="+/−" onClick={toggleSign} className="bg-surface-hover text-text-main hover:bg-surface-active font-bold" />
                <Button label="%" onClick={inputPercent} className="bg-surface-hover text-text-main hover:bg-surface-active font-bold" />
                <Button label="÷" onClick={() => inputOperator('/')} className="bg-surface-active text-primary hover:bg-primary/10 font-bold text-xl" />

                <Button label="7" onClick={() => inputDigit('7')} className="bg-surface-active text-text-main hover:bg-surface-hover text-xl" />
                <Button label="8" onClick={() => inputDigit('8')} className="bg-surface-active text-text-main hover:bg-surface-hover text-xl" />
                <Button label="9" onClick={() => inputDigit('9')} className="bg-surface-active text-text-main hover:bg-surface-hover text-xl" />
                <Button label="×" onClick={() => inputOperator('*')} className="bg-surface-active text-primary hover:bg-primary/10 font-bold text-xl" />

                <Button label="4" onClick={() => inputDigit('4')} className="bg-surface-active text-text-main hover:bg-surface-hover text-xl" />
                <Button label="5" onClick={() => inputDigit('5')} className="bg-surface-active text-text-main hover:bg-surface-hover text-xl" />
                <Button label="6" onClick={() => inputDigit('6')} className="bg-surface-active text-text-main hover:bg-surface-hover text-xl" />
                <Button label="−" onClick={() => inputOperator('-')} className="bg-surface-active text-primary hover:bg-primary/10 font-bold text-xl" />

                <Button label="1" onClick={() => inputDigit('1')} className="bg-surface-active text-text-main hover:bg-surface-hover text-xl" />
                <Button label="2" onClick={() => inputDigit('2')} className="bg-surface-active text-text-main hover:bg-surface-hover text-xl" />
                <Button label="3" onClick={() => inputDigit('3')} className="bg-surface-active text-text-main hover:bg-surface-hover text-xl" />
                <Button label="+" onClick={() => inputOperator('+')} className="bg-surface-active text-primary hover:bg-primary/10 font-bold text-xl" />

                <Button label="0" onClick={() => inputDigit('0')} className="col-span-2 bg-surface-active text-text-main hover:bg-surface-hover text-xl" />
                <Button label="." onClick={() => inputDigit('.')} className="bg-surface-active text-text-main hover:bg-surface-hover text-xl" />
                <Button label="=" onClick={calculateEquals} className="bg-primary text-primary-fg hover:bg-primary/90 font-bold text-xl shadow-lg shadow-primary/20" />
            </div>
        </div>
    );
};
