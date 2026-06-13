/**
 * ProductFilters - Search, filter, and view mode controls for products
 */
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ScanLine, LayoutGrid, List as ListIcon } from 'lucide-react';
import { CategoryDef } from '../../../core/types';

interface ProductFiltersProps {
    search: string;
    onSearchChange: (value: string) => void;
    selectedCategory: string;
    onCategoryChange: (value: string) => void;
    selectedSupplier: string;
    onSupplierChange: (value: string) => void;
    statusFilter: 'all' | 'low' | 'out';
    onStatusChange: (value: 'all' | 'low' | 'out') => void;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
    categories: CategoryDef[];
    suppliers: { id: string; companyName: string }[];
    onScanClick: () => void;
}

export const ProductFilters = memo(({
    search,
    onSearchChange,
    selectedCategory,
    onCategoryChange,
    selectedSupplier,
    onSupplierChange,
    statusFilter,
    onStatusChange,
    viewMode,
    onViewModeChange,
    categories,
    suppliers,
    onScanClick
}: ProductFiltersProps) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col xl:flex-row gap-2 items-center bg-surface border border-border p-1 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="relative group w-full xl:w-auto xl:flex-1">
                <input
                    className="w-full bg-input-bg text-text-main border border-border rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-primary transition-all text-sm font-bold placeholder:text-text-muted focus:shadow-[0_0_15px_var(--color-primary-dim)]"
                    placeholder={t('common.searchPlaceholder')}
                    value={search}
                    onChange={e => onSearchChange(e.target.value)}
                />
                <Search className="absolute left-3 top-2.5 text-text-muted group-hover:text-primary transition-colors" size={16} />
            </div>

            <div className="flex gap-1.5 w-full xl:w-auto overflow-x-auto custom-scrollbar pb-1 xl:pb-0 items-center justify-between xl:justify-start">
                <button
                    onClick={onScanClick}
                    title={t('common.scanBarcode')}
                    className="p-2.5 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 text-purple-500 dark:text-purple-300 rounded-xl font-bold flex items-center gap-2 hover:from-purple-500/20 hover:to-blue-500/20 transition-all shadow-sm active:scale-95 shrink-0"
                >
                    <ScanLine size={18} />
                    <span className="hidden sm:inline text-xs">{t('common.scanBarcode')}</span>
                </button>

                <div className="w-px h-6 bg-border mx-0.5 shrink-0"></div>

                <select
                    aria-label="فلترة حسب الفئة"
                    className="bg-input-bg border border-border text-text-main text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-pointer focus:border-primary transition-all appearance-none min-w-[100px]"
                    value={selectedCategory}
                    onChange={e => onCategoryChange(e.target.value)}
                >
                    <option value="الكل">جميع الفئات</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <select
                    aria-label="فلترة حسب المورد"
                    className="bg-input-bg border border-border text-text-main text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-pointer focus:border-primary transition-all appearance-none min-w-[100px]"
                    value={selectedSupplier}
                    onChange={e => onSupplierChange(e.target.value)}
                >
                    <option value="الكل">جميع الموردين</option>
                    {suppliers.map(s => <option key={s.id} value={s.companyName}>{s.companyName}</option>)}
                </select>
                <select
                    aria-label="فلترة حسب الحالة"
                    className="bg-input-bg border border-border text-text-main text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-pointer focus:border-primary transition-all appearance-none min-w-[100px]"
                    value={statusFilter}
                    onChange={e => onStatusChange(e.target.value as 'all' | 'low' | 'out')}
                >
                    <option value="all">{t('common.allStatuses')}</option>
                    <option value="low">{t('products.lowStock')}</option>
                    <option value="out">{t('products.outOfStock')}</option>
                </select>
                <div className="flex bg-input-bg p-0.5 rounded-xl border border-border shrink-0">
                    <button
                        aria-label="عرض شبكي"
                        onClick={() => onViewModeChange('grid')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-surface shadow-sm text-text-main' : 'text-text-muted hover:text-text-main'}`}
                    >
                        <LayoutGrid size={16} />
                    </button>
                    <button
                        aria-label="عرض قائمة"
                        onClick={() => onViewModeChange('list')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-surface shadow-sm text-text-main' : 'text-text-muted hover:text-text-main'}`}
                    >
                        <ListIcon size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
});

ProductFilters.displayName = 'ProductFilters';
