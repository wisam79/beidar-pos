import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Calendar, DollarSign, TrendingUp, AlertTriangle, CheckCircle, X, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { api } from '../../core/api';
import { Shift, CashMovement } from '../../core/types';
import { logger } from '../../core/logger';
import { formatCurrency } from '../../core/utils';
import { ShiftManager } from '../../components/ShiftManager';
import { useAuth } from '../../core/AuthContext';
import { PageHeader } from '../../components/ui';
import { PageShell, StatsGrid, StatCard } from '../../components/blocks';
import { usePreferences } from '../../components/PreferencesContext';

export const ShiftsPage: React.FC = () => {
    const { prefs, notify } = usePreferences();
    const { t: _t } = useTranslation();
    const { currentUser } = useAuth();

    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [movements, setMovements] = useState<CashMovement[]>([]);
    const [showStats, setShowStats] = useState(false);

    useEffect(() => {
        fetchShifts();
    }, []);

    const fetchShifts = async () => {
        try {
            setLoading(true);
            const history = await api.shift.getHistory(50);
            setShifts(history || []);
        } catch (e) {
            logger.error('Failed to fetch shifts', e, 'Shifts');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (shift: Shift) => {
        setSelectedShift(shift);
        try {
            const movs = await api.shift.getMovements(shift.id);
            setMovements(movs || []);
        } catch (e) {
            logger.error('Failed to fetch movements', e, 'Shifts');
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('ar-IQ', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getVarianceClass = (variance: number) => {
        if (variance === 0) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        if (variance > 0) return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        return 'text-red-500 bg-red-500/10 border-red-500/20';
    };

    // Calculate totals
    const totalVariance = shifts.reduce((sum, s) => sum + s.variance, 0);
    const totalSales = shifts.reduce((sum, s) => sum + s.totalSales, 0);
    const shiftsWithDeficit = shifts.filter(s => s.variance < 0).length;

    return (
        <PageShell>
            {/* Header */}
            <PageHeader
                title="إدارة الشفتات"
                icon={Clock}
                description="تتبع الشفتات، مراقبة المبيعات، ومراجعة الفروقات النقدية."
                actions={
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${showStats
                            ? 'bg-surface border border-border text-text-muted hover:text-text-main'
                            : 'bg-gradient-to-br from-primary to-emerald-500 text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105'
                            }`}
                        title={showStats ? 'إخفاء الإحصائيات' : 'عرض التحليل'}
                    >
                        <TrendingUp size={showStats ? 20 : 22} />
                    </button>
                }
            />

            {/* Premium Stats Row */}
            <StatsGrid columns={4} visible={showStats}>
                <StatCard 
                    icon={Calendar} 
                    label="إجمالي الشفتات" 
                    value={shifts.length} 
                    color="blue" 
                    subtitle="شفت مسجل" 
                />
                <StatCard 
                    icon={TrendingUp} 
                    label="إجمالي المبيعات" 
                    value={formatCurrency(totalSales, prefs.currency).replace(prefs?.currency || 'IQD', '')} 
                    color="emerald" 
                    subtitle={prefs.currency} 
                />
                <StatCard 
                    icon={DollarSign} 
                    label="إجمالي الفروقات" 
                    value={formatCurrency(totalVariance, prefs.currency).replace(prefs?.currency || 'IQD', '')} 
                    color={totalVariance >= 0 ? 'purple' : 'red'} 
                    subtitle={totalVariance >= 0 ? 'فائض تراكمي' : 'عجز تراكمي'} 
                />
                <StatCard 
                    icon={AlertTriangle} 
                    label="شفتات بعجز" 
                    value={shiftsWithDeficit} 
                    color="red" 
                    subtitle="تتطلب مراجعة" 
                />
            </StatsGrid>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
                {/* Active Shift / Open New */}
                <div className="lg:col-span-1 h-full overflow-y-auto custom-scrollbar">
                    <ShiftManager
                        staff={currentUser ? { id: currentUser.id, name: currentUser.name } : null}
                        currency={prefs.currency}
                        notify={notify}
                        onShiftChange={() => fetchShifts()}
                    />
                </div>

                {/* Shifts History */}
                <div className="lg:col-span-2 bg-white dark:bg-surface border border-border rounded-3xl overflow-hidden flex flex-col shadow-sm h-full">
                    <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-white dark:bg-surface sticky top-0 z-20">
                        <h3 className="font-black text-xl text-text-main flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10">
                                <Clock size={20} className="text-primary" />
                            </div>
                            سجل الشفتات
                        </h3>
                        <span className="text-xs font-bold text-text-muted bg-surface-active/50 px-3 py-1.5 rounded-xl border border-border">
                            آخر 50 شفت
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-48 gap-3">
                                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                <p className="text-text-muted font-bold text-sm">جاري تحديث السجل...</p>
                            </div>
                        ) : shifts.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-mesh relative overflow-hidden min-h-[400px]">
                                {/* Floating decorative background elements */}
                                <div className="absolute top-10 left-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
                                <div className="absolute bottom-10 right-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                                {/* Interactive Floating Icons Illustration */}
                                <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-primary/5 rounded-3xl animate-pulse" />
                                    <div className="absolute -top-2 -right-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 shadow-md transform rotate-12 hover:rotate-0 transition-transform">
                                        <DollarSign size={20} />
                                    </div>
                                    <div className="absolute -bottom-2 -left-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-500 shadow-md transform -rotate-12 hover:rotate-0 transition-transform">
                                        <Wallet size={20} />
                                    </div>
                                    <Clock size={44} className="text-primary opacity-80" />
                                </div>

                                <h4 className="text-lg font-black text-text-main mb-2">سجل الشفتات فارغ</h4>
                                <p className="text-sm text-text-muted mb-8 max-w-md leading-relaxed">
                                    هنا سيظهر تاريخ الورديات وجرد الصناديق التي يقوم الموظفون بفتحها وإغلاقها.
                                </p>

                                {/* Interactive Steps Grid */}
                                <div className="w-full max-w-xl grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
                                    <div className="bg-surface/60 border border-border/80 backdrop-blur-sm p-4 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center font-black text-xs mb-3">
                                            ١
                                        </div>
                                        <h5 className="font-bold text-sm text-text-main mb-1 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            فتح الوردية
                                        </h5>
                                        <p className="text-xs text-text-muted leading-relaxed">ابدأ بفتح شفت جديد وحدد الرصيد الافتتاحي للنقد في درج الصندوق.</p>
                                    </div>

                                    <div className="bg-surface/60 border border-border/80 backdrop-blur-sm p-4 rounded-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center font-black text-xs mb-3">
                                            ٢
                                        </div>
                                        <h5 className="font-bold text-sm text-text-main mb-1 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            تسجيل المبيعات
                                        </h5>
                                        <p className="text-xs text-text-muted leading-relaxed">تُحسب جميع الفواتير والمقبوضات تلقائياً تحت مظلة هذا الشفت.</p>
                                    </div>

                                    <div className="bg-surface/60 border border-border/80 backdrop-blur-sm p-4 rounded-2xl relative overflow-hidden group hover:border-primary/30 transition-all">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-black text-xs mb-3">
                                            ٣
                                        </div>
                                        <h5 className="font-bold text-sm text-text-main mb-1 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            المطابقة المالية
                                        </h5>
                                        <p className="text-xs text-text-muted leading-relaxed">أدخل الرصيد الفعلي للمطابقة مع رصيد النظام واكشف أي عجز أو فائض.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            shifts.map((shift) => (
                                <div
                                    key={shift.id}
                                    className={`
                                        p-5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden mb-2
                                        ${shift.variance === 0
                                            ? 'bg-surface hover:border-emerald-500/30 border-border hover:shadow-md hover:shadow-emerald-500/5'
                                            : shift.variance > 0
                                                ? 'bg-blue-500/[0.02] border-blue-500/10 hover:border-blue-500/30 hover:shadow-md hover:shadow-blue-500/5'
                                                : 'bg-red-500/[0.02] border-red-500/10 hover:border-red-500/30 hover:shadow-md hover:shadow-red-500/5'
                                        }
                                    `}
                                    onClick={() => handleViewDetails(shift)}
                                >
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-110 ${getVarianceClass(shift.variance)}`}>
                                                {shift.variance === 0 ? <CheckCircle size={20} /> :
                                                    shift.variance > 0 ? <ArrowUpRight size={20} /> : <AlertTriangle size={20} />}
                                            </div>
                                            <div>
                                                <span className="block text-lg font-bold text-text-main mb-1">{shift.staffName}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono font-medium text-text-muted flex items-center gap-1.5 bg-surface-active/50 px-2.5 py-1 rounded-lg w-fit">
                                                        <Calendar size={12} className="opacity-70" />
                                                        {formatDate(shift.openTime)}
                                                    </span>
                                                    {shift.closeTime && (
                                                        <span className="text-[10px] font-bold text-text-muted border border-border px-2 py-0.5 rounded-lg">
                                                            مغلق
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-left flex flex-col items-end gap-1.5">

                                            <span className="block text-xl font-black font-mono text-text-main tracking-tight">
                                                {formatCurrency(shift.totalSales, prefs.currency)}
                                            </span>

                                            {shift.variance !== 0 && (
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center justify-end gap-1.5 w-fit ${shift.variance > 0 ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                                                    {shift.variance > 0 ? '+' : ''}{formatCurrency(shift.variance, prefs.currency)}
                                                </span>
                                            )}
                                            {shift.variance === 0 && (
                                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg flex items-center justify-end gap-1.5">
                                                    <CheckCircle size={12} /> متطابق
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Shift Details Modal */}
            {
                selectedShift && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-surface border border-border rounded-3xl p-0 w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95 relative">
                            {/* Header */}
                            <div className="p-5 border-b border-border bg-white dark:bg-surface flex items-center justify-between sticky top-0 z-20">
                                <h3 className="font-black text-xl flex items-center gap-3 text-text-main">
                                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                                        <Clock size={20} />
                                    </div>
                                    تفاصيل الشفت
                                </h3>
                                <button onClick={() => setSelectedShift(null)} aria-label="إغلاق" className="w-9 h-9 rounded-full bg-surface-active/50 hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                                {/* Summary Card */}
                                <div className="bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/10 rounded-2xl p-5 mb-6 relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-24 h-24 bg-primary/5 rounded-full -translate-x-12 -translate-y-12 blur-2xl" />

                                    <div className="flex justify-between items-center mb-5 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-surface border border-border flex items-center justify-center text-xl font-black text-primary shadow-sm">
                                                {selectedShift.staffName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-text-main text-lg leading-tight">{selectedShift.staffName}</p>
                                                <p className="text-xs font-bold text-text-muted mt-0.5">مسؤول الشفت</p>
                                            </div>
                                        </div>
                                        <div className="text-left bg-white dark:bg-surface/50 border border-border/50 rounded-xl px-3 py-1.5 backdrop-blur-sm">
                                            <p className="font-bold text-text-main text-sm text-center">{formatDate(selectedShift.openTime).split(' ')[0]}</p>
                                            <div className={`text-[10px] font-black uppercase text-center mt-0.5 px-1.5 py-0.5 rounded flex items-center justify-center gap-1 ${selectedShift.closeTime ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${selectedShift.closeTime ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                                                {selectedShift.closeTime ? 'مغلق' : 'مفتوح'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-center relative z-10">
                                        <div className="bg-white dark:bg-surface border border-border/50 rounded-xl p-2.5">
                                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">وقت الفتح</p>
                                            <p className="font-mono font-black text-sm dir-ltr text-text-main">{new Date(selectedShift.openTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <div className="bg-white dark:bg-surface border border-border/50 rounded-xl p-2.5">
                                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">وقت الغلق</p>
                                            <p className="font-mono font-black text-sm dir-ltr text-text-main">{selectedShift.closeTime ? new Date(selectedShift.closeTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-xs font-black text-text-muted uppercase tracking-wider mb-3 px-1">الملخص المالي</h4>

                                    <div className="flex justify-between items-center p-3.5 bg-surface-active/30 rounded-2xl border border-border/50">
                                        <span className="text-sm font-bold text-text-muted">رصيد الافتتاح</span>
                                        <span className="font-mono font-black text-text-main text-lg">{formatCurrency(selectedShift.openingBalance, prefs.currency)}</span>
                                    </div>

                                    <div className="flex justify-between items-center p-3.5 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">المبيعات النقدية ({selectedShift.salesCount})</span>
                                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-lg">{formatCurrency(selectedShift.cashSales, prefs.currency)}</span>
                                    </div>

                                    <div className="relative py-2">
                                        <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-border/50"></div>
                                    </div>

                                    <div className="flex justify-between items-center p-3.5 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">المتوقع في الصندوق</span>
                                        <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-lg">{formatCurrency(selectedShift.expectedBalance, prefs.currency)}</span>
                                    </div>

                                    <div className="flex justify-between items-center p-3.5 bg-white dark:bg-surface rounded-2xl border border-border shadow-sm">
                                        <span className="text-sm font-bold text-text-main">الفعلي (عند الإغلاق)</span>
                                        <span className="font-mono font-black text-text-main text-xl">{formatCurrency(selectedShift.closingBalance, prefs.currency)}</span>
                                    </div>

                                    <div className={`flex justify-between items-center p-4 rounded-2xl border shadow-sm mt-2 ${selectedShift.variance === 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : selectedShift.variance > 0 ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'}`}>
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-full ${selectedShift.variance === 0 ? 'bg-emerald-500/20' : selectedShift.variance > 0 ? 'bg-blue-500/20' : 'bg-red-500/20'}`}>
                                                {selectedShift.variance === 0 ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                            </div>
                                            <span className="font-black text-sm">فرق الصندوق</span>
                                        </div>
                                        <span className="font-mono font-black text-xl tracking-tight">{formatCurrency(selectedShift.variance, prefs.currency)}</span>
                                    </div>

                                    {selectedShift.note && (
                                        <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl mt-4">
                                            <span className="text-[10px] font-black text-amber-500 uppercase block mb-1.5 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                ملاحظات الإغلاق
                                            </span>
                                            <p className="text-sm font-medium text-text-main leading-relaxed">{selectedShift.note}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Cash Movements */}
                                {movements.length > 0 && (
                                    <div className="mt-8 pt-6 border-t border-border">
                                        <h4 className="text-xs font-black text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <div className="p-1 rounded bg-surface-active">
                                                <Wallet size={12} />
                                            </div>
                                            سجل حركات النقد
                                        </h4>
                                        <div className="space-y-2.5">
                                            {movements.map((mov) => (
                                                <div key={mov.id} className="flex justify-between items-center bg-surface-active/30 p-3 rounded-2xl border border-border/50 hover:border-border transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${mov.type === 'cash_in' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-orange-500/10 border-orange-500/20 text-orange-500'}`}>
                                                            {mov.type === 'cash_in' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-text-main">{mov.reason}</p>
                                                            <p className="text-[10px] font-medium text-text-muted font-mono mt-0.5">{new Date(mov.timestamp).toLocaleTimeString('ar-IQ')}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`font-mono font-black text-sm ${mov.type === 'cash_in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                                        {mov.type === 'cash_in' ? '+' : '-'}{formatCurrency(mov.amount, prefs.currency)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </PageShell >
    );
};
