/**
 * SalesHeader - Search bar, scanner controls, and category filters
 * Extracted from Sales.tsx for better maintainability
 */

import React from 'react';
import { Search, MessageCircle, Usb, Camera, History, PauseCircle, User, Factory } from 'lucide-react';
import { Customer, Sale, Product } from '../../../../core/types';

// Category type (matches useProducts hook return type)
type Category = { id: string; name: string };

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface SalesHeaderProps {
    // Search
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchRef: React.RefObject<HTMLInputElement>;
    products: Product[];
    addToCart: (product: Product) => void;

    // Categories
    categories: Category[];
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;

    // Customer
    selectedCustomer: Customer | null;
    setShowCustomerModal: (show: boolean) => void;

    // Scanner
    isUsbDetected: boolean;
    scanCount: number;
    setIsScannerOpen: (open: boolean) => void;

    // Parked Sales
    parkedCount: number;
    openParkedModal: () => void;
    handleParkSale: () => void;
    cartLength: number;

    // WhatsApp
    lastCompletedSale: Sale | null;
    sendToWhatsapp: (sale: Sale) => void;

    // Wholesale
    isWholesale: boolean;
    setIsWholesale: (v: boolean) => void;

    // Translation
    t: (key: string) => string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export const SalesHeader: React.FC<SalesHeaderProps> = ({
    searchQuery,
    setSearchQuery,
    searchRef,
    products,
    addToCart,
    categories,
    selectedCategory,
    setSelectedCategory,
    selectedCustomer,
    setShowCustomerModal,
    isUsbDetected,
    scanCount,
    setIsScannerOpen,
    parkedCount,
    openParkedModal,
    handleParkSale,
    cartLength,
    lastCompletedSale,
    sendToWhatsapp,
    isWholesale,
    setIsWholesale,
    t,
}) => {
    return (
        <div className="flex flex-col gap-3 shrink-0">
            {/* Top Bar: Search, Scanner, Customer */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative group flex-1">
                    <input
                        ref={searchRef}
                        className="w-full bg-input-bg text-text-main border border-border rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary transition-all text-sm font-bold placeholder:text-text-muted focus:shadow-glow"
                        placeholder="بحث باسم المنتج، الباركود..."
                        value={searchQuery}
                        onChange={e => {
                            setSearchQuery(e.target.value);
                            // Auto-add if barcode found (Exact Match)
                            const found = products.find(p => p.barcode === e.target.value);
                            if (found) {
                                addToCart(found);
                                setSearchQuery('');
                            }
                        }}
                    />
                    <Search className="absolute left-3.5 top-3 text-text-muted group-hover:text-primary transition-colors" size={18} />
                </div>

                <div className="flex gap-2 shrink-0">
                    {/* WhatsApp Button */}
                    {lastCompletedSale && (
                        <button
                            onClick={() => sendToWhatsapp(lastCompletedSale)}
                            className="px-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl font-bold flex items-center gap-2 hover:bg-green-500 hover:text-white transition-all active:scale-95 text-xs animate-in zoom-in slide-in-from-right-5 fade-in duration-300"
                        >
                            <MessageCircle size={18} /> إرسال الفاتورة
                        </button>
                    )}

                    {/* USB Scanner Status Indicator */}
                    {isUsbDetected && (
                        <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
                            <Usb size={16} />
                            <span className="hidden sm:inline">قارئ USB</span>
                            <span className="bg-emerald-500/20 px-1.5 py-0.5 rounded text-[10px]">{scanCount}</span>
                        </div>
                    )}

                    {/* Camera Scanner Button - Only show if USB not detected */}
                    {!isUsbDetected && (
                        <button
                            onClick={() => setIsScannerOpen(true)}
                            className="px-4 bg-purple-500/10 border border-purple-500/20 text-purple-500 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-500 hover:text-white transition-all active:scale-95 text-xs"
                        >
                            <Camera size={18} /> كاميرا
                        </button>
                    )}

                    {/* Optional: Force Camera Button (small) when USB is detected */}
                    {isUsbDetected && (
                        <button
                            onClick={() => setIsScannerOpen(true)}
                            className="p-2 bg-surface border border-border text-text-muted rounded-xl hover:text-purple-500 hover:border-purple-500/50 transition-all"
                            title="فتح الكاميرا (اختياري)"
                        >
                            <Camera size={16} />
                        </button>
                    )}

                    {/* Parked Sales */}
                    <button
                        onClick={openParkedModal}
                        className="px-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-500 hover:text-white transition-all active:scale-95 text-xs relative"
                    >
                        <History size={18} />
                        {parkedCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold animate-pulse">
                                {parkedCount}
                            </span>
                        )}
                    </button>

                    {/* Park Current Sale */}
                    <button
                        onClick={handleParkSale}
                        disabled={!cartLength}
                        className="px-4 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-500 hover:text-white transition-all active:scale-95 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        title="تعليق الفاتورة الحالية"
                    >
                        <PauseCircle size={18} />
                        تعليق
                    </button>

                    {/* Wholesale Toggle */}
                    <button
                        onClick={() => setIsWholesale(!isWholesale)}
                        className={`px-4 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 text-xs border ${isWholesale ? 'bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-500/30' : 'bg-surface text-text-muted border-border hover:bg-surface-hover hover:text-text-main'}`}
                        title="تبديل وضع الجملة"
                    >
                        <Factory size={18} />
                        <span className="hidden sm:inline">جملة</span>
                    </button>

                    <div className="w-px h-10 bg-border mx-1"></div>

                    {/* Customer Selector */}
                    <button
                        onClick={() => setShowCustomerModal(true)}
                        className={`px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${selectedCustomer ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface text-text-muted border-border hover:text-text-main'}`}
                    >
                        <User size={18} /> {selectedCustomer ? selectedCustomer.name : t('sales.walkInCustomer')}
                    </button>
                </div>
            </div>

            {/* Categories - Horizontal Chips */}
            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 select-none">
                <button
                    onClick={() => setSelectedCategory(t('common.all'))}
                    className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${selectedCategory === t('common.all') ? 'bg-primary text-primary-fg border-primary shadow-lg shadow-primary/20' : 'bg-surface text-text-muted border-border hover:text-text-main hover:bg-surface-hover'}`}
                >
                    {t('common.all')}
                </button>
                {categories.map(c => (
                    <button
                        key={c.id || c.name}
                        onClick={() => setSelectedCategory(c.name)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${selectedCategory === c.name ? 'bg-primary text-primary-fg border-primary shadow-lg shadow-primary/20' : 'bg-surface text-text-muted border-border hover:text-text-main hover:bg-surface-hover'}`}
                    >
                        {c.name}
                    </button>
                ))}
            </div>
        </div>
    );
};
