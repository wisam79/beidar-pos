// ═══════════════════════════════════════════════════════════════════════════════
// 📊 useMonthlyComparison Hook - Monthly Comparison Data with React Query
// ═══════════════════════════════════════════════════════════════════════════════
// 
// يستخدم هذا الـ Hook لجلب بيانات مقارنة الشهر الحالي بالشهر السابق
// يعتمد على الـ API الموجود في الباكند: GetMonthlyComparison()
// 
// البيانات المتوفرة:
// - currentMonth: بيانات الشهر الحالي (الإيراد، الطلبات، الربح، المصاريف)
// - previousMonth: بيانات الشهر السابق
// - revenueChange: نسبة التغير في الإيراد (%)
// - ordersChange: نسبة التغير في الطلبات (%)
// - profitChange: نسبة التغير في الربح (%)
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { api } from '../core/api';

/**
 * بيانات الشهر الواحد
 */
export interface MonthData {
    label: string;      // اسم الشهر (مثال: "ديسمبر 2024")
    revenue: number;    // إجمالي الإيرادات
    orders: number;     // عدد الطلبات
    netProfit: number;  // صافي الربح
    avgOrder: number;   // متوسط قيمة الطلب
    expenses: number;   // المصاريف
}

/**
 * بيانات المقارنة الشهرية
 */
export interface MonthlyComparisonData {
    currentMonth: MonthData;    // بيانات الشهر الحالي
    previousMonth: MonthData;   // بيانات الشهر السابق
    revenueChange: number;      // نسبة التغير في الإيراد (%)
    ordersChange: number;       // نسبة التغير في الطلبات (%)
    profitChange: number;       // نسبة التغير في الربح (%)
}

/**
 * القيم الافتراضية عند عدم توفر البيانات
 */
const defaultMonthData: MonthData = {
    label: '',
    revenue: 0,
    orders: 0,
    netProfit: 0,
    avgOrder: 0,
    expenses: 0,
};

const defaultComparison: MonthlyComparisonData = {
    currentMonth: { ...defaultMonthData, label: 'الشهر الحالي' },
    previousMonth: { ...defaultMonthData, label: 'الشهر السابق' },
    revenueChange: 0,
    ordersChange: 0,
    profitChange: 0,
};

/**
 * القيمة المُرجعة من الـ Hook
 */
interface UseMonthlyComparisonReturn {
    comparison: MonthlyComparisonData;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
}

/**
 * Hook لجلب بيانات المقارنة الشهرية
 * 
 * @example
 * ```tsx
 * const { comparison, isLoading } = useMonthlyComparison();
 * 
 * if (isLoading) return <Skeleton />;
 * 
 * return (
 *   <div>
 *     <p>الإيراد هذا الشهر: {comparison.currentMonth.revenue}</p>
 *     <p>التغير: {comparison.revenueChange}%</p>
 *   </div>
 * );
 * ```
 */
export function useMonthlyComparison(): UseMonthlyComparisonReturn {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['monthly_comparison'],
        queryFn: async () => {
            // استدعاء API المقارنة الشهرية من الباكند
            const result = await api.stats.getMonthlyComparison();
            if (result) {
                // Convert cents to standard currency units (divide by 100)
                if (result.currentMonth) {
                    result.currentMonth.revenue = (result.currentMonth.revenue || 0) / 100;
                    result.currentMonth.netProfit = (result.currentMonth.netProfit || 0) / 100;
                    result.currentMonth.avgOrder = (result.currentMonth.avgOrder || 0) / 100;
                    result.currentMonth.expenses = (result.currentMonth.expenses || 0) / 100;
                }
                if (result.previousMonth) {
                    result.previousMonth.revenue = (result.previousMonth.revenue || 0) / 100;
                    result.previousMonth.netProfit = (result.previousMonth.netProfit || 0) / 100;
                    result.previousMonth.avgOrder = (result.previousMonth.avgOrder || 0) / 100;
                    result.previousMonth.expenses = (result.previousMonth.expenses || 0) / 100;
                }
            }
            return result as MonthlyComparisonData;
        },
        // البيانات تبقى صالحة لمدة 60 ثانية (لأنها لا تتغير كثيراً)
        staleTime: 60000,
        // تحديث كل 5 دقائق في الخلفية
        refetchInterval: 300000,
    });

    return {
        comparison: data || defaultComparison,
        isLoading,
        isError,
        refetch,
    };
}
