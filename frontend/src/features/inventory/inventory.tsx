
import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, DollarSign, Printer, RefreshCw, Sparkles, Plus, Minus, ChevronDown, XCircle, Layers, History, Truck, BarChart2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Product } from '../../core/types';
import { formatCurrency } from '../../core/utils';
import { PageHeader, EmptyState } from '../../components/ui';
import { analyzeInventoryRisk } from '../../core/ai';
import { api } from '../../core/api';
import { useInvalidateProducts, useDashboardStats, useInventoryProducts, useInventoryMetadata, useInventoryMovements } from '../../hooks';
import { PageShell, StatsGrid, StatCard, LoadingState, SearchInput, SegmentedControl, Pagination } from '../../components/blocks';
import { usePreferences } from '../../components/PreferencesContext';

// Internal debounce hook since lodash might not be available
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

const CACHE_KEY = 'beidar_inv_analysis_cache';

export const InventoryPage: React.FC = () => {
    const { notify, prefs } = usePreferences();
    // React Query cache invalidation
    const invalidateProducts = useInvalidateProducts();

    // UI State
    const [activeTab, setActiveTab] = useState<'products' | 'movements'>('products');
    const [showStats, setShowStats] = useState(false);

    // Filter State
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500); // 500ms debounce
    const [filterType, setFilterType] = useState<'all' | 'low' | 'out'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [supplierFilter, setSupplierFilter] = useState<string>('all');

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiReport, setAiReport] = useState<string>('');
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);

    // Pagination State
    const [page, setPage] = useState(0);
    const [pageSize] = useState(50);

    // Data State
    const { stats: dashboardStats } = useDashboardStats('week');
    const globalCounts = {
        low: dashboardStats?.lowStockCount || 0,
        out: 0
    };

    const { data: metaData } = useInventoryMetadata();
    const categories = metaData?.categories || [];
    const suppliers = metaData?.suppliers || [];

    const { data: productsData, isLoading: loading, refetch: loadProducts } = useInventoryProducts(page, pageSize, debouncedSearch, categoryFilter, supplierFilter, filterType);
    const products = productsData?.products || [];
    const stats = productsData?.stats || { totalStock: 0, totalValue: 0, totalCost: 0, profit: 0 };
    const totalItems = productsData?.totalItems || 0;
    const totalPages = productsData?.totalPages || 0;

    const { data: movements = [], refetch: loadMovements } = useInventoryMovements(activeTab === 'movements');

    // Reset page when filters change
    useEffect(() => { setPage(0); }, [debouncedSearch, categoryFilter, supplierFilter, filterType]);

    // ABC Analysis Logic
    const getABCClass = (productValue: number) => {
        if (stats.totalValue === 0) return 'C';
        const share = (productValue / stats.totalValue) * 100;
        if (share >= 1) return 'A';
        if (share >= 0.5) return 'B';
        return 'C';
    };

    // --- AI Report Cache ---
    useEffect(() => {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const { timestamp, data } = JSON.parse(cached);
                setAiReport(data);
                setLastUpdated(timestamp);
            } catch (_e) { /* ignore */ }
        }
    }, []);

    // Auto-hide AI report after 15 seconds
    useEffect(() => {
        if (aiReport) {
            const timer = setTimeout(() => {
                setAiReport('');
            }, 15000);
            return () => clearTimeout(timer);
        }
    }, [aiReport]);

    const handleRunAnalysis = async () => {
        const now = Date.now();
        if (lastUpdated && (now - lastUpdated < 60 * 1000)) {
            notify('يرجى الانتظار قليلاً قبل طلب تحليل جديد', 'info');
            return;
        }
        setIsAnalyzing(true);
        try {
            const lowStockResponse = await api.products.list(1, 50, '', '', '', 'low'); // Fetch top 50 low stock
            if (!lowStockResponse.data || lowStockResponse.data.length === 0) {
                notify("لا توجد منتجات منخفضة المخزون للتحليل", "info");
                setIsAnalyzing(false);
                return;
            }
            const report = await analyzeInventoryRisk(lowStockResponse.data);
            setAiReport(report);
            setLastUpdated(now);
            localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, data: report }));
        } catch (e) {
            notify("فشل التحليل الذكي", "error");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const updateStock = async (p: Product, change: number) => {
        const newStock = Math.max(0, p.stock + change);
        // No manual setProducts needed, handled by invalidateProducts

        try {
            if (p.id) {
                await api.products.save({ ...p, stock: newStock });
                await api.stock.log(p.id, p.name, change > 0 ? 'in' : 'out', Math.abs(change), 'تعديل سريع للمخزون');
                invalidateProducts();
                notify('تم تحديث المخزون', 'success');
            }
        } catch (e: unknown) {
            console.error(e);
            loadProducts(); // Revert
        }
    };

    const handlePrint = () => { window.print(); };

    if (loading) return <LoadingState icon={Layers} title="جاري تحميل المخزون..." subtitle="تحضير المنتجات" />;

    return (
        <PageShell>
            {/* Print Styles */}
            <style>{`
        @media print {
            @page { size: A4 landscape; margin: 1cm; }
            body * { visibility: hidden; height: 0; overflow: hidden; }
            #printable-inventory, #printable-inventory * { visibility: visible !important; height: auto !important; display: block !important; }
            #printable-inventory { position: absolute; top: 0; left: 0; width: 100%; background: white; color: black; padding: 0; }
            #printable-inventory table { display: table !important; width: 100%; border-collapse: collapse; font-size: 12px; }
            #printable-inventory thead { display: table-header-group; background: #eee; }
            #printable-inventory tr { display: table-row; break-inside: avoid; border-bottom: 1px solid #ddd; }
            #printable-inventory td, #printable-inventory th { display: table-cell; padding: 8px; text-align: right; }
        }
       `}</style>

            <PageHeader
                title="إدارة المخزون"
                icon={Layers}
                description="تحليل المخزون، تتبع الحركات، وتقييم الأصول."
                actions={
                    <div className="flex gap-2 items-center">
                        <SegmentedControl
                            options={[
                                { id: 'products', label: 'المنتجات' },
                                { id: 'movements', label: 'سجل الحركات' },
                            ]}
                            value={activeTab}
                            onChange={(v) => setActiveTab(v as 'products' | 'movements')}
                        />
                        <button
                            onClick={() => setShowStats(!showStats)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${showStats
                                ? 'bg-surface border border-border text-text-muted hover:text-text-main'
                                : 'bg-gradient-to-br from-primary to-emerald-500 text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105'
                                }`}
                            title={showStats ? 'إخفاء الإحصائيات' : 'عرض التحليل'}
                        >
                            <BarChart2 size={showStats ? 18 : 20} strokeWidth={showStats ? 1.5 : 2.5} />
                        </button>
                        <button onClick={handlePrint} className="h-10 px-4 bg-surface hover:bg-surface-hover text-text-main border border-border rounded-xl text-xs font-bold flex items-center gap-2 transition-colors touch-target active:scale-95"><Printer size={16} /> طباعة</button>
                        <button onClick={handleRunAnalysis} disabled={isAnalyzing} className={`h-10 px-4 rounded-xl border flex items-center gap-2 transition-all text-xs font-bold shadow-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-500 dark:text-purple-400 border-purple-500/30 hover:border-purple-500/50 hover:shadow-purple-500/20 touch-target active:scale-95`}>
                            {isAnalyzing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />} تحليل AI
                        </button>
                    </div>
                }
            >
                {activeTab === 'products' && (
                    <div className="flex flex-col md:flex-row gap-3 items-center w-full">
                        {/* Status Segmented Control */}
                        <SegmentedControl
                            options={[
                                { id: 'all', label: 'الكل' },
                                { id: 'low', label: 'منخفض' },
                                { id: 'out', label: 'نافذ' },
                            ]}
                            value={filterType}
                            onChange={(v) => setFilterType(v as 'all' | 'low' | 'out')}
                        />

                        <div className="hidden xl:block w-px h-8 bg-border/60 mx-1" />

                        <div className="flex flex-wrap items-center gap-2 flex-1 w-full md:w-auto justify-end">
                            {/* Category Dropdown */}
                            <div className="relative shrink-0 group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                                    <ChevronDown size={14} />
                                </div>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted/70 pointer-events-none">
                                    <Package size={14} />
                                </div>
                                <select
                                    title="اختر الفئة"
                                    className="appearance-none bg-input-bg border border-border text-text-main text-[11px] font-bold 
                                        rounded-xl pl-8 pr-9 h-10 outline-none cursor-pointer 
                                        focus:border-primary/50 transition-all hover:bg-surface-hover"
                                    value={categoryFilter}
                                    onChange={(e) => { setCategoryFilter(e.target.value); }}
                                >
                                    <option value="all">جميع الفئات</option>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>

                            {/* Supplier Dropdown */}
                            <div className="relative shrink-0 group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                                    <ChevronDown size={14} />
                                </div>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted/70 pointer-events-none">
                                    <Truck size={14} />
                                </div>
                                <select
                                    title="اختر المورد"
                                    className="appearance-none bg-input-bg border border-border text-text-main text-[11px] font-bold 
                                        rounded-xl pl-8 pr-9 h-10 outline-none cursor-pointer 
                                        focus:border-primary/50 transition-all hover:bg-surface-hover"
                                    value={supplierFilter}
                                    onChange={(e) => { setSupplierFilter(e.target.value); }}
                                >
                                    <option value="all">جميع الموردين</option>
                                    {suppliers.map(s => <option key={s.id} value={s.companyName}>{s.companyName}</option>)}
                                </select>
                            </div>

                            {/* Search Input */}
                            <SearchInput
                                value={search}
                                onChange={setSearch}
                                placeholder="بحث باسم المنتج، الباركود..."
                            />
                        </div>
                    </div>
                )}
            </PageHeader>

            {/* Stats Grid - Matching Invoices Style */}
            <StatsGrid columns={4} visible={showStats}>
                <StatCard 
                    icon={DollarSign} 
                    label="القيمة السوقية" 
                    value={formatCurrency(stats.totalValue, prefs?.currency).replace(prefs?.currency || 'IQD', '')} 
                    color="emerald" 
                    subtitle={`💰 الربح: ${formatCurrency(stats.profit, prefs?.currency).replace(prefs?.currency || 'IQD', '')}`} 
                />
                <StatCard 
                    icon={Package} 
                    label="المخزون الكلي" 
                    value={formatCurrency(stats.totalCost, prefs?.currency).replace(prefs?.currency || 'IQD', '')} 
                    color="blue" 
                    subtitle={`📦 ${stats.totalStock} قطعة`} 
                />
                <StatCard 
                    icon={AlertTriangle} 
                    label="النواقص (Low)" 
                    value={globalCounts.low} 
                    color="orange" 
                    subtitle="⚠️ يتطلب إعادة طلب" 
                />
                <StatCard 
                    icon={XCircle} 
                    label="النافذ (Out)" 
                    value={globalCounts.out} 
                    color="red" 
                    subtitle="🔴 رصيد صفري" 
                />
            </StatsGrid>

            {aiReport && (
                <div className="bg-surface border border-purple-500/30 rounded-2xl p-6 relative overflow-hidden animate-in slide-in-from-top-2">
                    <p className="text-sm text-text-main/90 leading-relaxed whitespace-pre-wrap font-medium relative z-10">{aiReport}</p>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 min-h-0 border border-border rounded-2xl flex flex-col overflow-hidden relative">
                {activeTab === 'products' ? (
                    <>

                        {/* Products Table - Standard Unified Style */}
                        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-[var(--shadow-card)] flex-1 flex flex-col min-h-0">
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {products.length === 0 ? (
                                    <EmptyState icon={Package} title="لا توجد منتجات" description={search ? "لا توجد نتائج مطابقة لبحثك." : "لم تتم إضافة أي منتجات بعد."} />
                                ) : (
                                    <table className="w-full text-right text-sm border-collapse">
                                        <thead className="sticky top-0 z-10 bg-surface-hover border-b border-border text-text-muted text-xs">
                                            <tr>
                                                <th className="px-4 py-3 text-right">المنتج</th>
                                                <th className="px-4 py-3 text-right">المورد / الفئة</th>
                                                <th className="px-4 py-3 text-center w-[120px]">المخزون</th>
                                                <th className="px-4 py-3 text-right w-[150px]">القيمة السوقية</th>
                                                <th className="px-4 py-3 text-center w-[100px]">ABC</th>
                                                <th className="px-4 py-3 text-center w-[100px]">الإجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {products.map((p) => {
                                                const isLow = p.stock <= (p.minStock || 5);
                                                const isOut = p.stock === 0;
                                                const productVal = p.stock * p.price;
                                                const abcClass = getABCClass(productVal);
                                                const healthColor = isOut ? 'bg-red-500' : isLow ? 'bg-orange-500' : 'bg-emerald-500';

                                                return (
                                                    <tr
                                                        key={p.id}
                                                        className={`border-b border-border/30 hover:bg-surface-hover transition-colors group ${
                                                            isOut ? 'opacity-60 grayscale-[0.5]' : ''
                                                        }`}
                                                    >
                                                        <td className="px-4 py-3 relative">
                                                            {/* Health indicator bar on the right in RTL */}
                                                            <div className={`absolute right-0 top-2 bottom-2 w-1 rounded-l-full ${healthColor} shadow-[0_0_8px_currentColor] text-${isOut ? 'red' : isLow ? 'orange' : 'emerald'}-500`} />
                                                            
                                                            <div className="flex items-center gap-3 pr-2">
                                                                <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center text-text-muted group-hover:text-primary transition-colors shrink-0 overflow-hidden shadow-inner">
                                                                    {p.image?.startsWith('data') ? (
                                                                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <Package size={18} />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-text-main text-xs group-hover:text-primary transition-colors">{p.name}</p>
                                                                    <p className="text-[10px] text-text-muted font-mono">{p.barcode}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs font-bold text-text-muted">
                                                            {p.supplier || '-'}<br />
                                                            <span className="text-[9px] opacity-75 font-normal flex items-center gap-1 mt-0.5">
                                                                <Layers size={10} className="inline mr-1" />
                                                                {p.category}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center gap-1.5 text-xs bg-bg px-2.5 py-1 rounded-lg border border-border w-fit mx-auto">
                                                                <span className={`font-bold ${isOut ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-text-main'}`}>{p.stock}</span>
                                                                <span className="text-text-muted/70 font-bold">قطعة</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold text-text-main">
                                                            {formatCurrency(productVal, prefs?.currency).replace(prefs?.currency || 'IQD', '')}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex justify-center">
                                                                <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg text-xs font-black font-mono border select-none ${
                                                                    abcClass === 'A' 
                                                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_2px_8px_rgba(16,185,129,0.06)]' 
                                                                        : abcClass === 'B' 
                                                                        ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-[0_2px_8px_rgba(59,130,246,0.06)]' 
                                                                        : 'bg-text-muted/10 text-text-muted border-border/40'
                                                                }`}>
                                                                    {abcClass}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex justify-center gap-1.5">
                                                                <button onClick={() => updateStock(p, -1)} className="p-1.5 hover:bg-red-500/10 hover:text-red-500 text-text-muted rounded-xl border border-border/40 transition-colors" title="إنقاص المخزون"><Minus size={13} /></button>
                                                                <button onClick={() => updateStock(p, 1)} className="p-1.5 hover:bg-emerald-500/10 hover:text-emerald-500 text-text-muted rounded-xl border border-border/40 transition-colors" title="زيادة المخزون"><Plus size={13} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Pagination Controls - Matching Invoices */}
                        <Pagination
                            page={page}
                            totalRecords={totalItems}
                            pageSize={pageSize}
                            onPageChange={setPage}
                        />
                    </>
                ) : (
                    // --- MOVEMENTS TAB ---
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {movements.length === 0 ? <EmptyState icon={History} title="لا توجد حركات مخزنية" description="لم يتم تسجيل أي عمليات بيع أو إضافة مخزون بعد." /> : (
                            <div className="space-y-2 p-2">
                                {movements.map((m, i) => {
                                    const isIncoming = m.type === 'restock' || m.type === 'return';
                                    return (
                                        <div key={m.id || i} className="flex items-center justify-between p-3 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isIncoming ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                    {isIncoming ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                                                </div>
                                                <div>
                                                    <p className="text-text-main font-bold text-sm">{m.productName}</p>
                                                    <p className="text-text-muted text-xs">{m.reason || (m.type === 'sale' ? 'بيع' : m.type === 'restock' ? 'إضافة مخزون' : m.type === 'return' ? 'مرتجع' : m.type)}</p>
                                                </div>
                                            </div>
                                            <div className="text-left">
                                                <span className={`font-black text-lg font-mono ${isIncoming ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {isIncoming ? '+' : '-'}{m.qty}
                                                </span>
                                                <p className="text-text-muted text-[10px]">{m.timestamp ? new Date(m.timestamp).toLocaleDateString('ar-IQ') : ''}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div id="printable-inventory" style={{ display: 'none' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>تقرير المخزون</h1>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: '1px solid black' }}><th style={{ textAlign: 'right' }}>المنتج</th><th style={{ textAlign: 'right' }}>الكمية</th><th style={{ textAlign: 'right' }}>القيمة</th><th style={{ textAlign: 'right' }}>الحالة</th></tr></thead>
                    <tbody>
                        {products.map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #ccc' }}>
                                <td>{p.name}</td>
                                <td>{p.stock}</td>
                                <td>{p.stock * p.price}</td>
                                <td>{p.stock === 0 ? 'نافذ' : p.stock <= (p.minStock || 5) ? 'منخفض' : 'جيد'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </PageShell>
    );
};
