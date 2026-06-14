import React from 'react';
import { Sale, AppPreferences } from '../core/types';
import { formatCurrency } from '../core/utils';
import { QRCode } from './QRCode';

interface ReceiptTemplateProps {
    sale: Sale | null;
    prefs: AppPreferences;
    mode?: 'thermal' | 'a4';
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ sale, prefs, mode = 'thermal' }) => {
    if (!sale) return null;

    // ═══════════════════════════════════════════════════════════════════════════
    // 📄 A4 PROFESSIONAL CORPORATE INVOICE - MULTI-PAGE SUPPORT
    // ═══════════════════════════════════════════════════════════════════════════
    if (mode === 'a4') {
        // Pagination: 18 items per page to leave room for header/footer
        const ITEMS_PER_PAGE = 18;
        const items = sale.items || [];
        const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));

        const pages = [];
        for (let i = 0; i < totalPages; i++) {
            pages.push(items.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE));
        }

        return (
            <>
                {pages.map((pageItems, pageIndex) => (
                    <div
                        key={pageIndex}
                        className="a4-page w-[210mm] h-[297mm] bg-white text-gray-800 font-sans relative flex flex-col mx-auto shadow-2xl print:shadow-none print:w-[210mm] print:h-[297mm] print:relative print:m-0 overflow-hidden box-border mb-8 print:mb-0"
                        dir="rtl"
                        data-page-index={pageIndex}
                    >
                        <style>{`
                            @media print {
                                @page { size: A4 portrait; margin: 0; }
                                html, body { margin: 0; padding: 0; }
                                body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                .print-bg-primary { background-color: ${prefs.accentColor} !important; color: white !important; }
                            }
                        `}</style>

                        {/* ═══ HEADER ═══ */}
                        <div
                            className={`${pageIndex === 0 ? 'h-28' : 'h-16'} w-full flex justify-between items-center px-10 print-bg-primary relative overflow-hidden`}
                            style={{ background: `linear-gradient(135deg, ${prefs.accentColor} 0%, ${prefs.accentColor}dd 100%)`, color: 'white' }}
                        >
                            {/* Decorative Circles */}
                            <div className="absolute inset-0 opacity-10">
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full"></div>
                            </div>

                            <div className="flex items-center gap-4 z-10">
                                {prefs.storeLogo && pageIndex === 0 && (
                                    <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-lg p-1">
                                        <img src={prefs.storeLogo} className="w-full h-full object-contain" alt="Logo" />
                                    </div>
                                )}
                                <div>
                                    <h2 className={`${pageIndex === 0 ? 'text-2xl' : 'text-lg'} font-black tracking-tight`}>{prefs.storeName}</h2>
                                    {pageIndex === 0 && prefs.storePhone && <p className="text-sm opacity-90 font-mono mt-1" dir="ltr">{prefs.storePhone}</p>}
                                </div>
                            </div>

                            <div className="text-left z-10">
                                <h1 className={`${pageIndex === 0 ? 'text-4xl' : 'text-2xl'} font-black tracking-tight`}>فاتورة</h1>
                                <p className="text-sm font-mono opacity-80 mt-1">
                                    {sale.id}
                                    {totalPages > 1 && <span className="bg-white/20 px-2 py-0.5 rounded mr-2">صفحة {pageIndex + 1}/{totalPages}</span>}
                                </p>
                            </div>
                        </div>

                        {/* ═══ INFO SECTION (First Page Only) ═══ */}
                        {pageIndex === 0 && (
                            <div className="px-10 py-4 flex justify-between items-start border-b-2 border-gray-100 bg-gradient-to-b from-gray-50 to-white">
                                <div className="flex gap-4">
                                    <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm min-w-[160px]">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">العميل</p>
                                        <h3 className="text-lg font-black text-gray-800">{sale.customer || 'عميل عام'}</h3>
                                    </div>
                                    <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">التاريخ</p>
                                        <p className="font-bold text-gray-700 font-mono">{sale.date}</p>
                                    </div>
                                    <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">الدفع</p>
                                        <p className="font-bold text-gray-700">
                                            {sale.paymentMethod === 'cash' ? 'نقدي' :
                                                sale.paymentMethod === 'card' ? 'بطاقة' : 'آجل'}
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-white border-2 border-gray-200 rounded-xl p-2 w-24 h-24 shadow-lg">
                                    <QRCode data={`INV:${sale.id}|T:${sale.total}`} size={80} />
                                </div>
                            </div>
                        )}

                        {/* ═══ ITEMS TABLE ═══ */}
                        <div className="px-10 py-4 flex-1 overflow-hidden">
                            <table className="w-full text-right border-collapse">
                                <thead>
                                    <tr style={{ backgroundColor: prefs.accentColor }} className="text-white print-bg-primary">
                                        <th className="py-2.5 px-4 text-xs font-bold rounded-r-lg w-[5%]">#</th>
                                        <th className="py-2.5 px-4 text-xs font-bold w-[45%]">المنتج</th>
                                        <th className="py-2.5 px-4 text-xs font-bold text-center w-[12%]">الكمية</th>
                                        <th className="py-2.5 px-4 text-xs font-bold text-center w-[18%]">السعر</th>
                                        <th className="py-2.5 px-4 text-xs font-bold text-center rounded-l-lg w-[20%]">الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {pageItems.map((p, i) => {
                                        const globalIndex = pageIndex * ITEMS_PER_PAGE + i;
                                        return (
                                            <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-gray-50/40' : 'bg-white'}`}>
                                                <td className="py-2.5 px-4 font-mono text-gray-400 text-xs">{globalIndex + 1}</td>
                                                <td className="py-2.5 px-4 font-bold text-gray-800">{p.name}</td>
                                                <td className="py-2.5 px-4 text-center font-mono text-gray-600">{p.qty}</td>
                                                <td className="py-2.5 px-4 text-center font-mono text-gray-600">{formatCurrency(p.price, prefs.currency).replace(prefs.currency, '')}</td>
                                                <td className="py-2.5 px-4 text-center font-bold font-mono text-gray-800">{formatCurrency(p.total || (p.price * p.qty), prefs.currency).replace(prefs.currency, '')}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* ═══ FOOTER ═══ */}
                        {pageIndex === totalPages - 1 ? (
                            // Last Page: Full Footer with Totals
                            <div className="px-10 py-5 mt-auto border-t-2 border-gray-100 bg-gradient-to-b from-white to-gray-50">
                                {/* Installment Plan */}
                                {sale.installmentPlan && sale.installmentPlan.schedule && (
                                    <div className="mb-4 pb-3 border-b border-gray-200">
                                        <div className="flex items-center gap-6 mb-3">
                                            <h4 className="font-bold text-gray-700 text-sm">
                                                جدول الأقساط
                                                <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-600 mr-2">
                                                    {sale.installmentPlan.months} أشهر
                                                </span>
                                            </h4>
                                            <span className="text-sm">المقدم: <b style={{ color: prefs.accentColor }}>{formatCurrency(sale.installmentPlan.downPayment, prefs.currency)}</b></span>
                                            <span className="text-sm">المتبقي: <b className="text-gray-700">{formatCurrency(sale.total - sale.installmentPlan.downPayment, prefs.currency)}</b></span>
                                        </div>
                                        {/* Installment Schedule Table */}
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="py-1.5 px-2 text-right font-bold">القسط</th>
                                                    <th className="py-1.5 px-2 text-center font-bold">التاريخ</th>
                                                    <th className="py-1.5 px-2 text-center font-bold">المبلغ</th>
                                                    <th className="py-1.5 px-2 text-center font-bold">الحالة</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sale.installmentPlan.schedule.map((inst, i) => (
                                                    <tr key={i} className="border-b border-gray-100">
                                                        <td className="py-1.5 px-2 font-mono">{inst.number}</td>
                                                        <td className="py-1.5 px-2 text-center font-mono">{inst.dueDate}</td>
                                                        <td className="py-1.5 px-2 text-center font-mono">{formatCurrency(inst.amount, prefs.currency)}</td>
                                                        <td className="py-1.5 px-2 text-center">
                                                            {inst.status === 'paid' ? (
                                                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">✓ مسدد</span>
                                                            ) : (
                                                                <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-[10px] font-bold">مستحق</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="flex justify-between items-end">
                                    <div className="text-sm text-gray-500 max-w-md">
                                        {prefs.receiptFooter && <p className="font-bold text-gray-600 mb-2">{prefs.receiptFooter}</p>}

                                    </div>

                                    <div className="w-72 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 shadow-md">
                                        <div className="flex justify-between text-sm text-gray-600 pb-2 border-b border-gray-200">
                                            <span className="font-bold">المجموع الفرعي</span>
                                            <span className="font-mono font-bold">{formatCurrency(sale.subtotal, prefs.currency).replace(prefs.currency, '')}</span>
                                        </div>
                                        {sale.discount > 0 && (
                                            <div className="flex justify-between text-sm text-red-500 py-2 border-b border-gray-200">
                                                <span className="font-bold">الخصم</span>
                                                <span className="font-mono">- {formatCurrency(sale.discount, prefs.currency).replace(prefs.currency, '')}</span>
                                            </div>
                                        )}
                                        <div
                                            className="flex justify-between text-lg font-black text-white p-3 rounded-lg mt-3 shadow-md print-bg-primary"
                                            style={{ background: `linear-gradient(135deg, ${prefs.accentColor} 0%, ${prefs.accentColor}cc 100%)` }}
                                        >
                                            <span>الإجمالي النهائي</span>
                                            <span className="font-mono text-xl">{formatCurrency(sale.total, prefs.currency)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Not Last Page: "Continued" Footer
                            <div className="px-10 py-3 mt-auto border-t border-gray-200 bg-gray-50 text-center">
                                <p className="text-sm text-gray-400">
                                    يتبع في الصفحة التالية...
                                    <span className="font-mono font-bold mr-2">({pageIndex + 2}/{totalPages})</span>
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🧾 THERMAL RECEIPT - DYNAMIC SIZE BASED ON SETTINGS
    // ═══════════════════════════════════════════════════════════════════════════

    // Get thermal paper size from prefs (default: 80mm)
    const paperSize = prefs.thermalPaperSize || '80mm';

    // Calculate content width based on paper size (subtract margins)
    const widthMap: Record<string, string> = {
        '58mm': '50mm',
        '80mm': '72mm',
        '110mm': '100mm'
    };
    const contentWidth = widthMap[paperSize] || '72mm';

    return (
        <div className={`bg-white text-black font-sans text-[11px] leading-tight p-0 mx-auto shadow-lg print:shadow-none print:absolute print:top-0 print:left-0 box-border print-only`} dir="rtl" style={{ width: contentWidth }}>
            <style>{`
                @media print {
                    @page { size: ${paperSize} auto; margin: 0; }
                    body { background: white; margin: 0; padding: 0; }
                    .print-only { display: block !important; width: ${contentWidth} !important; margin: 0 auto; }
                }
            `}</style>

            {/* ═══ HEADER WITH LOGO ═══ */}
            <div className="text-center pt-4 pb-3 border-b-2 border-black">
                {prefs.storeLogo && (
                    <div className="w-16 h-16 mx-auto mb-3 rounded-lg overflow-hidden border-2 border-gray-300 p-1 bg-white">
                        <img src={prefs.storeLogo} className="w-full h-full object-contain" alt="Logo" />
                    </div>
                )}
                <h1 className="text-xl font-black tracking-wide leading-tight">{prefs.storeName}</h1>
                {prefs.storeAddress && (
                    <p className="text-[10px] mt-1.5 text-gray-700 px-2 leading-snug">{prefs.storeAddress}</p>
                )}
                {prefs.storePhone && (
                    <p className="text-[11px] font-mono font-bold mt-1" dir="ltr">{prefs.storePhone}</p>
                )}
            </div>

            {/* ═══ INVOICE INFO ═══ */}
            <div className="py-2 px-2 border-b border-dashed border-gray-400 bg-gray-50">
                <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold">رقم الفاتورة:</span>
                    <span className="font-mono font-black">{sale.id}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] mt-1">
                    <span className="font-bold">التاريخ:</span>
                    <span className="font-mono">{sale.date} - {new Date(sale.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                </div>
            </div>

            {/* ═══ CUSTOMER ═══ */}
            {sale.customer && sale.customer !== 'زبون عام' && (
                <div className="py-2 px-2 border-b border-dashed border-gray-300 bg-gray-50/50">
                    <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-gray-600">العميل:</span>
                        <span className="font-bold">{sale.customer}</span>
                    </div>
                </div>
            )}

            {/* ═══ ITEMS TABLE ═══ */}
            <div className="px-2 py-3">
                <div className="flex justify-between font-black text-[10px] border-b-2 border-black pb-1.5 mb-2">
                    <span className="flex-1">المنتج</span>
                    <span className="w-10 text-center">الكمية</span>
                    <span className="w-16 text-left">السعر</span>
                </div>
                {sale.items?.map((p, i) => (
                    <div key={i} className="mb-2 pb-2 border-b border-dashed border-gray-200 last:border-0 last:pb-0 last:mb-0">
                        <div className="flex justify-between items-start">
                            <div className="flex-1 flex flex-col pl-1">
                                <span className="font-bold text-[11px] leading-tight">{p.name}</span>
                                <span className="text-[9px] text-gray-500 font-mono mt-0.5">{formatCurrency(p.price, prefs.currency).replace(prefs.currency, '')}</span>
                            </div>
                            <span className="w-10 text-center font-mono text-[11px] font-bold mt-0.5">{p.qty}</span>
                            <span className="w-16 text-left font-mono font-bold text-black text-[11px] mt-0.5">{formatCurrency(p.total || (p.qty * p.price), prefs.currency).replace(prefs.currency, '')}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* ═══ TOTALS ═══ */}
            <div className="border-t-2 border-black px-2 py-2 space-y-1 bg-gray-50">
                <div className="flex justify-between text-[11px]">
                    <span>المجموع الفرعي:</span>
                    <span className="font-mono font-bold">{formatCurrency(sale.subtotal, prefs.currency).replace(prefs.currency, '')}</span>
                </div>
                {(sale.discount > 0 || sale.pointsRedeemed) && (
                    <div className="flex justify-between text-[11px] text-gray-600">
                        <span>الخصم:</span>
                        <span className="font-mono">- {formatCurrency(sale.discount + (sale.pointsRedeemed || 0), prefs.currency).replace(prefs.currency, '')}</span>
                    </div>
                )}
                <div className="flex justify-between text-sm font-black border-t-2 border-black pt-2 mt-2">
                    <span>الإجمالي:</span>
                    <span className="font-mono text-base">{formatCurrency(sale.total, prefs.currency)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>طريقة الدفع:</span>
                    <span className="font-bold">
                        {sale.paymentMethod === 'cash' ? 'نقدي' :
                            sale.paymentMethod === 'card' ? 'بطاقة' :
                                sale.paymentMethod === 'credit' ? 'آجل' :
                                    sale.paymentMethod === 'installment' ? 'أقساط' : 'مجزأ'}
                    </span>
                </div>
            </div>

            {/* ═══ INSTALLMENT PLAN ═══ */}
            {sale.installmentPlan && (
                <div className="px-2 py-2 border-t border-dashed border-black bg-gray-100">
                    <p className="font-black text-[10px] text-center mb-2 pb-1 border-b border-gray-400">جدول الأقساط ({sale.installmentPlan.months} أشهر)</p>
                    <div className="flex justify-between text-[10px] mb-2 bg-white px-2 py-1 rounded">
                        <span>الدفعة المقدمة:</span>
                        <span className="font-mono font-bold">{formatCurrency(sale.installmentPlan.downPayment, prefs.currency)}</span>
                    </div>
                    <div className="space-y-1">
                        {sale.installmentPlan.schedule.map((inst, i) => (
                            <div key={i} className={`flex justify-between text-[9px] font-mono px-2 py-1 rounded ${inst.status === 'paid' ? 'bg-green-100' : 'bg-white'}`}>
                                <span>القسط {inst.number} ({inst.dueDate}) {inst.status === 'paid' && '✓'}</span>
                                <span className="font-bold">
                                    {formatCurrency(inst.amount, prefs.currency)}
                                    {inst.status === 'paid' ? ' ✓' : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ QR CODE & FOOTER ═══ */}
            <div className="mt-3 pb-1 text-center border-t border-dashed border-gray-400 pt-3">
                <div className="w-20 h-20 mx-auto mb-3 bg-white border-2 border-gray-300 p-1.5 rounded-lg">
                    <QRCode data={`INV:${sale.id}|T:${sale.total}|D:${sale.date}`} size={68} className="w-full h-full" />
                </div>
                {prefs.receiptFooter && (
                    <p className="text-[10px] px-3 text-gray-600 leading-relaxed mb-2">{prefs.receiptFooter}</p>
                )}
                <div className="border-t border-dashed border-gray-300 pt-2 mt-2">

                    <p className="text-[8px] text-gray-500 mt-1 font-mono">Powered by Beidar POS</p>
                </div>
            </div>
        </div>
    );
};
