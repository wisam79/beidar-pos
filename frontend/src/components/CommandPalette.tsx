
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ShoppingCart, Package, Sparkles, LayoutGrid, Archive, Receipt, Users, Landmark, BarChart, Settings, ArrowRight, CornerDownLeft, Loader2, LucideIcon } from 'lucide-react';
import { formatCurrency } from '../core/utils';
import { Product, View } from '../core/types';
import { api } from '../core/api';

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (view: View) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const debouncedQuery = useDebounce(query, 300);

    // Static Actions (pages)
    const pages: { id: View; l: string; i: LucideIcon; cat: string }[] = [
        { id: 'dashboard', l: 'لوحة التحكم', i: LayoutGrid, cat: 'الصفحات' },
        { id: 'sales', l: 'نقطة البيع', i: ShoppingCart, cat: 'الصفحات' },
        { id: 'products', l: 'المنتجات', i: Package, cat: 'الصفحات' },
        { id: 'inventory', l: 'المخزون', i: Archive, cat: 'الصفحات' },
        { id: 'invoices', l: 'الفواتير', i: Receipt, cat: 'الصفحات' },
        { id: 'customers', l: 'العملاء', i: Users, cat: 'الصفحات' },
        { id: 'finance', l: 'المالية', i: Landmark, cat: 'الصفحات' },
        { id: 'reports', l: 'التقارير', i: BarChart, cat: 'الصفحات' },
        { id: 'settings', l: 'الإعدادات', i: Settings, cat: 'إجراءات' },
    ];

    const filteredPages = pages.filter(p => p.l.includes(query));

    // Fetch products from API when debounced query changes
    useEffect(() => {
        if (!isOpen) return;
        if (debouncedQuery.length < 2) {
            setProducts([]);
            return;
        }

        const fetchProducts = async () => {
            setIsLoading(true);
            try {
                const response = await api.products.list(1, 5, debouncedQuery, '', '', 'all');
                setProducts(response.data || []);
            } catch (e) {
                console.error('CommandPalette search error', e);
                setProducts([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProducts();
    }, [debouncedQuery, isOpen]);

    // Reset state when palette opens/closes
    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setProducts([]);
            setSelectedIndex(0);
        }
    }, [isOpen]);

    const allResults = [...filteredPages, ...products.map((p: Product) => ({ ...p, type: 'product' }))];

    // Reset selection on query change
    useEffect(() => { setSelectedIndex(0); }, [query]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const selected = allResults[selectedIndex];
                if (selected) {
                    if ('type' in selected) {
                        onNavigate('products');
                    } else {
                        onNavigate((selected as (typeof pages)[number]).id);
                    }
                    onClose();
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, allResults, selectedIndex, onNavigate, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/70  flex items-start justify-center pt-[15vh] animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="w-full max-w-2xl bg-surface  border border-border rounded-2xl overflow-hidden flex flex-col ring-1 ring-white/5 animate-scale-in"
                style={{ boxShadow: 'var(--shadow-xl)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Search Header */}
                <div className="flex items-center px-5 py-4 border-b border-white/5 gap-3 relative">
                    {isLoading ? (
                        <Loader2 className="text-primary animate-spin" size={22} />
                    ) : (
                        <Search className="text-primary" size={22} />
                    )}
                    <input
                        autoFocus
                        className="flex-1 bg-transparent outline-none text-text-main font-bold h-8 placeholder:text-text-muted text-lg"
                        placeholder="ابحث عن أي شيء..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                        <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded-lg border border-border bg-surface px-2 font-mono text-[10px] font-bold text-text-muted">ESC</kbd>
                    </div>
                </div>

                {/* Results List */}
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
                    {allResults.length === 0 && query.length > 1 ? (
                        <div className="py-12 text-center text-gray-500 text-sm">
                            <p>لا توجد نتائج مطابقة لـ "{query}"</p>
                        </div>
                    ) : query.length < 2 && products.length === 0 ? (
                        <div className="py-12 text-center text-gray-500 text-sm">
                            <p>اكتب حرفين على الأقل للبحث عن المنتجات</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {/* Pages */}
                            {filteredPages.length > 0 && (
                                <div className="mb-2">
                                    <p className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">التنقل</p>
                                    {filteredPages.map((page, idx) => (
                                        <button
                                            key={page.id}
                                            onClick={() => { onNavigate(page.id); onClose(); }}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-right group ${selectedIndex === idx ? 'bg-primary text-primary-fg shadow-glow' : 'hover:bg-white/5 text-gray-300'}`}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                        >
                                            <page.i size={18} className={`${selectedIndex === idx ? 'text-black' : 'text-gray-500'}`} />
                                            <span className="text-sm font-bold flex-1">{page.l}</span>
                                            {selectedIndex === idx && <CornerDownLeft size={14} className="opacity-50" />}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Products */}
                            {products.length > 0 && (
                                <div>
                                    <p className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">المنتجات</p>
                                    {products.map((p: Product, idx: number) => {
                                        const globalIdx = filteredPages.length + idx;
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => { onNavigate('products'); onClose(); }}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-right group ${selectedIndex === globalIdx ? 'bg-primary text-primary-fg shadow-glow' : 'hover:bg-white/5 text-gray-300'}`}
                                                onMouseEnter={() => setSelectedIndex(globalIdx)}
                                            >
                                                <Package size={18} className={`${selectedIndex === globalIdx ? 'text-black' : 'text-gray-500'}`} />
                                                <span className="text-sm font-bold flex-1 truncate">{p.name}</span>
                                                <span className={`text-xs font-mono ${selectedIndex === globalIdx ? 'text-black/70' : 'text-gray-500'}`}>{formatCurrency(p.price)}</span>
                                                {selectedIndex === globalIdx && <CornerDownLeft size={14} className="opacity-50" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-white/5 bg-black/20 flex justify-between items-center text-[10px] text-gray-500">
                    <div className="flex gap-3">
                        <span className="flex items-center gap-1"><kbd className="bg-white/10 px-1 rounded">↓</kbd> للتنقل</span>
                        <span className="flex items-center gap-1"><kbd className="bg-white/10 px-1 rounded">↵</kbd> للاختيار</span>
                    </div>
                    <span>Beidar OS 1.2</span>
                </div>
            </div>
        </div>,
        document.body
    );
};
