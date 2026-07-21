import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Package, Printer, Plus, Layers, FileSpreadsheet, BarChart2 } from 'lucide-react';
import { Product, CategoryDef } from '../../core/types';
import { compressImage } from '../../core/utils';
import { PageHeader, EmptyState } from '../../components/ui';
import { PageShell, LoadingState } from '../../components/blocks';
import { BarcodeScannerOverlay, ScanResult } from '../../components/BarcodeScannerOverlay';
import { BarcodeDesigner } from './components/BarcodeDesigner';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ImportExportModal } from '../../components/ImportExportModal';
import { api } from '../../core/api';
import { generateProductDescription, improveText, suggestProductPrice, suggestProductEmoji } from '../../core/ai';
import { useInvalidateProducts, useWindowSize, useUsbScannerDetection, useProducts, useConfirmModal } from '../../hooks';
import { usePreferences } from '../../components/PreferencesContext';
import { useVirtualizer } from '@tanstack/react-virtual';
import { validateProductInput } from '../../core/schemas/product.schema';

// Extracted Components
import {
    ProductStats,
    ProductFilters,
    BulkActions,
    ProductListView,
    ProductGridView,
    ProductPagination,
    ProductFormModal,
    CategoryModal,
    ScannedProductModal
} from './components';

export const ProductsPage: React.FC = () => {
    const { notify, prefs } = usePreferences();
    const { t } = useTranslation();
    const invalidateProducts = useInvalidateProducts();

    // --- State ---
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(t('common.all'));
    const [selectedSupplier, setSelectedSupplier] = useState(t('common.all'));
    const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [page, setPage] = useState(0);
    const pageSize = 50;

    // Modals & Other State
    const [modalOpen, setModalOpen] = useState(false);
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
    const [scannerOpen, setScannerOpen] = useState(false);
    const { confirmState, openConfirm, closeConfirm } = useConfirmModal();
    const [importExportOpen, setImportExportOpen] = useState(false);

    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
    const [form, setForm] = useState<Partial<Product>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [catForm, setCatForm] = useState<Partial<CategoryDef>>({ name: '', fields: [] });
    const [newField, setNewField] = useState<{ name: string, type: 'text' | 'number' | 'select', options: string }>({ name: '', type: 'text', options: '' });
    const [editingCategory, setEditingCategory] = useState<CategoryDef | null>(null);
    const [scannedProduct, setScannedProduct] = useState<Product | null>(null);

    const [printQueue, setPrintQueue] = useState<{ product: Product; qty: number }[]>([]);

    const [_productHistory] = useState<unknown[]>([]); // Reserved for future API implementation

    // ── React Query data fetching ──────────────────────────────────────────────
    const { products: allProducts, isLoading: productsLoading, refetch: refetchProducts } = useProducts();
    const { data: categories = [], refetch: refetchCategories } = useQuery({
        queryKey: ['categories'],
        queryFn: () => api.categories.list(),
    });
    const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => api.suppliers.list(),
    });

    const loading = productsLoading;

    // Client-side filtering, pagination & stats computed from allProducts
    const { filteredProducts, totalRecords, stats } = useMemo(() => {
        let filtered = allProducts;

        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(q) || p.barcode.includes(q)
            );
        }
        if (selectedCategory !== t('common.all')) {
            filtered = filtered.filter(p => p.category === selectedCategory);
        }
        if (selectedSupplier !== t('common.all')) {
            filtered = filtered.filter(p => p.supplier === selectedSupplier);
        }
        if (statusFilter === 'low') {
            filtered = filtered.filter(p => p.stock <= p.minStock && p.stock > 0);
        } else if (statusFilter === 'out') {
            filtered = filtered.filter(p => p.stock <= 0);
        }

        const total = filtered.length;
        const start = page > 0 ? (page - 1) * pageSize : 0;
        const paginated = filtered.slice(start, start + pageSize);

        let totalStock = 0;
        let totalValue = 0;
        let totalCost = 0;
        filtered.forEach(p => {
            totalStock += p.stock;
            totalValue += p.price * p.stock;
            totalCost += p.cost * p.stock;
        });

        return {
            filteredProducts: paginated,
            totalRecords: total,
            stats: { totalStock, totalValue, totalCost, profit: totalValue - totalCost },
        };
    }, [allProducts, search, selectedCategory, selectedSupplier, statusFilter, page, pageSize, t]);

    // ═══════════════════════════════════════════════════════════════════════════════
    // 🔗 Pending Action Handler (from QuickActionsBar)
    // يتحقق من وجود إجراء معلق من لوحة التحكم ويفتح المودال المناسب
    // ═══════════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        const pendingAction = sessionStorage.getItem('pendingAction');
        if (pendingAction === 'openAddModal') {
            // مسح الإجراء المعلق حتى لا يتكرر
            sessionStorage.removeItem('pendingAction');
            // تأخير بسيط للتأكد من تحميل البيانات
            setTimeout(() => {
                handleInitAdd();
            }, 100);
        }
    }, []);

    const totalLabels = useMemo(() => printQueue.reduce((acc, item) => acc + item.qty, 0), [printQueue]);

    // --- Virtualization Logic ---
    const parentRef = React.useRef<HTMLDivElement>(null);
    const { width } = useWindowSize();

    const gridColumns = useMemo(() => {
        if (width >= 1024) return 5; // Fixed 5 columns for Desktop
        if (width >= 768) return 4;  // Tablet
        if (width >= 640) return 3;  // Large Mobile
        return 2;                    // Mobile
    }, [width]);

    const columns = viewMode === 'list' ? 1 : gridColumns;
    const rows = Math.ceil(filteredProducts.length / columns);

    const rowVirtualizer = useVirtualizer({
        count: rows,
        getScrollElement: () => parentRef.current,
        estimateSize: () => viewMode === 'list' ? 88 : 320,
        overscan: 5,
    });

    const isGrid = viewMode === 'grid';
    const virtualItems = rowVirtualizer.getVirtualItems();

    const activeCategoryDef = useMemo(() => {
        return categories.find(c => c.name === form.category);
    }, [form.category, categories]);

    // --- Handlers ---
    const handleScan = async (code: string): Promise<ScanResult> => {
        try {
            const searchResult = await api.products.search(code);
            const exists = searchResult?.find((p: Product) => p.barcode === code);

            if (exists) {
                setScannedProduct(exists);
                setScannerOpen(false);
                return { success: true, name: exists.name };
            } else {
                handleInitAdd();
                setTimeout(() => setForm(prev => ({ ...prev, barcode: code })), 50);
                setScannerOpen(false);
                return { success: true, message: t('products.addProduct') };
            }
        } catch (e) {
            console.error('Scan search error:', e);
            const exists = allProducts.find(p => p.barcode === code);
            if (exists) {
                setScannedProduct(exists);
                setScannerOpen(false);
                return { success: true, name: exists.name };
            } else {
                handleInitAdd();
                setTimeout(() => setForm(prev => ({ ...prev, barcode: code })), 50);
                setScannerOpen(false);
                return { success: true, message: t('products.addProduct') };
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // 📱 Mobile Scanner Integration
    // ═══════════════════════════════════════════════════════════════════════════════
    const handleScanRef = React.useRef(handleScan);
    useEffect(() => { handleScanRef.current = handleScan; }, [handleScan]);

    useEffect(() => {
        if (window.runtime) {
            window.runtime.EventsOff("remote-scan-received");
            window.runtime.EventsOn("remote-scan-received", (data: unknown) => {
                const scanData = data as { code?: string };
                if (scanData && scanData.code) {
                    // Call the latest handleScan via ref
                    handleScanRef.current(scanData.code as string).then(result => {
                        if (result.success) {
                            notify(result.message || `تم مسح: ${result.name}`, 'success');
                        }
                    });
                }
            });
        }
        return () => {
            if (window.runtime) window.runtime.EventsOff("remote-scan-received");
        };
    }, []);

    // USB Scanner Detection
    const { isUsbDetected, scanCount } = useUsbScannerDetection({
        onScan: (code) => handleScan(code),
        onUsbDetected: () => notify('تم اكتشاف قارئ USB ✅', 'success')
    });

    const handleInitAdd = () => {
        setForm({
            name: '', price: 0, cost: 0, stock: 0, minStock: 5, category: selectedCategory !== t('common.all') ? selectedCategory : 'عام',
            barcode: Math.floor(100000 + Math.random() * 900000).toString(), image: '📦', customDetails: {}
        });
        setEditingProduct(null); setActiveTab('details'); setModalOpen(true);
    };

    const handleInitEdit = (p: Product) => {
        setForm({ ...p, customDetails: p.customDetails || {} }); setEditingProduct(p); setActiveTab('details'); setModalOpen(true);
    };

    const handleDuplicate = (p: Product) => {
        setForm({ ...p, id: undefined, name: `${p.name} (نسخة)`, barcode: Math.floor(100000 + Math.random() * 900000).toString(), customDetails: p.customDetails || {} });
        setEditingProduct(null); setActiveTab('details'); setModalOpen(true);
    };

    const handleSave = async () => {
        const validation = validateProductInput(form);
        if (!validation.success) {
            const newErrors: Record<string, string> = {};
            validation.error.errors.forEach(err => { if (err.path[0]) newErrors[err.path[0] as string] = err.message; });
            setErrors(newErrors);
            // Notify the first specific error
            const firstErrorKey = Object.keys(newErrors)[0];
            const firstErrorMsg = newErrors[firstErrorKey];
            notify(firstErrorMsg ? `خطأ: ${firstErrorMsg}` : t('errors.required'), 'error');
            return;
        }
        setErrors({});

        try {
            const productImage: string = form.image || '📦';
            const productId: string = form.id || '';
            const p: Product = {
                id: productId,
                name: form.name || '',
                barcode: form.barcode || '',
                category: form.category || t('common.uncategorized'),
                supplier: form.supplier || '',
                description: form.description || '',
                customDetails: form.customDetails || {},
                price: Number(form.price),
                cost: Number(form.cost) || 0,
                stock: Number(form.stock) || 0,
                minStock: Number(form.minStock) || 5,
                wholesalePrice: Number(form.wholesalePrice) || 0,
                image: productImage
            };

            await api.products.save(p);
            notify(form.id ? t('products.productUpdated') : t('products.productAdded'), 'success');
            setModalOpen(false);
            invalidateProducts();
            refetchProducts();

            if (productImage === '📦' && form.name && !form.image?.startsWith('data')) {
                suggestProductEmoji(form.name, form.category).then(async (suggestedEmoji) => {
                    if (suggestedEmoji && suggestedEmoji !== '📦') {
                        const products = await api.products.search(form.barcode ?? '');
                        const savedProduct = products.find((prod: Product) => prod.barcode === form.barcode);
                        if (savedProduct) {
                            await api.products.save({ ...savedProduct, image: suggestedEmoji });
                            invalidateProducts();
                            refetchProducts();
                        }
                    }
                }).catch((_e) => { console.warn('Emoji AI error'); });
            }
        } catch (e: unknown) {
            console.error('Save failed', e);
            const msg = e instanceof Error ? e.message : String(e);
            notify(`فشل الحفظ: ${msg}`, 'error');
        }
    };

    const handleDelete = async (id: string) => {
        const performDelete = async (force: boolean) => {
            try {
                await api.products.delete(id, force);
                    notify(t('products.productDeleted'), 'success');
                    invalidateProducts();
                    refetchProducts();
                    closeConfirm();
            } catch (err: unknown) {
                // Try to parse the error as JSON (AppError)
                let appError: unknown = null;
                const errStr = String(err);
                try {
                    // Wails error usually comes as "Error: {...}" or just "{...}" if we return JSON string
                    // Sometimes it's wrapped in "Error: " prefix
                    const jsonPart = errStr.includes('{') ? errStr.substring(errStr.indexOf('{')) : errStr;
                    appError = JSON.parse(jsonPart);
                } catch (e) { /* Not JSON */ }

                // Check if it's an AppError with allowForce
                const appErr = appError as AppError | null;
                if (appErr?.options?.allowForce) {
                    // Show Force Delete Dialog
                    openConfirm({
                        title: 'تعذر الحذف - مطلوب تأكيد إضافي',
                        message: `${appErr.message}\n\n${appErr.hint || ''}`,
                        type: 'warning',
                        confirmText: 'حذف قسري (Force Delete)',
                        onConfirm: () => performDelete(true)
                    });
                    return;
                }

                notify(t('errors.deleteFailed'), 'error');
                closeConfirm();
            }
        };

        openConfirm({
            title: t('confirm.deleteTitle'),
            message: t('confirm.deleteMessage'),
            type: 'error',
            onConfirm: () => performDelete(false)
        });
    };

    const handleBulkDelete = async () => {
        openConfirm({
            title: 'حذف متعدد',
            message: `هل أنت متأكد من حذف ${selectedIds.length} منتجات؟ لا يمكن التراجع عن هذا الإجراء.`,
            type: 'error',
            onConfirm: async () => {
                try {
                    await Promise.all(selectedIds.map(id => api.products.delete(id)));
                    setSelectedIds([]);
                    notify('تم الحذف بنجاح', 'success');
                    invalidateProducts();
                    refetchProducts();
                } catch (_e) { notify('خطأ', 'error'); }
                closeConfirm();
            }
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const base64Raw = ev.target?.result as string;
                    const base64 = await compressImage(base64Raw);
                    setForm({ ...form, image: base64 });
                } catch (_err) { notify('فشل ضغط الصورة', 'error'); }
            };
            reader.readAsDataURL(file);
        }
    };

    const updateStock = async (p: Product, change: number) => {
        if (!p.id) return;
        const newStock = Math.max(0, p.stock + change);
        try {
            await api.products.save({ ...p, stock: newStock });
            await api.stock.log(p.id, p.name, change > 0 ? 'in' : 'out', Math.abs(change), 'تعديل سريع للمخزون');
            refetchProducts();
        } catch (_e) {
            refetchProducts();
        }
    };

    // --- AI HANDLERS ---
    const handleAiGenerateDescription = async () => {
        if (!form.name) { notify('اكتب اسم المنتج أولاً', 'error'); return; }
        setIsGenerating(true);
        const desc = await generateProductDescription(form.name, form.category || 'عام');
        setForm(prev => ({ ...prev, description: desc }));
        setIsGenerating(false);
    };

    const handleAiImproveName = (field: 'name' | 'description' = 'name') => {
        if (field === 'name') {
            if (!form.name) return;
            setIsGenerating(true);
            improveText(form.name).then(improved => {
                setForm(prev => ({ ...prev, name: improved }));
                setIsGenerating(false);
            });
        }
    };

    const handleAiSuggestPrice = async () => {
        if (!form.name || !form.cost) { notify('الاسم وسعر التكلفة مطلوبان للاقتراح', 'error'); return; }
        setIsGenerating(true);
        const priceStr = await suggestProductPrice(form.name, Number(form.cost));
        if (priceStr) setForm(prev => ({ ...prev, price: Number(priceStr) }));
        setIsGenerating(false);
    };

    // Category Management
    const handleSaveCategory = async () => {
        if (!catForm.name) return;
        try {
            const categoryToSave = { id: editingCategory?.id || catForm.name, name: catForm.name, fields: catForm.fields || [] } as Parameters<typeof api.categories.save>[0];
            await api.categories.save(categoryToSave);
            notify(editingCategory ? 'تم تحديث الفئة بنجاح' : 'تم إضافة الفئة بنجاح', 'success');
            refetchCategories(); refetchProducts(); setCategoryModalOpen(false); setEditingCategory(null); setCatForm({ name: '', fields: [] });
        } catch (_e) { notify('خطأ في حفظ الفئة', 'error'); }
    };

    const handleEditCategory = (cat: CategoryDef) => { setEditingCategory(cat); setCatForm({ name: cat.name, fields: cat.fields || [] }); };
    const handleDeleteCategory = (cat: CategoryDef) => {
        const performDelete = async (force: boolean) => {
            try {
                await api.categories.delete(cat.id, force);
                notify('تم حذف الفئة بنجاح', 'success');
                refetchCategories(); refetchProducts();
                closeConfirm();
                setCategoryModalOpen(false); // Also close manager modal if open
            } catch (err: unknown) {
                // Try to parse the error as JSON (AppError)
                let appError: unknown = null;
                const errStr = String(err);
                try {
                    const jsonPart = errStr.includes('{') ? errStr.substring(errStr.indexOf('{')) : errStr;
                    appError = JSON.parse(jsonPart);
                } catch (e) { /* Not JSON */ }

                // Check for allowForce option
                const appErr = appError as AppError | null;
                if (appErr?.options?.allowForce) {
                    openConfirm({
                        title: 'تعذر الحذف - مطلوب تأكيد إضافي',
                        message: `${appErr.message}\n\n${appErr.hint || ''}`,
                        type: 'warning',
                        confirmText: 'حذف قسري (Force Delete)',
                        onConfirm: () => performDelete(true)
                    });
                    return;
                }

                const errorMsg = appErr?.message || errStr || 'خطأ في حذف الفئة';
                notify(errorMsg, 'error');
                closeConfirm();
            }
        };

        openConfirm({
            title: 'حذف الفئة',
            message: `هل أنت متأكد من حذف فئة "${cat.name}"؟ منتجات هذه الفئة ستتحول إلى "غير مصنف".`,
            type: 'warning',
            confirmText: 'حذف',
            onConfirm: () => performDelete(false)
        });
    };

    const toggleSelect = (id: string) => { setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };

    // Print Queue Handlers
    const addToPrintQueue = (p: Product, qty: number) => {
        setPrintQueue(prev => {
            const existingIndex = prev.findIndex(item => item.product.id === p.id);
            if (existingIndex >= 0) { const newQueue = [...prev]; newQueue[existingIndex] = { ...newQueue[existingIndex], qty: newQueue[existingIndex].qty + qty }; return newQueue; }
            return [...prev, { product: p, qty }];
        });
        notify('تمت الإضافة لقائمة الطباعة', 'success');
    };

    const updateQueueQty = (index: number, newQty: number) => { setPrintQueue(prev => prev.map((item, i) => i === index ? { ...item, qty: Math.max(1, newQty) } : item)); };
    const removeFromQueue = (index: number) => { setPrintQueue(prev => prev.filter((_, i) => i !== index)); };

    // --- UI State ---
    const [showStats, setShowStats] = useState(false);

    // --- Loading State ---
    if (loading) return <LoadingState icon={Package} title={t('common.loading')} subtitle={t('common.loading')} />;

    return (
        <PageShell>
            <PageHeader title={t('products.title')} icon={Package} description={t('products.productDetails')} actions={
                <div className="flex gap-2 items-center">
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
                    <div className="w-px h-6 bg-border mx-1 hidden sm:block"></div>
                    <button onClick={() => setImportExportOpen(true)} className="px-3 py-2 bg-surface hover:bg-surface-hover text-text-main rounded-xl border border-border text-xs font-bold flex items-center gap-2 transition-all shadow-sm hover:scale-[1.02] active:scale-95 touch-target"><FileSpreadsheet size={16} /> <span className="hidden sm:inline">CSV</span></button>
                    <button onClick={() => setBarcodeModalOpen(true)} className="px-3 py-2 bg-surface hover:bg-surface-hover text-text-main rounded-xl border border-border text-xs font-bold flex items-center gap-2 transition-all shadow-sm hover:scale-[1.02] active:scale-95 touch-target"><Printer size={16} /> <span className="hidden sm:inline">{t('common.printBarcode')}</span> {totalLabels > 0 && <span className="bg-primary text-primary-fg px-1.5 rounded-md">{totalLabels}</span>}</button>
                    <button onClick={() => { setCatForm({ name: '', fields: [] }); setCategoryModalOpen(true); }} className="px-3 py-2 bg-surface hover:bg-surface-hover text-text-main rounded-xl border border-border text-xs font-bold flex items-center gap-2 transition-all shadow-sm hover:scale-[1.02] active:scale-95 touch-target"><Layers size={16} /> <span className="hidden sm:inline">{t('products.category')}</span></button>
                    <button onClick={handleInitAdd} className="bg-primary text-primary-fg hover:brightness-110 px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-[1.05] active:scale-95 text-xs border border-primary/20 touch-target"><Plus size={18} /> {t('products.addProduct')}</button>
                </div>
            }>
                <ProductFilters
                    search={search} onSearchChange={setSearch}
                    selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory}
                    selectedSupplier={selectedSupplier} onSupplierChange={setSelectedSupplier}
                    statusFilter={statusFilter} onStatusChange={setStatusFilter}
                    viewMode={viewMode} onViewModeChange={setViewMode}
                    categories={categories} suppliers={suppliers} onScanClick={() => setScannerOpen(true)}
                />
            </PageHeader>

            {showStats && <ProductStats totalRecords={totalRecords} stats={stats} currency={prefs.currency} />}

            <BulkActions selectedCount={selectedIds.length} onPrintSelected={() => { selectedIds.forEach(id => { const p = allProducts.find(prod => prod.id === id); if (p) addToPrintQueue(p, 1); }); setSelectedIds([]); }} onDeleteSelected={handleBulkDelete} onClearSelection={() => setSelectedIds([])} />

            <div ref={parentRef} className="flex-1 overflow-y-auto min-h-0 pr-1 pb-10 custom-scrollbar">
                {filteredProducts.length === 0 ? <EmptyState icon={Package} title={t('products.noProducts')} description={search ? t('common.noData') : t('products.addProduct')} action={!search && <button onClick={handleInitAdd} className="bg-surface hover:bg-surface-hover text-text-main px-5 py-2 rounded-xl border border-border text-sm font-bold">{t('products.addProduct')}</button>} /> : (
                    isGrid ? (
                        <ProductGridView
                            virtualItems={virtualItems} products={filteredProducts} columns={columns} selectedIds={selectedIds}
                            currency={prefs.currency} onToggleSelect={toggleSelect} onEditProduct={handleInitEdit}
                            onAddToPrintQueue={addToPrintQueue} rowVirtualizer={rowVirtualizer}
                        />
                    ) : (
                        <ProductListView
                            virtualItems={virtualItems} products={filteredProducts} selectedIds={selectedIds}
                            stats={stats} currency={prefs.currency} onToggleSelect={toggleSelect}
                            onEditProduct={handleInitEdit} onUpdateStock={updateStock} onAddToPrintQueue={addToPrintQueue}
                            onDeleteProduct={handleDelete} measureElement={rowVirtualizer.measureElement}
                            getTotalSize={rowVirtualizer.getTotalSize}
                        />
                    )
                )}
            </div>

            <ProductPagination page={page} pageSize={pageSize} totalRecords={totalRecords} currentCount={filteredProducts.length} onPageChange={setPage} />

            <ProductFormModal
                isOpen={modalOpen} onClose={() => setModalOpen(false)} editingProduct={editingProduct}
                form={form} setForm={setForm} activeTab={activeTab} setActiveTab={setActiveTab}
                categories={categories} suppliers={suppliers} errors={errors} isGenerating={isGenerating}
                prefs={prefs} productHistory={_productHistory as { id: string; qty: number; type: string; timestamp: string; reason?: string }[]} onSave={handleSave} onDelete={handleDelete}
                onDuplicate={handleDuplicate} onAiGenerateDescription={handleAiGenerateDescription}
                onAiSuggestPrice={handleAiSuggestPrice} onImageUpload={handleImageUpload}
                activeCategoryDef={activeCategoryDef} onImproveText={handleAiImproveName}
            />

            <CategoryModal
                isOpen={categoryModalOpen} onClose={() => { setCategoryModalOpen(false); setEditingCategory(null); setCatForm({ name: '', fields: [] }); }}
                editingCategory={editingCategory} categories={categories} catForm={catForm} setCatForm={setCatForm}
                newField={newField} setNewField={setNewField} onSaveCategory={handleSaveCategory}
                onEditCategory={handleEditCategory} onDeleteCategory={handleDeleteCategory}
                onCancelEdit={() => { setEditingCategory(null); setCatForm({ name: '', fields: [] }); }}
            />

            <ScannedProductModal
                scannedProduct={scannedProduct} onClose={() => setScannedProduct(null)} prefs={prefs}
                onInitEdit={handleInitEdit} onDelete={handleDelete} onDuplicate={handleDuplicate}
                onAddToPrintQueue={addToPrintQueue} onUpdateStock={updateStock} onSearch={setSearch}
                setScannedProduct={setScannedProduct} notify={notify}
            />

            {barcodeModalOpen && <BarcodeDesigner onClose={() => setBarcodeModalOpen(false)} queue={printQueue} onClearQueue={() => setPrintQueue([])} prefs={prefs} onRemoveFromQueue={removeFromQueue} onUpdateQueueQty={updateQueueQty} />}
            {scannerOpen && <BarcodeScannerOverlay onClose={() => setScannerOpen(false)} onScan={handleScan} />}

            <ConfirmModal
                isOpen={confirmState.open} title={confirmState.title} message={confirmState.message}
                type={confirmState.type} confirmText={confirmState.confirmText} onConfirm={confirmState.onConfirm}
                onCancel={closeConfirm}
            />

            <ImportExportModal
                isOpen={importExportOpen}
                onClose={() => setImportExportOpen(false)}
                notify={notify}
                onImportComplete={() => { refetchProducts(); refetchCategories(); refetchSuppliers(); }}
            />
        </PageShell>
    );
};
