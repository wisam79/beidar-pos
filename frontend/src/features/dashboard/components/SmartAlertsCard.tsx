import React, { memo, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Package, FileWarning, CalendarClock, ChevronRight } from 'lucide-react';
import type { View } from '../../../core/types';

interface SmartAlertsCardProps {
    lowStockCount: number;
    pendingInvoicesCount?: number;
    overdueInstallmentsCount?: number;
    setView: (view: View) => void;
    compact?: boolean;
}

export const SmartAlertsCard = memo(({
    lowStockCount,
    pendingInvoicesCount = 0,
    overdueInstallmentsCount = 0,
    setView
}: SmartAlertsCardProps) => {

    const alerts = useMemo(() => {
        const list = [];
        if (lowStockCount > 0) list.push({ type: 'stock', count: lowStockCount, label: 'منتجات منخفضة المخزون', view: 'inventory', priority: 'high' });
        if (pendingInvoicesCount > 0) list.push({ type: 'invoice', count: pendingInvoicesCount, label: 'فواتير معلقة', view: 'invoices', priority: 'medium' });
        if (overdueInstallmentsCount > 0) list.push({ type: 'debt', count: overdueInstallmentsCount, label: 'أقساط مستحقة', view: 'customers', priority: 'critical' });
        return list.sort((a, b) => (a.priority === 'critical' ? -1 : 1));
    }, [lowStockCount, pendingInvoicesCount, overdueInstallmentsCount]);

    const hasAlerts = alerts.length > 0;

    if (!hasAlerts) {
        return (
            <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                    <CheckCircle2 size={24} className="text-emerald-500" />
                </div>
                <p className="text-sm font-bold text-text-main">كل شيء على ما يرام</p>
                <p className="text-[10px] text-text-muted">لا توجد تنبيهات حالياً</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-500" />
                    التنبيهات
                </h3>
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold">
                    {alerts.length}
                </span>
            </div>

            <div className="space-y-2">
                {alerts.map((alert) => (
                    <button
                        key={alert.type}
                        onClick={() => setView(alert.view as View)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-right group ${alert.priority === 'critical'
                                ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                                : 'bg-surface border-border hover:border-primary/50'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${alert.type === 'stock' ? 'bg-orange-500/10 text-orange-500' :
                                    alert.type === 'debt' ? 'bg-red-500/10 text-red-500' :
                                        'bg-blue-500/10 text-blue-500'
                                }`}>
                                {alert.type === 'stock' && <Package size={16} />}
                                {alert.type === 'debt' && <CalendarClock size={16} />}
                                {alert.type === 'invoice' && <FileWarning size={16} />}
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-text-main">{alert.label}</p>
                                <p className="text-[10px] text-text-muted">
                                    <span className="font-mono font-bold text-primary">{alert.count}</span> حالة
                                </p>
                            </div>
                        </div>
                        <ChevronRight size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ))}
            </div>
        </div>
    );
});

SmartAlertsCard.displayName = 'SmartAlertsCard';
