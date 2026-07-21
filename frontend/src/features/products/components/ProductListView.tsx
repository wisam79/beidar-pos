/**
 * ProductListView - Virtualized list/table view for products
 */
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, Printer, Trash2 } from 'lucide-react';
import { Product } from '../../../core/types';
import { formatCurrency } from '../../../core/utils';
import { Badge } from '../../../components/ui';
import { VirtualItem } from '@tanstack/react-virtual';

interface ProductListViewProps {
    virtualItems: VirtualItem[];
    products: Product[];
    selectedIds: string[];
    stats: { totalValue: number };
    currency: string;
    onToggleSelect: (id: string) => void;
    onEditProduct: (product: Product) => void;
    onUpdateStock: (product: Product, change: number) => void;
    onAddToPrintQueue: (product: Product, qty: number) => void;
    onDeleteProduct: (id: string) => void;
    measureElement: (node: Element | null) => void;
    getTotalSize: () => number;
}

const getABCClass = (val: number, total: number): 'A' | 'B' | 'C' => {
    if (total === 0) return 'C';
    const share = (val / total) * 100;
    return share > 1 ? 'A' : share > 0.5 ? 'B' : 'C';
};

// Helper for resolving image path
const resolveImage = (img: string | undefined) => {
    if (!img) return null;
    if (img.startsWith('data') || img.startsWith('http')) return img;
    if (img.includes('.')) return `/local-image/${img}`;
    return null;
};

export const ProductListView = memo(({
    virtualItems,
    products,
    selectedIds,
    stats,
    currency,
    onToggleSelect,
    onEditProduct,
    onUpdateStock,
    onAddToPrintQueue,
    onDeleteProduct,
    measureElement,
    getTotalSize
}: ProductListViewProps) => {
    const { t } = useTranslation();

    return (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
            <table className="w-full text-right text-sm border-collapse">
                <thead>
                    <tr className="bg-surface-hover border-b border-border text-text-muted text-xs">
                        <th className="w-[60px] text-right">#</th>
                        <th className="text-right">{t('products.name')}</th>
                        <th className="text-right">{t('products.category')}</th>
                        <th className="text-center w-[80px]">ABC</th>
                        <th className="text-left w-[120px]">{t('products.price')}</th>
                        <th className="text-center w-[120px]">{t('products.stock')}</th>
                        <th className="text-center w-[100px]">الحالة</th>
                        <th className="text-center w-[100px]">{t('common.actions')}</th>
                    </tr>
                </thead>
                <tbody>
                    {virtualItems.length > 0 && <tr style={{ height: `${virtualItems[0].start}px` }}><td colSpan={8} /></tr>}
                    {virtualItems.map((virtualRow) => {
                        const p = products[virtualRow.index];
                        if (!p) return null;
                        const productVal = p.stock * p.price;
                        const abcClass = getABCClass(productVal, stats.totalValue);
                        return (
                            <tr
                                key={p.id}
                                data-index={virtualRow.index}
                                ref={measureElement}
                                className={`border-b border-border/30 hover:bg-surface-hover transition-colors cursor-pointer group ${p.id && selectedIds.includes(p.id) ? 'bg-primary/5' : ''}`}
                                onClick={() => onEditProduct(p)}
                            >
                                <td className="text-right" onClick={e => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={p.id ? selectedIds.includes(p.id) : false}
                                        onChange={() => p.id && onToggleSelect(p.id)}
                                        className="w-4 h-4 rounded accent-primary cursor-pointer"
                                        aria-label="تحديد المنتج"
                                    />
                                </td>
                                <td className="text-right">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center overflow-hidden shrink-0 text-xl shadow-inner">
                                            {resolveImage(p.image) ? (
                                                <img src={resolveImage(p.image) || ''} className="w-full h-full object-cover" alt={p.name} />
                                            ) : (
                                                p.image
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-text-main text-xs group-hover:text-primary transition-colors">{p.name}</p>
                                            <p className="text-[10px] text-text-muted font-mono">{p.barcode}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="text-right text-xs font-bold text-text-muted">
                                    {p.category}<br /><span className="text-[9px] opacity-70 font-normal">{p.supplier}</span>
                                </td>
                                <td className="text-center">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black font-mono border ${abcClass === 'A' ? 'bg-success/10 text-success border-success/20' : abcClass === 'B' ? 'bg-info/10 text-info border-info/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
                                        {abcClass}
                                    </span>
                                </td>
                                <td className="text-left">
                                    <div className="flex flex-col">
                                        <span className="font-mono font-bold text-text-main">{formatCurrency(p.price, currency).replace(currency, '')}</span>
                                        {p.cost > 0 && (
                                            <span className="text-[9px] text-success font-bold">
                                                {((p.price - p.cost) / p.cost * 100).toFixed(0)}% هامش
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-center">
                                    <div className="flex items-center justify-center gap-1 bg-bg rounded-lg p-1 w-fit mx-auto border border-border opacity-70 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
                                        <button aria-label="إنقاص المخزون" onClick={() => onUpdateStock(p, -1)} className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"><Minus size={12} /></button>
                                        <span className="font-mono font-bold w-8 text-center text-xs">{p.stock}</span>
                                        <button aria-label="زيادة المخزون" onClick={() => onUpdateStock(p, 1)} className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-success hover:bg-success/10 rounded transition-colors"><Plus size={12} /></button>
                                    </div>
                                </td>
                                <td className="text-center">
                                    <Badge type={p.stock === 0 ? 'error' : p.stock <= (p.minStock || 5) ? 'warning' : 'success'} text={p.stock === 0 ? 'نافذ' : p.stock <= (p.minStock || 5) ? 'منخفض' : 'متوفر'} />
                                </td>
                                <td className="text-center">
                                    <div className="flex justify-center gap-2">
                                        <button aria-label="طباعة الباركود" onClick={(e) => { e.stopPropagation(); onAddToPrintQueue(p, 1); }} className="p-1.5 hover:bg-surface-active rounded-lg text-text-muted hover:text-text-main transition-colors"><Printer size={14} /></button>
                                        <button aria-label="حذف المنتج" onClick={(e) => { e.stopPropagation(); if (p.id) onDeleteProduct(p.id); }} className="p-1.5 hover:bg-danger/10 rounded-lg text-text-muted hover:text-danger transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {virtualItems.length > 0 && <tr style={{ height: `${getTotalSize() - virtualItems[virtualItems.length - 1].end}px` }}><td colSpan={8} /></tr>}
                </tbody>
            </table>
        </div>
    );
});

ProductListView.displayName = 'ProductListView';
