import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Calculator as CalcIcon, FileText, Lock, X, TrendingUp, ChevronRight } from 'lucide-react';

// Lazy load tools for better performance
const Calculator = lazy(() => import('./tools/Calculator').then(m => ({ default: m.Calculator })));
const QuickNotes = lazy(() => import('./tools/QuickNotes').then(m => ({ default: m.QuickNotes })));
const ProfitCalculator = lazy(() => import('./tools/ProfitCalculator').then(m => ({ default: m.ProfitCalculator })));

type Tool = 'calculator' | 'notes' | 'profit' | null;

interface UtilitiesDockProps {
    onLock?: () => void;
}

const ToolLoader = () => (
    <div className="w-72 h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
);

export const UtilitiesDock = ({ onLock }: UtilitiesDockProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTool, setActiveTool] = useState<Tool>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsExpanded(false);
                setActiveTool(null);
            }
        };

        if (isExpanded || activeTool) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isExpanded, activeTool]);

    // Handle drag/swipe
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartX(e.clientX);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const diff = e.clientX - startX;
        if (diff > 50) {
            setIsExpanded(true);
            setIsDragging(false);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mouseup', handleMouseUp);
            return () => document.removeEventListener('mouseup', handleMouseUp);
        }
    }, [isDragging]);

    const toggleTool = (tool: Tool) => {
        setActiveTool(activeTool === tool ? null : tool);
    };

    const tools = [
        { id: 'calculator' as Tool, icon: CalcIcon, label: 'الآلة الحاسبة', color: 'text-primary', bg: 'bg-primary/10 border-primary/30' },
        { id: 'profit' as Tool, icon: TrendingUp, label: 'حاسبة الأرباح', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
        { id: 'notes' as Tool, icon: FileText, label: 'الملاحظات', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
    ];

    return (
        <div
            ref={containerRef}
            className="fixed top-1/2 left-0 -translate-y-1/2 z-[100] flex items-center"
            onMouseMove={handleMouseMove}
        >
            {/* Android-style Edge Handle */}
            <div
                onMouseDown={handleMouseDown}
                onClick={() => setIsExpanded(!isExpanded)}
                className={`
                    flex items-center cursor-pointer select-none
                    transition-all duration-300 group
                    ${isExpanded ? 'translate-x-0' : 'translate-x-0'}
                `}
            >
                {/* The Handle Bar */}
                <div className={`
                    w-2 h-24 rounded-r-xl relative
                    transition-all duration-300
                    ${isExpanded
                        ? 'bg-primary shadow-[0_0_20px_-3px_var(--color-primary)]'
                        : 'bg-primary hover:bg-primary/90 shadow-[0_0_15px_-5px_var(--color-primary)]'}
                `}>
                    {/* Pulsing arrow indicator */}
                    {!isExpanded && (
                        <div className="absolute top-1/2 -translate-y-1/2 left-3 flex items-center justify-center">
                            <ChevronRight size={16} className="text-white animate-pulse" />
                        </div>
                    )}
                </div>
            </div>

            {/* Expanded Dock Panel */}
            <div className={`
                flex items-center
                bg-surface  border border-white/10 rounded-r-2xl shadow-2xl
                transition-all duration-300 origin-left overflow-hidden
                ${isExpanded ? 'w-auto opacity-100 p-3' : 'w-0 opacity-0 p-0'}
            `}>
                {/* Tools Grid */}
                <div className="flex items-center gap-2">
                    {tools.map((tool) => (
                        <button
                            key={tool.id}
                            onClick={() => toggleTool(tool.id)}
                            className={`
                                w-12 h-12 rounded-xl flex flex-col items-center justify-center
                                transition-all duration-200 group relative border
                                ${activeTool === tool.id
                                    ? `${tool.bg} ${tool.color} scale-110 shadow-lg`
                                    : `bg-surface-hover border-transparent hover:bg-white/10 ${tool.color} hover:scale-105`}
                            `}
                            title={tool.label}
                        >
                            <tool.icon size={20} />
                            {/* Tooltip */}
                            <span className="
                                absolute left-1/2 -translate-x-1/2 -bottom-7
                                bg-surface border border-border px-2 py-0.5 rounded text-[9px] whitespace-nowrap 
                                opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[110] shadow-lg text-text-main font-bold
                            ">
                                {tool.label}
                            </span>
                        </button>
                    ))}

                    {/* Divider */}
                    <div className="w-px h-8 bg-white/10 mx-1"></div>

                    {/* Lock Screen */}
                    <button
                        onClick={onLock}
                        className="w-12 h-12 rounded-xl flex items-center justify-center transition-all group relative hover:bg-red-500/10 text-text-muted hover:text-red-500 border border-transparent hover:border-red-500/30"
                        title="قفل الشاشة"
                    >
                        <Lock size={20} />
                        <span className="
                            absolute left-1/2 -translate-x-1/2 -bottom-7
                            bg-surface border border-red-500/30 px-2 py-0.5 rounded text-[9px] whitespace-nowrap 
                            opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[110] shadow-lg text-red-400 font-bold
                        ">
                            قفل
                        </span>
                    </button>

                    {/* Close Button */}
                    <button
                        onClick={() => { setIsExpanded(false); setActiveTool(null); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-main hover:bg-white/10 transition-all ml-1"
                        title="إغلاق"
                        aria-label="إغلاق لوحة الأدوات"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Tool Content Popover */}
            <div className={`
                transition-all duration-300 origin-left ml-2 absolute
                ${activeTool ? 'left-[260px] scale-100 opacity-100' : 'left-48 scale-90 opacity-0 pointer-events-none'}
            `}>
                {activeTool && (
                    <div className="bg-surface  border border-white/10 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-left-4 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between p-3 border-b border-white/5 bg-black/10">
                            <div className="flex items-center gap-2">
                                {tools.find(t => t.id === activeTool)?.icon && (
                                    <div className={`w-7 h-7 rounded-lg ${tools.find(t => t.id === activeTool)?.bg} flex items-center justify-center border`}>
                                        {React.createElement(tools.find(t => t.id === activeTool)!.icon, { size: 14, className: tools.find(t => t.id === activeTool)?.color })}
                                    </div>
                                )}
                                <span className="text-xs font-bold text-text-main">
                                    {activeTool === 'calculator' && 'الآلة الحاسبة'}
                                    {activeTool === 'notes' && 'ملاحظات سريعة'}
                                    {activeTool === 'profit' && 'حاسبة الأرباح'}
                                </span>
                            </div>
                            <button
                                onClick={() => setActiveTool(null)}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-colors"
                                title="إغلاق"
                                aria-label="إغلاق الأداة"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* Content */}
                        <Suspense fallback={<ToolLoader />}>
                            {activeTool === 'calculator' && <Calculator />}
                            {activeTool === 'notes' && <QuickNotes />}
                            {activeTool === 'profit' && <ProfitCalculator />}
                        </Suspense>
                    </div>
                )}
            </div>
        </div>
    );
};
