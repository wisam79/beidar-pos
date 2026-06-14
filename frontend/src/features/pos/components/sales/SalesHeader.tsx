import React from 'react';
import { Search, MessageCircle, Usb, Camera, History, PauseCircle, User, Factory } from 'lucide-react';
import { Customer, Sale, Product } from '../../../../core/types';
import { Badge } from '../../../../components/ds/Badge';
import { Button } from '../../../../components/ds/Button';

type Category = { id: string; name: string };

export interface SalesHeaderProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchRef: React.RefObject<HTMLInputElement>;
    products: Product[];
    addToCart: (product: Product) => void;
    categories: Category[];
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    selectedCustomer: Customer | null;
    setShowCustomerModal: (show: boolean) => void;
    isUsbDetected: boolean;
    scanCount: number;
    setIsScannerOpen: (open: boolean) => void;
    parkedCount: number;
    openParkedModal: () => void;
    handleParkSale: () => void;
    cartLength: number;
    lastCompletedSale: Sale | null;
    sendToWhatsapp: (sale: Sale) => void;
    isWholesale: boolean;
    setIsWholesale: (v: boolean) => void;
    t: (key: string) => string;
}

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
        <div className="shrink-0 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                    <input
                        ref={searchRef}
                        className="h-12 w-full rounded-full border bg-input-bg px-12 py-3 text-sm font-black text-text-main outline-none transition focus:border-primary focus:shadow-[0_0_0_4px_var(--color-primary-dim)]"
                        placeholder="بحث باسم المنتج، الباركود..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            const found = products.find((p) => p.barcode === e.target.value);
                            if (found) {
                                addToCart(found);
                                setSearchQuery('');
                            }
                        }}
                    />
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {lastCompletedSale && (
                        <Button variant="soft" onClick={() => sendToWhatsapp(lastCompletedSale)} className="text-xs">
                            <MessageCircle size={16} /> إرسال الفاتورة
                        </Button>
                    )}
                    {isUsbDetected ? (
                        <Badge variant="success">
                            <Usb size={14} />
                            <span className="hidden sm:inline">قارئ USB</span>
                            <span className="rounded-full bg-white/30 px-1.5 py-0.5">{scanCount}</span>
                        </Badge>
                    ) : (
                        <Button variant="soft" onClick={() => setIsScannerOpen(true)} className="text-xs">
                            <Camera size={16} /> كاميرا
                        </Button>
                    )}
                    {isUsbDetected && (
                        <Button variant="icon" onClick={() => setIsScannerOpen(true)} title="فتح الكاميرا (اختياري)">
                            <Camera size={16} />
                        </Button>
                    )}
                    <Button variant="soft" onClick={openParkedModal} className="relative text-xs">
                        <History size={16} /> تعليق
                        {parkedCount > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-black text-white">
                                {parkedCount > 9 ? '9+' : parkedCount}
                            </span>
                        )}
                    </Button>
                    <Button variant="soft" onClick={handleParkSale} disabled={!cartLength} className="text-xs">
                        <PauseCircle size={16} /> تعليق
                    </Button>
                    <Button variant={isWholesale ? 'primary' : 'secondary'} onClick={() => setIsWholesale(!isWholesale)} className="text-xs">
                        <Factory size={16} /> <span className="hidden sm:inline">جملة</span>
                    </Button>
                    <div className="h-8 w-px bg-border" />
                    <Button variant={selectedCustomer ? 'soft' : 'secondary'} onClick={() => setShowCustomerModal(true)} className="text-xs">
                        <User size={16} /> {selectedCustomer ? selectedCustomer.name : t('sales.walkInCustomer')}
                    </Button>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar select-none">
                <button
                    type="button"
                    onClick={() => setSelectedCategory(t('common.all'))}
                    className={`h-10 whitespace-nowrap rounded-full border px-5 text-xs font-black transition active:scale-[0.98] ${selectedCategory === t('common.all') ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface text-text-muted hover:bg-surface-hover hover:text-text-main'}`}
                >
                    {t('common.all')}
                </button>
                {categories.map((category) => (
                    <button
                        key={category.id || category.name}
                        type="button"
                        onClick={() => setSelectedCategory(category.name)}
                        className={`h-10 whitespace-nowrap rounded-full border px-5 text-xs font-black transition active:scale-[0.98] ${selectedCategory === category.name ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface text-text-muted hover:bg-surface-hover hover:text-text-main'}`}
                    >
                        {category.name}
                    </button>
                ))}
            </div>
        </div>
    );
};
