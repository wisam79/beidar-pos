
import React, { useState, memo } from 'react';

// Enhanced Bezier Curve Generator for ultra-smooth paths
const getPath = (points: number[][], height: number) => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M 0,${height} L ${points[0][0]},${points[0][1]} L 1000,${height}`;

    let d = `M ${points[0][0]},${points[0][1]}`;

    for (let i = 0; i < points.length - 1; i++) {
        const x0 = i > 0 ? points[i - 1][0] : points[0][0];
        const y0 = i > 0 ? points[i - 1][1] : points[0][1];
        const x1 = points[i][0];
        const y1 = points[i][1];
        const x2 = points[i + 1][0];
        const y2 = points[i + 1][1];
        const x3 = i !== points.length - 2 ? points[i + 2][0] : x2;
        const y3 = i !== points.length - 2 ? points[i + 2][1] : y2;

        const cp1x = x1 + (x2 - x0) / 6;
        const cp1y = y1 + (y2 - y0) / 6;
        const cp2x = x2 - (x3 - x1) / 6;
        const cp2y = y2 - (y3 - y1) / 6;

        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
    }
    return d;
};

interface ChartDataPoint {
    label: string;
    value: number;
    formattedValue: string;
}

export const SalesAreaChart = memo(({ data }: { data: ChartDataPoint[] }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    // Portal Tooltip Logic
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    // Configuration
    const width = 1000;
    const height = 350;
    const padding = { top: 20, bottom: 60, left: 50, right: 20 };

    // Normalize Data safely
    const safeData = data && data.length > 0 ? data : Array(7).fill({ label: '-', value: 0, formattedValue: '0' });
    const maxVal = Math.max(...safeData.map(d => d.value)) * 1.15 || 100;
    const minVal = 0;

    // Calculate points
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const points = safeData.map((d, i) => {
        const x = padding.left + (i / (Math.max(1, safeData.length - 1))) * chartWidth;
        const y = padding.top + chartHeight - ((d.value - minVal) / (maxVal - minVal)) * chartHeight;
        return [x, y];
    });

    const pathD = getPath(points, height);
    const fillD = `${pathD} L ${padding.left + chartWidth},${padding.top + chartHeight} L ${padding.left},${padding.top + chartHeight} Z`;

    // Y-axis labels
    const yAxisLabels = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal].map(v => ({
        value: v,
        y: padding.top + chartHeight - (v / maxVal) * chartHeight,
        label: v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0)
    }));

    return (
        <div ref={containerRef} className="w-full h-full relative group select-none overflow-hidden" onMouseLeave={() => setHoveredIndex(null)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <defs>
                    {/* Enhanced Gradient Fill */}
                    <linearGradient id="chartFillEnhanced" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                        <stop offset="30%" stopColor="#10B981" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
                    </linearGradient>

                    {/* Stroke Gradient - More vibrant */}
                    <linearGradient id="chartStrokeEnhanced" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#06B6D4" />
                        <stop offset="50%" stopColor="#10B981" />
                        <stop offset="100%" stopColor="#22C55E" />
                    </linearGradient>

                    {/* Glow Effect */}
                    <filter id="glowEnhanced" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    {/* Point Glow */}
                    <filter id="pointGlow" x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Horizontal Grid Lines */}
                {yAxisLabels.map((label, i) => (
                    <g key={i}>
                        <line
                            x1={padding.left}
                            y1={label.y}
                            x2={padding.left + chartWidth}
                            y2={label.y}
                            stroke="var(--color-border)"
                            strokeOpacity={i === 0 ? 0.6 : 0.25}
                            strokeWidth="1"
                            strokeDasharray={i === 0 ? "0" : "4,4"}
                        />
                        {/* Y-axis labels */}
                        <text
                            x={padding.left - 10}
                            y={label.y + 4}
                            textAnchor="end"
                            className="fill-text-muted text-[22px] font-mono"
                        >
                            {label.label}
                        </text>
                    </g>
                ))}

                {/* The Area Fill */}
                <path d={fillD} fill="url(#chartFillEnhanced)" className="transition-all duration-500 ease-in-out" />

                {/* The Main Stroke - Thicker */}
                <path
                    d={pathD}
                    fill="none"
                    stroke="url(#chartStrokeEnhanced)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glowEnhanced)"
                    className="transition-all duration-500 ease-in-out"
                />

                {/* Vertical Hover Line */}
                {hoveredIndex !== null && (
                    <line
                        x1={points[hoveredIndex][0]}
                        y1={padding.top}
                        x2={points[hoveredIndex][0]}
                        y2={padding.top + chartHeight}
                        stroke="var(--color-primary)"
                        strokeOpacity="0.4"
                        strokeWidth="2"
                        strokeDasharray="6,4"
                    />
                )}

                {/* Data Points - Always Visible */}
                {points.map(([x, y], i) => (
                    <g
                        key={i}
                        onMouseEnter={(e) => {
                            // Calculate scaled coordinates based on actual DOM size
                            if (containerRef.current) {
                                const rect = containerRef.current.getBoundingClientRect();
                                // normalize coordinates from viewBox (width/height) to client rect
                                const clientX = rect.left + (x / width) * rect.width;
                                const clientY = rect.top + (y / height) * rect.height;
                                setTooltipPos({ x: clientX, y: clientY });
                                setHoveredIndex(i);
                            }
                        }}
                    >
                        {/* Invisible Hit Area */}
                        <circle cx={x} cy={y} r="25" fill="transparent" className="cursor-pointer" />

                        {/* Base Point */}
                        <circle
                            cx={x}
                            cy={y}
                            r={hoveredIndex === i ? 8 : 5}
                            fill="var(--color-bg)"
                            stroke="var(--color-primary)"
                            strokeWidth={hoveredIndex === i ? 3 : 2}
                            className="transition-all duration-200"
                            filter={hoveredIndex === i ? "url(#pointGlow)" : undefined}
                        />

                        {/* Inner Point */}
                        <circle
                            cx={x}
                            cy={y}
                            r={hoveredIndex === i ? 3 : 2}
                            fill="var(--color-primary)"
                            className="transition-all duration-200"
                        />
                    </g>
                ))}

                {/* X-axis Labels */}
                {safeData.map((d, i) => {
                    const x = padding.left + (i / (Math.max(1, safeData.length - 1))) * chartWidth;
                    return (
                        <text
                            key={i}
                            x={x}
                            y={height - 25}
                            textAnchor="middle"
                            className={`text-[12px] font-bold font-mono transition-colors duration-200 ${hoveredIndex === i ? 'fill-primary' : 'fill-text-muted'
                                }`}
                        >
                            {d.label}
                        </text>
                    );
                })}
            </svg>

            {/* Enhanced Tooltip - Portaled */}
            {hoveredIndex !== null && safeData[hoveredIndex] && (
                <PortalTooltip
                    label={safeData[hoveredIndex].label}
                    value={safeData[hoveredIndex].formattedValue}
                    x={tooltipPos.x}
                    y={tooltipPos.y}
                />
            )}
        </div>
    );
});

import { createPortal } from 'react-dom';

const PortalTooltip = ({ label, value, x, y }: { label: string, value: string, x: number, y: number }) => {
    return createPortal(
        <div
            className="fixed z-[9999] pointer-events-none transform -translate-x-1/2 -translate-y-[120%]"
            style={{ left: x, top: y }}
        >
            <div className="bg-surface/95 backdrop-blur-xl border border-primary/30 shadow-2xl shadow-primary/20 rounded-xl px-4 py-3 flex flex-col items-center min-w-[130px] animate-in slide-in-from-bottom-2 duration-150">
                <span className="text-[10px] text-text-muted font-bold mb-1 uppercase tracking-wider">
                    {label}
                </span>
                <span className="text-xl font-black text-primary font-mono whitespace-nowrap">
                    {value}
                </span>
                {/* Triangle Pointer */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-surface/95" />
            </div>
        </div>,
        document.body
    );
};


export const BarChart = memo(({ data }: { data: { label: string, value: number }[] }) => {
    const safeData = data.length > 0 ? data : Array(5).fill({ label: '-', value: 0 });
    const max = Math.max(...safeData.map(d => d.value), 1);

    return (
        <div className="w-full h-48 flex items-end justify-between gap-3 pt-6 px-2 select-none">
            {safeData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end relative">
                    <div className="w-full bg-surface-active rounded-t-lg relative h-full flex items-end overflow-hidden border-x border-t border-border">
                        <div
                            className="w-full bg-gradient-to-t from-primary/40 to-blue-500/40 rounded-t-lg transition-all duration-700 group-hover:from-primary group-hover:to-blue-500 relative"
                            style={{ height: `${(d.value / max) * 100}%` }}
                        >
                            <div className="absolute top-0 w-full h-[1px] bg-white/30"></div>
                        </div>
                    </div>
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all bg-surface border border-border px-3 py-1.5 rounded-xl text-xs font-bold text-text-main shadow-xl z-10 transform translate-y-2 group-hover:translate-y-0 font-mono">
                        {d.value}
                    </div>
                    <span className="text-[9px] text-text-muted font-bold group-hover:text-text-main transition-colors truncate w-full text-center uppercase">{d.label}</span>
                </div>
            ))}
        </div>
    );
});

export const DonutChart = memo(({ data }: { data: { label: string, value: number, color: string }[] }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const total = data.reduce((acc, cur) => acc + cur.value, 0);
    let cumulativePercent = 0;

    const gapPercent = data.length > 1 ? 0.015 : 0;

    const colorMap: Record<string, string> = {
        'bg-blue-500': '#3B82F6',
        'bg-purple-500': '#A855F7',
        'bg-orange-500': '#F97316',
        'bg-green-500': '#22C55E',
        'bg-emerald-500': '#10B981',
        'bg-red-500': '#EF4444',
        'bg-amber-500': '#F59E0B',
        'bg-cyan-500': '#06B6D4',
        'bg-gray-500': '#6B7280',
    };

    if (total === 0) return (
        <div className="w-full h-full flex flex-col items-center justify-center relative p-4">
            <div className="w-36 h-36 rounded-full border-4 border-dashed border-border flex items-center justify-center bg-surface/30">
                <span className="text-xs text-text-muted font-bold">لا توجد بيانات</span>
            </div>
        </div>
    );

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center gap-4 p-2">
            {/* Donut Chart SVG */}
            <div className="relative">
                <svg viewBox="0 0 44 44" className="w-40 h-40">
                    <defs>
                        <filter id="donutGlow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="1" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Background Track */}
                    <circle cx="22" cy="22" r="16" fill="transparent" stroke="var(--color-border)" strokeWidth="5" opacity="0.2" />

                    {data.map((slice, i) => {
                        if (slice.value === 0) return null;

                        const slicePercent = (slice.value / total);
                        const drawPercent = Math.max(0, slicePercent - gapPercent);
                        const dashArray = `${drawPercent * 100.53} ${100.53 - (drawPercent * 100.53)}`;
                        const offset = 25.13 - (cumulativePercent * 100.53);
                        const strokeColor = colorMap[slice.color] || '#6B7280';

                        cumulativePercent += slicePercent;

                        return (
                            <circle
                                key={i}
                                cx="22" cy="22" r="16"
                                fill="transparent"
                                stroke={strokeColor}
                                strokeWidth={hoveredIndex === i ? 6 : 5}
                                strokeDasharray={dashArray}
                                strokeDashoffset={offset}
                                strokeLinecap="round"
                                className="transition-all duration-300 cursor-pointer origin-center"
                                style={{
                                    filter: hoveredIndex === i ? `drop-shadow(0 0 8px ${strokeColor})` : `drop-shadow(0 0 3px ${strokeColor}40)`,
                                    transform: hoveredIndex === i ? 'scale(1.03)' : 'scale(1)'
                                }}
                                onMouseEnter={() => setHoveredIndex(i)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            >
                                <title>{slice.label}: {slice.value.toLocaleString()}</title>
                            </circle>
                        );
                    })}

                    {/* Inner Circle */}
                    <circle cx="22" cy="22" r="10" fill="var(--color-surface)" />
                    <circle cx="22" cy="22" r="10" fill="transparent" stroke="var(--color-border)" strokeWidth="0.5" opacity="0.3" />
                </svg>

                {/* Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[8px] font-bold text-text-muted uppercase tracking-wider">الإجمالي</span>
                    <span className="text-lg font-black text-primary font-mono">
                        {total.toLocaleString()}
                    </span>
                </div>
            </div>

            {/* Legend - Compact */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                {data.filter(d => d.value > 0).map((slice, i) => {
                    const strokeColor = colorMap[slice.color] || '#6B7280';
                    const percent = Math.round((slice.value / total) * 100);
                    return (
                        <div
                            key={i}
                            className={`flex items-center gap-1.5 transition-all cursor-pointer ${hoveredIndex === i ? 'scale-105' : ''}`}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            <div
                                className="w-2.5 h-2.5 rounded-full transition-all"
                                style={{
                                    backgroundColor: strokeColor,
                                    boxShadow: hoveredIndex === i ? `0 0 10px ${strokeColor}` : `0 0 4px ${strokeColor}40`
                                }}
                            />
                            <span className="text-[10px] font-bold text-text-muted">{slice.label}</span>
                            <span className="text-[10px] font-black text-text-main font-mono">{percent}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
