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
        <div className="bg-surface border-t border-t-white/30 dark:border-t-white/10 border-x border-x-border/60 border-b-[3px] border-b-black/60 dark:border-b-black/80 rounded-3xl overflow-hidden shadow-lg select-none">
            <table className="w-full text-right text-sm border-collapse">
                <thead>
                    <tr className="bg-surface-hover/90 border-b border-border/80 text-text-muted text-xs min-h-[48px]">
                        <th className="w-[60px] text-right py-3.5 pr-4">#</th>
                        <th className="text-right py-3.5">{t('products.name')}</th>
                        <th className="text-right py-3.5">{t('products.category')}</th>
                        <th className="text-center w-[80px] py-3.5">ABC</th>
                        <th className="text-left w-[130px] py-3.5">{t('products.price')}</th>
                        <th className="text-center w-[130px] py-3.5">{t('products.stock')}</th>
                        <th className="text-center w-[100px] py-3.5">الحالة</th>
                        <th className="text-center w-[110px] py-3.5 pl-4">{t('common.actions')}</th>
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
                                className={`border-b border-border/30 hover:bg-surface-hover/80 transition-colors cursor-pointer group h-[64px] ${p.id && selectedIds.includes(p.id) ? 'bg-emerald-500/10' : ''}`}
                                onClick={() => onEditProduct(p)}
                            >
                                <td className="text-right pr-4" onClick={e => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={p.id ? selectedIds.includes(p.id) : false}
                                        onChange={() => p.id && onToggleSelect(p.id)}
                                        className="w-5 h-5 rounded-lg accent-emerald-500 cursor-pointer touch-target"
                                        aria-label="تحديد المنتج"
                                    />
                                </td>
                                <td className="text-right py-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-xl bg-surface-hover border border-border/50 flex items-center justify-center overflow-hidden shrink-0 text-xl shadow-inner">
                                            {resolveImage(p.image) ? (
                                                <img src={resolveImage(p.image) || ''} className="w-full h-full object-cover" alt={p.name} />
                                            ) : (
                                                <span className="font-black text-emerald-400">{p.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-extrabold text-text-main text-sm group-hover:text-emerald-400 transition-colors">{p.name}</p>
                                            <p className="text-[11px] text-text-muted font-mono">{p.barcode}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="text-right text-xs font-extrabold text-text-muted py-2">
                                    {p.category}<br /><span className="text-[10px] opacity-70 font-semibold">{p.supplier}</span>
                                </td>
                                <td className="text-center py-2">
                                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black font-mono border ${abcClass === 'A' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : abcClass === 'B' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                                        {abcClass}
                                    </span>
                                </td>
                                <td className="text-left py-2">
                                    <div className="flex flex-col">
                                        <span className="font-mono font-black text-sm text-emerald-400">{formatCurrency(p.price, currency).replace(currency, '')}</span>
                                        {p.cost > 0 && (
                                            <span className="text-[10px] text-emerald-400/90 font-extrabold">
                                                {((p.price - p.cost) / p.cost * 100).toFixed(0)}% هامش
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-center py-2">
                                    <div className="flex items-center justify-center gap-1.5 bg-surface-hover rounded-xl p-1 w-fit mx-auto border border-border/60 shadow-inner" onClick={e => e.stopPropagation()}>
                                        <button aria-label="إنقاص المخزون" onClick={() => onUpdateStock(p, -1)} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors touch-target"><Minus size={14} strokeWidth={2.5} /></button>
                                        <span className="font-mono font-black w-8 text-center text-sm text-text-main">{p.stock}</span>
                                        <button aria-label="زيادة المخزون" onClick={() => onUpdateStock(p, 1)} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors touch-target"><Plus size={14} strokeWidth={2.5} /></button>
                                    </div>
                                </td>
                                <td className="text-center py-2">
                                    <Badge type={p.stock === 0 ? 'error' : p.stock <= (p.minStock || 5) ? 'warning' : 'success'} text={p.stock === 0 ? 'نافذ' : p.stock <= (p.minStock || 5) ? 'منخفض' : 'متوفر'} />
                                </td>
                                <td className="text-center py-2 pl-4">
                                    <div className="flex justify-center gap-1.5">
                                        <button aria-label="طباعة الباركود" onClick={(e) => { e.stopPropagation(); onAddToPrintQueue(p, 1); }} className="w-9 h-9 flex items-center justify-center hover:bg-surface-hover rounded-xl text-text-muted hover:text-emerald-400 border border-transparent hover:border-border/60 transition-colors touch-target"><Printer size={16} /></button>
                                        <button aria-label="حذف المنتج" onClick={(e) => { e.stopPropagation(); if (p.id) onDeleteProduct(p.id); }} className="w-9 h-9 flex items-center justify-center hover:bg-red-500/10 rounded-xl text-text-muted hover:text-red-400 border border-transparent hover:border-red-500/20 transition-colors touch-target"><Trash2 size={16} /></button>
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
