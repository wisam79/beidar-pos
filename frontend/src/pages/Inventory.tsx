
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Package, AlertTriangle, DollarSign, Printer, RefreshCw, Sparkles, Plus, Minus, ChevronDown, XCircle, Layers, ChevronRight, ChevronLeft, History, Truck, BarChart2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Product, StockMovement, AppPreferences } from '../core/types';
import { formatCurrency } from '../core/utils';
import { Badge, PageHeader, EmptyState } from '../components/ui';
import { analyzeInventoryRisk } from '../core/ai';
import { api, ProductStats } from '../core/api';
import { useInvalidateProducts } from '../hooks';
import { PageShell, StatsGrid, StatCard, LoadingState, FilterBar, SearchInput, SegmentedControl, Pagination } from '../components/blocks';

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

interface InventoryPageProps {
    notify: (msg: string, type: 'success' | 'error' | 'info') => void;
    prefs?: AppPreferences;
}

const CACHE_KEY = 'beidar_inv_analysis_cache';

export const InventoryPage: React.FC<InventoryPageProps> = ({ notify, prefs }) => {
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
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);

    // Data State
    const [products, setProducts] = useState<Product[]>([]);
    const [stats, setStats] = useState<ProductStats>({ totalStock: 0, totalValue: 0, totalCost: 0, profit: 0 });
    const [globalCounts, setGlobalCounts] = useState({ low: 0, out: 0 });

    // Metadata for filters
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [suppliers, setSuppliers] = useState<{ id: string, companyName: string }[]>([]);

    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [loading, setLoading] = useState(true);

    // --- Data Loading ---
    const fetchMetadata = async () => {
        try {
            const [cats, sups] = await Promise.all([
                api.categories.list().catch(() => []),
                api.suppliers.list().catch(() => [])
            ]);

            // Safe mapping in case of unexpected API response structure
            const mappedCats = (Array.isArray(cats) ? cats : []).map((c: { name: string }) => ({ id: c.name, name: c.name }));
            const mappedSups = (Array.isArray(sups) ? sups : []).map((s) => ({ id: s.id || '', companyName: s.companyName || '' }));

            setCategories(mappedCats);
            setSuppliers(mappedSups);
        } catch (e) { console.error("Metadata load failed", e); }
    };

    const loadProducts = useCallback(async () => {
        try {
            setLoading(true);
            const dbCategory = categoryFilter === 'all' ? '' : categoryFilter;
            const dbSupplier = supplierFilter === 'all' ? '' : supplierFilter;

            // Fetch Products
            const response = await api.products.list(
                page + 1, // API is 1-based
                pageSize,
                debouncedSearch,
                dbCategory,
                dbSupplier,
                filterType
            );

            if (response) {
                setProducts(response.data || []);
                setTotalItems(response.total || 0);
                setTotalPages(response.totalPages || 0);
                if (response.stats) {
                    setStats(response.stats);
                }
            }

            // Fetch Counts (Dashboard Stats) for the status cards
            api.stats.getDashboard('week').then(d => {
                setGlobalCounts({
                    low: d.lowStockCount || 0,
                    out: 0 // Note: outOfStockCount not available in DashboardStats
                });
            });

        } catch (_e) {
            notify("خطأ في تحميل البيانات", "error");
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, debouncedSearch, categoryFilter, supplierFilter, filterType, notify]);

    // Load Stock Movements
    const loadMovements = useCallback(async () => {
        try {
            const data = await api.stock.movements();
            // Cast to local type - backend returns compatible structure
            setMovements((data || []) as StockMovement[]);
        } catch (e) {
            console.error("Failed to load movements", e);
        }
    }, []);

    // Initial Metadata Load
    useEffect(() => { fetchMetadata(); }, []);

    // Load Data on Change
    useEffect(() => { loadProducts(); }, [loadProducts]);

    // Load Movements when tab changes to movements
    useEffect(() => {
        if (activeTab === 'movements') {
            loadMovements();
        }
    }, [activeTab, loadMovements]);

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
        // Optimistic update locally
        setProducts(prev => prev.map(prod => prod.id === p.id ? { ...prod, stock: newStock } : prod));

        try {
            if (p.id) {
                await api.products.save({ ...p, stock: newStock });
                invalidateProducts();
                notify('تم تحديث المخزون', 'success');
            }
        } catch (e: unknown) {
            console.error(e);
            const msg = e instanceof Error ? e.message : String(e);
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
                            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${showStats
                                ? 'bg-surface border border-border text-text-muted hover:text-text-main'
                                : 'bg-gradient-to-br from-primary to-emerald-500 text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105'
                                }`}
                            title={showStats ? 'إخفاء الإحصائيات' : 'عرض التحليل'}
                        >
                            <BarChart2 size={showStats ? 20 : 22} strokeWidth={showStats ? 1.5 : 2.5} />
                        </button>
                        <button onClick={handlePrint} className="px-4 py-3 bg-surface hover:bg-surface-hover text-text-main border border-border rounded-xl text-sm font-bold flex items-center gap-2 transition-colors touch-target active:scale-95"><Printer size={18} /> طباعة</button>
                        <button onClick={handleRunAnalysis} disabled={isAnalyzing} className={`px-4 py-3 rounded-xl border flex items-center gap-2 transition-all text-sm font-bold shadow-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-500 dark:text-purple-400 border-purple-500/30 hover:border-purple-500/50 hover:shadow-purple-500/20 touch-target active:scale-95`}>
                            {isAnalyzing ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />} تحليل AI
                        </button>
                    </div>
                }
            />

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
                        {/* Filters - Compact Unified Design */}
                        <FilterBar>
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

                            <div className="hidden xl:block w-px h-8 bg-border mx-1" />

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
                                    className="appearance-none bg-surface border border-border text-text-main text-[11px] font-bold 
                                        rounded-xl pl-8 pr-9 py-2.5 outline-none cursor-pointer 
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
                                    className="appearance-none bg-surface border border-border text-text-main text-[11px] font-bold 
                                        rounded-xl pl-8 pr-9 py-2.5 outline-none cursor-pointer 
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
                        </FilterBar>

                        {/* Products List - Card Style matching Invoices exactly */}
                        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pr-2 pb-10 relative">
                            {products.length === 0 ? (
                                <EmptyState icon={Package} title="لا توجد منتجات" description={search ? "لا توجد نتائج مطابقة لبحثك." : "لم تتم إضافة أي منتجات بعد."} />
                            ) : (
                                <div className="space-y-2">
                                    {products.map((p, index) => {
                                        const isLow = p.stock <= (p.minStock || 5);
                                        const isOut = p.stock === 0;
                                        const healthPercent = Math.min(100, (p.stock / ((p.minStock || 5) * 4)) * 100);
                                        const barColor = isOut ? 'bg-red-500' : isLow ? 'bg-orange-500' : healthPercent < 50 ? 'bg-yellow-500' : 'bg-emerald-500';
                                        const productVal = p.stock * p.price;
                                        const abcClass = getABCClass(productVal);
                                        const animStyle = { animationDelay: `${index * 50}ms` };

                                        return (
                                            <div
                                                key={p.id}
                                                className={`
                                                    group relative bg-surface/50 border border-border rounded-2xl p-4 cursor-pointer backdrop-blur-md
                                                    transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1
                                                    grid grid-cols-2 md:grid-cols-12 gap-3 items-center
                                                    ${isOut ? 'opacity-60 grayscale-[0.5]' : ''}
                                                `}
                                                style={animStyle}
                                            >
                                                {/* Status Indicator Bar - matching Invoices */}
                                                <div className={`absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full shadow-[0_0_10px_currentColor] ${isOut ? 'bg-red-500 text-red-500' : isLow ? 'bg-orange-500 text-orange-500' : 'bg-emerald-500 text-emerald-500'}`}></div>

                                                {/* Product Info - col-span-2 like Invoice ID */}
                                                <div className="col-span-2 flex items-center gap-3 pl-2">
                                                    <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center text-text-muted group-hover:text-primary transition-colors shadow-inner">
                                                        {p.image.startsWith('data') ? <img src={p.image} alt={p.name} className="w-full h-full object-cover rounded-xl" /> : <Package size={18} />}
                                                    </div>
                                                    <div>
                                                        <p className="font-mono font-bold text-text-main text-xs group-hover:text-primary transition-colors">{p.name}</p>
                                                        <p className="text-[10px] text-text-muted font-medium">{p.barcode}</p>
                                                    </div>
                                                </div>

                                                {/* Supplier - col-span-3 like Customer */}
                                                <div className="col-span-3">
                                                    <p className="font-bold text-text-main text-sm truncate">{p.supplier || '-'}</p>
                                                    <p className="text-[10px] text-text-muted flex items-center gap-1.5 mt-0.5">
                                                        <Layers size={10} />
                                                        {p.category}
                                                    </p>
                                                </div>

                                                {/* Stock + Health - col-span-2 like Date */}
                                                <div className="col-span-2">
                                                    <div className="flex items-center gap-1.5 text-text-muted text-[10px] bg-bg px-2 py-1 rounded-lg w-fit border border-border">
                                                        <Package size={10} />
                                                        <span className={`font-bold ${isOut ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-text-main'}`}>{p.stock}</span>
                                                        <span className="text-text-muted/50">قطعة</span>
                                                    </div>
                                                </div>

                                                {/* Value - col-span-2 like Total */}
                                                <div className="col-span-2">
                                                    <span className="font-black text-text-main text-lg tracking-tight drop-shadow-sm">{formatCurrency(productVal, prefs?.currency).replace(prefs?.currency || 'IQD', '')} <span className="text-[9px] text-text-muted font-bold ml-0.5">{prefs?.currency || 'IQD'}</span></span>
                                                </div>

                                                {/* ABC Badge - col-span-2 like Status */}
                                                <div className="col-span-2">
                                                    <Badge type={abcClass === 'A' ? 'success' : abcClass === 'B' ? 'info' : 'default'} text={`تصنيف ${abcClass}`} />
                                                </div>

                                                {/* Quick Actions - col-span-1 */}
                                                <div className="col-span-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="bg-surface border border-border rounded-xl p-1 flex shadow-xl backdrop-blur-md">
                                                        <button onClick={(e) => { e.stopPropagation(); updateStock(p, -1); }} className="p-2 hover:bg-surface-hover hover:text-red-400 text-text-muted rounded-lg transition-colors" title="إنقاص المخزون"><Minus size={16} /></button>
                                                        <div className="w-px bg-border my-1"></div>
                                                        <button onClick={(e) => { e.stopPropagation(); updateStock(p, 1); }} className="p-2 hover:bg-surface-hover hover:text-emerald-400 text-text-muted rounded-lg transition-colors" title="زيادة المخزون"><Plus size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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
                                        <div key={m.id || i} className="flex items-center justify-between p-3 bg-surface/50 border border-border rounded-xl hover:bg-surface transition-colors">
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
