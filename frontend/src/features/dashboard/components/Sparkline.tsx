import React, { memo, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// 📈 SPARKLINE - رسم بياني مصغر لعرض الاتجاهات السريعة
// ═══════════════════════════════════════════════════════════════════════════════
//
// مكون خفيف وسريع لعرض اتجاه البيانات في مساحة صغيرة
// يُستخدم داخل البطاقات لإظهار الأداء بشكل بصري سريع
//
// المميزات:
// - SVG بسيط وحجم صغير
// - ألوان ديناميكية حسب الاتجاه (أخضر ↑، أحمر ↓)
// - خط Bezier سلس
// - تأثير تدرج أسفل الخط
// ═══════════════════════════════════════════════════════════════════════════════

interface SparklineProps {
    /** مصفوفة الأرقام للعرض */
    data: number[];
    /** عرض الرسم (افتراضي: 120) */
    width?: number;
    /** ارتفاع الرسم (افتراضي: 40) */
    height?: number;
    /** لون الخط (افتراضي: تلقائي حسب الاتجاه) */
    color?: string;
    /** إظهار تأثير التدرج أسفل الخط */
    showFill?: boolean;
    /** سمك الخط (افتراضي: 2) */
    strokeWidth?: number;
}

/**
 * دالة لإنشاء مسار Bezier سلس من النقاط
 * تستخدم لإنشاء خط منحني بدلاً من خط متكسر
 */
const getSparklinePath = (points: [number, number][]): string => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0][0]},${points[0][1]}`;

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

        // نقاط التحكم لمنحنى Bezier
        const cp1x = x1 + (x2 - x0) / 6;
        const cp1y = y1 + (y2 - y0) / 6;
        const cp2x = x2 - (x3 - x1) / 6;
        const cp2y = y2 - (y3 - y1) / 6;

        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
    }

    return d;
};

/**
 * مكون Sparkline - رسم بياني مصغر
 * 
 * @example
 * ```tsx
 * // استخدام بسيط
 * <Sparkline data={[10, 20, 15, 30, 25, 40]} />
 * 
 * // مع خيارات مخصصة
 * <Sparkline 
 *   data={[100, 150, 120, 180]} 
 *   width={100} 
 *   height={30}
 *   color="#10b981"
 *   showFill={true}
 * />
 * ```
 */
export const Sparkline = memo(({
    data,
    width = 120,
    height = 40,
    color,
    showFill = true,
    strokeWidth = 2,
}: SparklineProps) => {
    // حساب النقاط والألوان
    const { points, pathD, fillD, lineColor, isPositive } = useMemo(() => {
        // التأكد من وجود بيانات صالحة
        const safeData = data && data.length > 0
            ? data.filter(v => typeof v === 'number' && !isNaN(v))
            : [];

        if (safeData.length < 2) {
            return {
                points: [] as [number, number][],
                pathD: '',
                fillD: '',
                lineColor: 'var(--color-text-muted)',
                isPositive: true
            };
        }

        // حساب الاتجاه (مقارنة آخر قيمة بالأولى)
        const firstVal = safeData[0];
        const lastVal = safeData[safeData.length - 1];
        const positive = lastVal >= firstVal;

        // تحديد اللون (مُمرر أو تلقائي)
        const calculatedColor = color || (positive ? '#10b981' : '#ef4444');

        // حساب الحدود
        const maxVal = Math.max(...safeData);
        const minVal = Math.min(...safeData);
        const range = maxVal - minVal || 1;

        // padding داخلي للحفاظ على الخط داخل الحدود
        const padding = { x: 2, y: 4 };
        const innerWidth = width - padding.x * 2;
        const innerHeight = height - padding.y * 2;

        // تحويل البيانات إلى نقاط x,y
        const calculatedPoints: [number, number][] = safeData.map((value, i) => {
            const x = padding.x + (i / (safeData.length - 1)) * innerWidth;
            const y = padding.y + innerHeight - ((value - minVal) / range) * innerHeight;
            return [x, y] as [number, number];
        });

        // إنشاء مسار الخط
        const linePath = getSparklinePath(calculatedPoints);

        // إنشاء مسار التعبئة (الخط + إغلاق للأسفل)
        const fillPath = calculatedPoints.length > 0
            ? `${linePath} L ${calculatedPoints[calculatedPoints.length - 1][0]},${height} L ${calculatedPoints[0][0]},${height} Z`
            : '';

        return {
            points: calculatedPoints,
            pathD: linePath,
            fillD: fillPath,
            lineColor: calculatedColor,
            isPositive: positive,
        };
    }, [data, width, height, color]);

    // عدم عرض شيء إذا لا توجد بيانات كافية
    if (points.length < 2) {
        return (
            <svg width={width} height={height} className="opacity-30">
                <line
                    x1="0" y1={height / 2}
                    x2={width} y2={height / 2}
                    stroke="var(--color-border)"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                />
            </svg>
        );
    }

    // معرف فريد للـ gradient
    const gradientId = `sparkline-gradient-${Math.random().toString(36).slice(2, 9)}`;

    return (
        <svg
            width={width}
            height={height}
            className="select-none overflow-visible"
        >
            <defs>
                {/* تدرج لوني للتعبئة */}
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
                </linearGradient>
            </defs>

            {/* التعبئة أسفل الخط */}
            {showFill && (
                <path
                    d={fillD}
                    fill={`url(#${gradientId})`}
                    className="transition-all duration-300"
                />
            )}

            {/* الخط الرئيسي */}
            <path
                d={pathD}
                fill="none"
                stroke={lineColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300"
            />

            {/* نقطة نهاية مميزة */}
            {points.length > 0 && (
                <circle
                    cx={points[points.length - 1][0]}
                    cy={points[points.length - 1][1]}
                    r={3}
                    fill={lineColor}
                    className="animate-pulse"
                />
            )}
        </svg>
    );
});

Sparkline.displayName = 'Sparkline';
