import React, { useState, useEffect } from 'react';
import { AlertTriangle, Phone, MessageCircle, Calendar, DollarSign, Users, Clock, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { formatCurrency } from '../core/utils';
import { AppPreferences } from '../core/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface InstallmentAlert {
    saleId: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    instNumber: number;
    dueDate: string;
    amount: number;
    daysOverdue: number;
    totalDue: number;
}

interface InstallmentAlertSummary {
    totalOverdue: number;
    totalAmount: number;
    byDay: {
        '1-7': number;
        '8-30': number;
        '30+': number;
    };
    topCustomers: Array<{
        customerId: string;
        customerName: string;
        totalDebt: number;
        overdueCount: number;
    }>;
    alerts: InstallmentAlert[];
}

interface Props {
    prefs: AppPreferences;
    notify: (message: string, type: 'success' | 'error' | 'info') => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export const InstallmentAlerts: React.FC<Props> = ({ prefs, notify }) => {
    const [summary, setSummary] = useState<InstallmentAlertSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

    // Fetch alerts on mount
    useEffect(() => {
        fetchAlerts();
    }, []);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            // @ts-expect-error - Wails binding
            const data = await window.go.main.App.GetInstallmentAlertSummary();
            setSummary(data);
        } catch (err) {
            console.error('Failed to fetch alerts:', err);
            notify('فشل تحميل التنبيهات', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Format WhatsApp message and open
    const sendWhatsAppReminder = (alert: InstallmentAlert) => {
        const message = encodeURIComponent(
            `*تذكير بموعد قسط* 📅\n\n` +
            `عزيزي العميل ${alert.customerName}،\n\n` +
            `نود تذكيرك بأن القسط رقم ${alert.instNumber} بقيمة *${formatCurrency(alert.amount, prefs.currency)}* كان مستحقاً بتاريخ ${alert.dueDate}.\n\n` +
            `المدة المتأخرة: *${alert.daysOverdue} يوم*\n\n` +
            `نرجو التواصل معنا في أقرب وقت.\n` +
            `شكراً لتعاملكم معنا 🙏`
        );

        const phone = alert.customerPhone?.replace(/[^0-9]/g, '') || '';
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
        notify('تم فتح WhatsApp', 'success');
    };

    // Get severity color based on days overdue
    const getSeverityColor = (days: number) => {
        if (days > 30) return 'text-red-500 bg-red-500/10 border-red-500/30';
        if (days > 7) return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!summary || summary.totalOverdue === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-text-main mb-2">لا توجد أقساط متأخرة</h3>
                <p className="text-sm text-text-muted">جميع الأقساط مدفوعة في موعدها ✅</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Total Overdue */}
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                        </div>
                        <span className="text-sm text-red-400">أقساط متأخرة</span>
                    </div>
                    <p className="text-2xl font-black text-red-500">{summary.totalOverdue}</p>
                </div>

                {/* Total Amount */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-amber-500" />
                        </div>
                        <span className="text-sm text-amber-400">المبلغ الإجمالي</span>
                    </div>
                    <p className="text-2xl font-black text-amber-500">{formatCurrency(summary.totalAmount, prefs.currency)}</p>
                </div>

                {/* By Period */}
                <div className="bg-surface border border-border rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-sm text-text-muted">حسب المدة</span>
                    </div>
                    <div className="flex gap-2 text-xs">
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded-lg">1-7: {summary.byDay['1-7']}</span>
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-500 rounded-lg">8-30: {summary.byDay['8-30']}</span>
                        <span className="px-2 py-1 bg-red-500/20 text-red-500 rounded-lg">30+: {summary.byDay['30+']}</span>
                    </div>
                </div>

                {/* Top Customers */}
                <div className="bg-surface border border-border rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-500" />
                        </div>
                        <span className="text-sm text-text-muted">عملاء متأخرين</span>
                    </div>
                    <p className="text-2xl font-black text-text-main">{summary.topCustomers.length}</p>
                </div>
            </div>

            {/* Alerts List */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border">
                    <h3 className="font-bold text-text-main flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        تفاصيل الأقساط المتأخرة
                    </h3>
                </div>

                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                    {summary.alerts.map((alert, i) => (
                        <div key={i} className="p-4 hover:bg-surface-hover transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getSeverityColor(alert.daysOverdue)}`}>
                                        <span className="text-xs font-bold">{alert.daysOverdue}d</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-text-main">{alert.customerName}</p>
                                        <p className="text-xs text-text-muted">
                                            قسط #{alert.instNumber} • {alert.dueDate}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="text-left">
                                        <p className="font-bold text-red-500">{formatCurrency(alert.amount, prefs.currency)}</p>
                                        <p className="text-[10px] text-text-muted">متأخر {alert.daysOverdue} يوم</p>
                                    </div>

                                    {/* WhatsApp Button */}
                                    <button
                                        onClick={() => sendWhatsAppReminder(alert)}
                                        className="p-2.5 bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white rounded-xl transition-all border border-green-500/30"
                                        title="إرسال تذكير WhatsApp"
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                    </button>

                                    {/* Phone Button */}
                                    {alert.customerPhone && (
                                        <a
                                            href={`tel:${alert.customerPhone}`}
                                            className="p-2.5 bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white rounded-xl transition-all border border-blue-500/30"
                                            title="اتصال"
                                        >
                                            <Phone className="w-5 h-5" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Customers with Debt */}
            {summary.topCustomers.length > 0 && (
                <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-border">
                        <h3 className="font-bold text-text-main flex items-center gap-2">
                            <Users className="w-5 h-5 text-purple-500" />
                            أكثر العملاء تأخراً
                        </h3>
                    </div>

                    <div className="divide-y divide-border">
                        {summary.topCustomers.slice(0, 5).map((customer, i) => (
                            <div key={i} className="p-4 flex items-center justify-between hover:bg-surface-hover transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500 font-bold text-sm">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <p className="font-bold text-text-main">{customer.customerName}</p>
                                        <p className="text-xs text-text-muted">{customer.overdueCount} أقساط متأخرة</p>
                                    </div>
                                </div>
                                <span className="font-bold text-red-500">{formatCurrency(customer.totalDebt, prefs.currency)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstallmentAlerts;
