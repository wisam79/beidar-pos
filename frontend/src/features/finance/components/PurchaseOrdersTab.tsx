import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Search, Trash2, Check, X, DollarSign, Eye, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../../../core/utils';
import { Modal, Badge, EmptyState, SpotlightCard } from '../../../components/ui';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { api, PurchaseOrder, PurchaseOrderItem, ReceiveOrderItem, Supplier, Product } from '../../../core/api';
import { useConfirmModal, usePurchaseOrders, useInventoryProducts } from '../../../hooks';

interface PurchaseOrdersTabProps {
    notify: (msg: string, type: 'success' | 'error') => void;
    currency?: string;
    suppliers: Supplier[];
    onRefresh: () => void;
}

export const PurchaseOrdersTab: React.FC<PurchaseOrdersTabProps> = ({ notify, currency, suppliers, onRefresh }) => {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    
    const { data: orders = [], isLoading: loading, refetch: loadOrders } = usePurchaseOrders(statusFilter === 'all' ? '' : statusFilter);
    const { data: productsData } = useInventoryProducts(0, 1000, '', 'all', 'all', 'all');
    const products = productsData?.products || [];

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    // Create Order Form
    const [createForm, setCreateForm] = useState<{
        supplierId: string;
        note: string;
        items: { productId: string; productName: string; quantity: number; unitCost: number }[];
    }>({ supplierId: '', note: '', items: [] });

    // Products for selection
    const [productSearch, setProductSearch] = useState('');

    // Receive form
    const [receiveItems, setReceiveItems] = useState<ReceiveOrderItem[]>([]);

    // Pay form
    const [payAmount, setPayAmount] = useState(0);
    const [payMethod, setPayMethod] = useState('cash');

    // Confirm modal
    const { confirmState, openConfirm, closeConfirm } = useConfirmModal();

    // Filter orders
    const filteredOrders = useMemo(() => {
        return orders.filter(o =>
            o.id?.toLowerCase().includes(search.toLowerCase()) ||
            o.supplierName?.toLowerCase().includes(search.toLowerCase())
        );
    }, [orders, search]);

    // Stats
    const stats = useMemo(() => {
        const pending = orders.filter(o => o.status === 'pending' || o.status === 'partial').length;
        const totalValue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const totalUnpaid = orders.reduce((sum, o) => sum + ((o.totalAmount || 0) - (o.paidAmount || 0)), 0);
        return { pending, totalValue, totalUnpaid };
    }, [orders]);

    // Create Order
    const handleCreateOrder = async () => {
        if (!createForm.supplierId) { notify('يرجى اختيار المورد', 'error'); return; }
        if (createForm.items.length === 0) { notify('يرجى إضافة منتج واحد على الأقل', 'error'); return; }

        try {
            const order: PurchaseOrder = {
                supplierId: createForm.supplierId,
                note: createForm.note,
                items: createForm.items.map(i => ({
                    productId: i.productId,
                    productName: i.productName,
                    quantity: i.quantity,
                    receivedQty: 0,
                    unitCost: i.unitCost,
                    total: i.quantity * i.unitCost
                }))
            };
            await api.purchaseOrders.create(order);
            notify('تم إنشاء أمر الشراء بنجاح', 'success');
            setShowCreateModal(false);
            setCreateForm({ supplierId: '', note: '', items: [] });
            loadOrders();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'فشل إنشاء أمر الشراء';
            notify(msg, 'error');
        }
    };

    // Add item to create form
    const addItemToOrder = (product: Product) => {
        const existing = createForm.items.find(i => i.productId === product.id);
        if (existing) {
            setCreateForm(prev => ({
                ...prev,
                items: prev.items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
            }));
        } else {
            setCreateForm(prev => ({
                ...prev,
                items: [...prev.items, {
                    productId: product.id,
                    productName: product.name,
                    quantity: 1,
                    unitCost: product.cost || 0
                }]
            }));
        }
        setProductSearch('');
    };

    // Remove item from create form
    const removeItemFromOrder = (productId: string) => {
        setCreateForm(prev => ({
            ...prev,
            items: prev.items.filter(i => i.productId !== productId)
        }));
    };

    // Receive order
    const handleReceiveOrder = async () => {
        if (!selectedOrder) return;

        const itemsToReceive = receiveItems.filter(i => i.receivedQty > 0);
        if (itemsToReceive.length === 0) { notify('يرجى تحديد الكميات المستلمة', 'error'); return; }

        try {
            await api.purchaseOrders.receive(selectedOrder.id!, itemsToReceive);
            notify('تم تسجيل الاستلام بنجاح', 'success');
            setShowReceiveModal(false);
            setSelectedOrder(null);
            loadOrders();
            onRefresh(); // Refresh supplier data
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'فشل تسجيل الاستلام';
            notify(msg, 'error');
        }
    };

    // Pay order
    const handlePayOrder = async () => {
        if (!selectedOrder || payAmount <= 0) { notify('يرجى إدخال مبلغ صحيح', 'error'); return; }

        try {
            await api.purchaseOrders.pay(selectedOrder.id!, payAmount, payMethod);
            notify('تم تسجيل الدفع بنجاح', 'success');
            setShowPayModal(false);
            setSelectedOrder(null);
            setPayAmount(0);
            loadOrders();
            onRefresh();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'فشل تسجيل الدفع';
            notify(msg, 'error');
        }
    };

    // Cancel order
    const handleCancelOrder = (order: PurchaseOrder) => {
        openConfirm({
            title: 'إلغاء أمر الشراء',
            message: `هل أنت متأكد من إلغاء أمر الشراء #${order.id}؟`,
            type: 'warning',
            onConfirm: async () => {
                try {
                    await api.purchaseOrders.cancel(order.id!);
                    notify('تم إلغاء الأمر', 'success');
                    loadOrders();
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'فشل الإلغاء';
                    notify(msg, 'error');
                }
                closeConfirm();
            }
        });
    };

    // Delete order
    const handleDeleteOrder = (order: PurchaseOrder) => {
        openConfirm({
            title: 'حذف أمر الشراء',
            message: `هل أنت متأكد من حذف أمر الشراء #${order.id}؟ هذا الإجراء لا يمكن التراجع عنه.`,
            type: 'error',
            onConfirm: async () => {
                try {
                    await api.purchaseOrders.delete(order.id!);
                    notify('تم حذف الأمر', 'success');
                    loadOrders();
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'فشل الحذف';
                    notify(msg, 'error');
                }
                closeConfirm();
            }
        });
    };

    // Open receive modal
    const openReceiveModal = (order: PurchaseOrder) => {
        setSelectedOrder(order);
        setReceiveItems(order.items.map(i => ({
            productId: i.productId,
            receivedQty: i.quantity - i.receivedQty // Default to remaining
        })));
        setShowReceiveModal(true);
    };

    // Open pay modal
    const openPayModal = (order: PurchaseOrder) => {
        setSelectedOrder(order);
        setPayAmount((order.totalAmount || 0) - (order.paidAmount || 0));
        setShowPayModal(true);
    };

    // Status badge
    const getStatusBadge = (status?: string) => {
        switch (status) {
            case 'pending': return <Badge type="warning" text="معلق" />;
            case 'partial': return <Badge type="info" text="استلام جزئي" />;
            case 'received': return <Badge type="success" text="مكتمل" />;
            case 'cancelled': return <Badge type="error" text="ملغي" />;
            default: return <Badge type="info" text={status || 'غير معروف'} />;
        }
    };

    // Filtered products for search
    const filteredProducts = products.filter(p =>
        p.name.includes(productSearch) || p.barcode?.includes(productSearch)
    ).slice(0, 10);

    const createFormTotal = createForm.items.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);

    if (loading) {
        return <div className="flex items-center justify-center py-12"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <input
                            className="bg-bg border border-border rounded-xl px-4 py-3 pl-10 text-sm font-bold w-64 focus:border-primary outline-none transition-all"
                            placeholder="بحث..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            aria-label="البحث في الأوامر"
                        />
                        <Search className="absolute left-3 top-3.5 text-text-muted" size={16} aria-hidden="true" />
                    </div>
                    <select
                        className="bg-bg border border-border rounded-xl px-4 py-3 text-sm font-bold outline-none"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        aria-label="تصفية حسب الحالة"
                    >
                        <option value="all">جميع الحالات</option>
                        <option value="pending">معلق</option>
                        <option value="partial">استلام جزئي</option>
                        <option value="received">مكتمل</option>
                        <option value="cancelled">ملغي</option>
                    </select>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-primary text-primary-fg px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:brightness-110 transition-all active:scale-95"
                >
                    <Plus size={18} /> أمر شراء جديد
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20 p-4 rounded-2xl">
                    <p className="text-xs text-text-muted font-bold">الأوامر المعلقة</p>
                    <p className="text-2xl font-black text-orange-500">{stats.pending}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 p-4 rounded-2xl">
                    <p className="text-xs text-text-muted font-bold">إجمالي المشتريات</p>
                    <p className="text-2xl font-black text-blue-500">{formatCurrency(stats.totalValue, currency)}</p>
                </div>
                <div className="bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 p-4 rounded-2xl">
                    <p className="text-xs text-text-muted font-bold">المستحق للموردين</p>
                    <p className="text-2xl font-black text-red-500">{formatCurrency(stats.totalUnpaid, currency)}</p>
                </div>
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
                <EmptyState icon={Package} title="لا توجد أوامر شراء" />
            ) : (
                <div className="space-y-3">
                    {filteredOrders.map(order => (
                        <SpotlightCard key={order.id} className="bg-surface border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all">
                            {/* Order Header */}
                            <div
                                className="p-4 flex items-center justify-between cursor-pointer"
                                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id!)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                        <Package size={20} className="text-primary" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-text-main">{order.id}</h4>
                                            {getStatusBadge(order.status)}
                                        </div>
                                        <p className="text-xs text-text-muted">{order.supplierName} • {new Date(order.createdAt || 0).toLocaleDateString('ar-IQ')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-left">
                                        <p className="text-xs text-text-muted">الإجمالي</p>
                                        <p className="font-bold font-mono text-lg">{formatCurrency(order.totalAmount || 0, currency)}</p>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-text-muted">المدفوع</p>
                                        <p className="font-bold font-mono text-lg text-green-500">{formatCurrency(order.paidAmount || 0, currency)}</p>
                                    </div>
                                    {expandedOrder === order.id ? <ChevronUp size={20} className="text-text-muted" /> : <ChevronDown size={20} className="text-text-muted" />}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedOrder === order.id && (
                                <div className="border-t border-border p-4 bg-bg/30">
                                    {/* Items */}
                                    <div className="border border-border rounded-xl overflow-hidden bg-surface mb-4">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-border bg-surface-hover text-text-muted text-xs">
                                                    <th className="text-right">المنتج</th>
                                                    <th className="text-center">الكمية</th>
                                                    <th className="text-center">المستلم</th>
                                                    <th className="text-left">السعر</th>
                                                    <th className="text-left">الإجمالي</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {order.items.map((item, idx) => (
                                                    <tr key={idx} className="border-b border-border/30 hover:bg-surface-hover transition-colors">
                                                        <td className="font-bold text-text-main">{item.productName}</td>
                                                        <td className="text-center font-mono text-text-muted">{item.quantity}</td>
                                                        <td className="text-center font-mono font-bold">
                                                            <span className={item.receivedQty >= item.quantity ? 'text-success' : 'text-warning'}>
                                                                {item.receivedQty}
                                                            </span>
                                                        </td>
                                                        <td className="text-left font-mono text-text-muted">{formatCurrency(item.unitCost, currency)}</td>
                                                        <td className="text-left font-mono font-bold text-text-main">{formatCurrency(item.total, currency)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 flex-wrap">
                                        {(order.status === 'pending' || order.status === 'partial') && (
                                            <>
                                                <button onClick={() => openReceiveModal(order)} aria-label="استلام البضاعة" className="flex-1 py-2.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded-xl text-sm font-bold hover:bg-green-500 hover:text-white transition-all flex items-center justify-center gap-2">
                                                    <Truck size={16} aria-hidden="true" /> استلام البضاعة
                                                </button>
                                                <button onClick={() => openPayModal(order)} aria-label="تسجيل دفعة" className="flex-1 py-2.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl text-sm font-bold hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center gap-2">
                                                    <DollarSign size={16} aria-hidden="true" /> تسجيل دفعة
                                                </button>
                                                <button onClick={() => handleCancelOrder(order)} aria-label="إلغاء الأمر" className="py-2.5 px-4 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-xl text-sm font-bold hover:bg-orange-500 hover:text-white transition-all">
                                                    <X size={16} aria-hidden="true" />
                                                </button>
                                            </>
                                        )}
                                        {order.status === 'pending' && (
                                            <button onClick={() => handleDeleteOrder(order)} aria-label="حذف الأمر" className="py-2.5 px-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-sm font-bold hover:bg-red-500 hover:text-white transition-all">
                                                <Trash2 size={16} aria-hidden="true" />
                                            </button>
                                        )}
                                        {order.status === 'received' && (order.totalAmount || 0) > (order.paidAmount || 0) && (
                                            <button onClick={() => openPayModal(order)} className="flex-1 py-2.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl text-sm font-bold hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center gap-2">
                                                <DollarSign size={16} /> تسديد المتبقي ({formatCurrency((order.totalAmount || 0) - (order.paidAmount || 0), currency)})
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </SpotlightCard>
                    ))}
                </div>
            )}

            {/* Create Order Modal */}
            {showCreateModal && (
                <Modal title="أمر شراء جديد" onClose={() => setShowCreateModal(false)} size="lg">
                    <div className="space-y-4 pt-2">
                        {/* Supplier Selection */}
                        <div>
                            <label className="text-xs font-bold text-text-muted mb-1 block">المورد</label>
                            <select
                                className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-sm font-bold outline-none"
                                value={createForm.supplierId}
                                onChange={e => setCreateForm(prev => ({ ...prev, supplierId: e.target.value }))}
                                aria-label="اختر المورد"
                            >
                                <option value="">اختر المورد...</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} - {s.companyName}</option>)}
                            </select>
                        </div>

                        {/* Product Search */}
                        <div>
                            <label className="text-xs font-bold text-text-muted mb-1 block">إضافة منتجات</label>
                            <div className="relative">
                                <input
                                    className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 pl-10 text-sm outline-none"
                                    placeholder="ابحث عن منتج بالاسم أو الباركود..."
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                />
                                <Search className="absolute left-3 top-3.5 text-text-muted" size={16} />
                            </div>
                            {productSearch && filteredProducts.length > 0 && (
                                <div className="mt-2 bg-surface border border-border rounded-xl max-h-40 overflow-y-auto">
                                    {filteredProducts.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => addItemToOrder(p)}
                                            className="w-full text-right px-4 py-2 hover:bg-white/5 flex justify-between items-center text-sm"
                                        >
                                            <span>{p.name}</span>
                                            <span className="text-text-muted font-mono text-xs">{formatCurrency(p.cost || 0, currency)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Selected Items */}
                        {createForm.items.length > 0 && (
                            <div className="bg-bg border border-border rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
                                {createForm.items.map(item => (
                                    <div key={item.productId} className="flex items-center justify-between gap-2 bg-surface p-2 rounded-lg">
                                        <span className="font-bold text-sm flex-1">{item.productName}</span>
                                        <input
                                            type="number"
                                            className="w-20 bg-input-bg border border-border rounded-lg px-2 py-1 text-sm text-center"
                                            value={item.quantity}
                                            min={1}
                                            onChange={e => setCreateForm(prev => ({
                                                ...prev,
                                                items: prev.items.map(i => i.productId === item.productId ? { ...i, quantity: Number(e.target.value) || 1 } : i)
                                            }))}
                                            aria-label="الكمية"
                                        />
                                        <span className="text-sm">×</span>
                                        <input
                                            type="number"
                                            className="w-24 bg-input-bg border border-border rounded-lg px-2 py-1 text-sm text-center font-mono"
                                            value={item.unitCost}
                                            min={0}
                                            onChange={e => setCreateForm(prev => ({
                                                ...prev,
                                                items: prev.items.map(i => i.productId === item.productId ? { ...i, unitCost: Number(e.target.value) || 0 } : i)
                                            }))}
                                            aria-label="سعر الشراء"
                                        />
                                        <span className="font-mono text-sm font-bold w-24 text-left">{formatCurrency(item.quantity * item.unitCost, currency)}</span>
                                        <button onClick={() => removeItemFromOrder(item.productId)} aria-label="إزالة المنتج" className="text-red-500 hover:bg-red-500/10 p-1 rounded">
                                            <Trash2 size={14} aria-hidden="true" />
                                        </button>
                                    </div>
                                ))}
                                <div className="border-t border-border pt-2 flex justify-between font-bold">
                                    <span>الإجمالي:</span>
                                    <span className="font-mono text-lg text-primary">{formatCurrency(createFormTotal, currency)}</span>
                                </div>
                            </div>
                        )}

                        {/* Note */}
                        <div>
                            <label className="text-xs font-bold text-text-muted mb-1 block">ملاحظات (اختياري)</label>
                            <textarea
                                className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-sm outline-none resize-none h-20"
                                placeholder="أي ملاحظات إضافية..."
                                value={createForm.note}
                                onChange={e => setCreateForm(prev => ({ ...prev, note: e.target.value }))}
                            />
                        </div>

                        <button onClick={handleCreateOrder} disabled={!createForm.supplierId || createForm.items.length === 0} className="w-full bg-primary text-primary-fg py-4 rounded-xl font-black hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            إنشاء أمر الشراء
                        </button>
                    </div>
                </Modal>
            )}

            {/* Receive Modal */}
            {showReceiveModal && selectedOrder && (
                <Modal title={`استلام البضاعة - ${selectedOrder.id}`} onClose={() => setShowReceiveModal(false)}>
                    <div className="space-y-4 pt-2">
                        <p className="text-sm text-text-muted">حدد الكميات المستلمة لكل منتج:</p>
                        <div className="bg-bg border border-border rounded-xl p-3 space-y-3">
                            {selectedOrder.items.map((item, idx) => {
                                const remaining = item.quantity - item.receivedQty;
                                const receiveItem = receiveItems.find(r => r.productId === item.productId);
                                return (
                                    <div key={idx} className="flex items-center justify-between gap-3">
                                        <div className="flex-1">
                                            <p className="font-bold text-sm">{item.productName}</p>
                                            <p className="text-xs text-text-muted">المطلوب: {item.quantity} | المستلم سابقاً: {item.receivedQty} | المتبقي: {remaining}</p>
                                        </div>
                                        <input
                                            type="number"
                                            className="w-24 bg-input-bg border border-border rounded-lg px-3 py-2 text-sm text-center font-mono"
                                            value={receiveItem?.receivedQty || 0}
                                            min={0}
                                            max={remaining}
                                            disabled={remaining === 0}
                                            onChange={e => setReceiveItems(prev => prev.map(r => r.productId === item.productId ? { ...r, receivedQty: Math.min(Number(e.target.value) || 0, remaining) } : r))}
                                            aria-label="الكمية المستلمة"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={handleReceiveOrder} className="w-full bg-green-500 text-white py-4 rounded-xl font-black hover:brightness-110 transition-all flex items-center justify-center gap-2">
                            <Check size={20} /> تأكيد الاستلام
                        </button>
                    </div>
                </Modal>
            )}

            {/* Pay Modal */}
            {showPayModal && selectedOrder && (
                <Modal title={`تسجيل دفعة - ${selectedOrder.id}`} onClose={() => setShowPayModal(false)} size="sm">
                    <div className="space-y-4 pt-2">
                        <div className="bg-bg border border-border rounded-xl p-4 text-center">
                            <p className="text-xs text-text-muted">المتبقي</p>
                            <p className="text-2xl font-black text-red-500 font-mono">{formatCurrency((selectedOrder.totalAmount || 0) - (selectedOrder.paidAmount || 0), currency)}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-muted mb-1 block">المبلغ</label>
                            <input
                                type="number"
                                className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-lg font-mono font-bold text-center outline-none"
                                value={payAmount}
                                onChange={e => setPayAmount(Number(e.target.value) || 0)}
                                max={(selectedOrder.totalAmount || 0) - (selectedOrder.paidAmount || 0)}
                                aria-label="المبلغ المدفوع"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-muted mb-1 block">طريقة الدفع</label>
                            <select className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-sm font-bold outline-none" value={payMethod} onChange={e => setPayMethod(e.target.value)} aria-label="طريقة الدفع">
                                <option value="cash">نقداً</option>
                                <option value="bank">تحويل بنكي</option>
                                <option value="check">شيك</option>
                            </select>
                        </div>
                        <button onClick={handlePayOrder} disabled={payAmount <= 0} className="w-full bg-blue-500 text-white py-4 rounded-xl font-black hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                            <DollarSign size={20} /> تسجيل الدفعة
                        </button>
                    </div>
                </Modal>
            )}

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmState.open}
                title={confirmState.title}
                message={confirmState.message}
                type={confirmState.type || "warning"}
                onConfirm={confirmState.onConfirm}
                onCancel={closeConfirm}
            />
        </div>
    );
};
