// ═══════════════════════════════════════════════════════════════════════════════
// 🛒 useCart Hook - Cart State Management
// Extracted from Sales.tsx for reusability and cleaner code
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CartItem, Product, Customer } from '../core/types';
import { playBeep } from '../core/utils';

const CART_STORAGE_KEY = 'beidar_pos_cart';
const CUSTOMER_STORAGE_KEY = 'beidar_pos_customer';
const DISCOUNT_STORAGE_KEY = 'beidar_pos_discount';
const PAYMENT_METHOD_STORAGE_KEY = 'beidar_pos_payment_method';
const ZEN_MODE_STORAGE_KEY = 'beidar_pos_zen_mode';

interface UseCartOptions {
    onCartRestored?: () => void;
}

interface UseCartReturn {
    // State
    cart: CartItem[];
    selectedCustomer: Customer | null;
    discount: number;
    paymentMethod: 'cash' | 'card' | 'credit' | 'split' | 'installment';
    isZenMode: boolean;
    receivedAmount: number;

    // Computed
    subtotal: number;
    total: number;
    change: number;
    itemsCount: number;

    // Actions
    addToCart: (product: Product, silent?: boolean) => void;
    updateQty: (id: string, delta: number) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    setDiscount: (amount: number) => void;
    setPaymentMethod: (method: 'cash' | 'card' | 'credit' | 'split' | 'installment') => void;
    setIsZenMode: (isZen: boolean) => void;
    setSelectedCustomer: (customer: Customer | null) => void;
    setReceivedAmount: (amount: number) => void;
    setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;

    // Utils
    justAddedId: string | null;
}

export function useCart(options: UseCartOptions = {}): UseCartReturn {
    const { onCartRestored } = options;

    // Core State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [discount, setDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit' | 'split' | 'installment'>('cash');
    const [isZenMode, setIsZenMode] = useState(false);
    const [receivedAmount, setReceivedAmount] = useState(0);
    const [justAddedId, setJustAddedId] = useState<string | null>(null);

    // Track if initial restore has happened
    const initialRestoreDone = useRef(false);

    // ═══════════════════════════════════════════════════════════════════════════════
    // Computed Values
    // ═══════════════════════════════════════════════════════════════════════════════

    const subtotal = useMemo(() =>
        Math.round(cart.reduce((sum, item) => sum + (item.price * item.qty) - (item.itemDiscount || 0), 0)),
        [cart]
    );

    // Clamp discount to never exceed subtotal
    const effectiveDiscount = useMemo(() => Math.min(discount, subtotal), [discount, subtotal]);
    const total = useMemo(() => Math.round(Math.max(0, subtotal - effectiveDiscount)), [subtotal, effectiveDiscount]);
    const change = useMemo(() => Math.round(Math.max(0, receivedAmount - total)), [receivedAmount, total]);
    const itemsCount = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);

    // ═══════════════════════════════════════════════════════════════════════════════
    // LocalStorage Persistence
    // ═══════════════════════════════════════════════════════════════════════════════

    // Restore cart from localStorage on mount
    useEffect(() => {
        if (initialRestoreDone.current) return;
        initialRestoreDone.current = true;

        try {
            const savedCart = localStorage.getItem(CART_STORAGE_KEY);
            const savedDiscount = localStorage.getItem(DISCOUNT_STORAGE_KEY);
            const savedCustomer = localStorage.getItem(CUSTOMER_STORAGE_KEY);
            const savedPaymentMethod = localStorage.getItem(PAYMENT_METHOD_STORAGE_KEY);
            const savedZenMode = localStorage.getItem(ZEN_MODE_STORAGE_KEY);


            let restored = false;

            if (savedCart) {
                const parsedCart = JSON.parse(savedCart);
                if (Array.isArray(parsedCart) && parsedCart.length > 0) {
                    setCart(parsedCart);
                    restored = true;
                }
            }
            // Only restore discount if cart was restored
            if (savedDiscount && restored) {
                setDiscount(Number(savedDiscount));
            }
            if (savedCustomer) {
                setSelectedCustomer(JSON.parse(savedCustomer));
            }
            if (savedPaymentMethod) {
                setPaymentMethod(savedPaymentMethod as 'cash' | 'card' | 'credit' | 'split' | 'installment');
            }
            // Zen Mode always defaults to false (not restored)
            setIsZenMode(false);

            if (restored && onCartRestored) {
                onCartRestored();
            }
        } catch (e) {
            console.error('Error restoring cart:', e);
        }
    }, [onCartRestored]);

    // Save cart to localStorage whenever it changes
    useEffect(() => {
        if (cart.length > 0) {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
            localStorage.setItem(DISCOUNT_STORAGE_KEY, discount.toString());
            localStorage.setItem(PAYMENT_METHOD_STORAGE_KEY, paymentMethod);
            // Zen Mode NOT saved anymore
            if (selectedCustomer) {
                localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(selectedCustomer));
            }
        } else {
            // Clear storage when cart is empty (after checkout)
            localStorage.removeItem(CART_STORAGE_KEY);
            localStorage.removeItem(DISCOUNT_STORAGE_KEY);
            localStorage.removeItem(CUSTOMER_STORAGE_KEY);
            localStorage.removeItem(PAYMENT_METHOD_STORAGE_KEY);
            setPaymentMethod('cash'); // Reset to default when clearing
            setDiscount(0); // Reset discount when cart is empty
            setIsZenMode(false); // Valid to reset here too
        }
    }, [cart, discount, selectedCustomer, paymentMethod]); // Removed isZenMode form dependency

    // Reset received amount when total changes
    useEffect(() => {
        setReceivedAmount(0);
    }, [total]);

    // ═══════════════════════════════════════════════════════════════════════════════
    // Cart Actions
    // ═══════════════════════════════════════════════════════════════════════════════

    const addToCart = useCallback((product: Product, silent = false) => {
        setJustAddedId(product.id);
        setTimeout(() => setJustAddedId(null), 300);

        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id
                        ? { ...item, qty: item.qty + 1 }
                        : item
                );
            }
            return [...prev, { ...product, qty: 1, itemDiscount: 0, saleId: '' }];
        });

        if (!silent) {
            playBeep('success');
        }
    }, []);

    const updateQty = useCallback((id: string, delta: number) => {
        setCart(prev =>
            prev.map(item =>
                item.id === id
                    ? { ...item, qty: Math.max(0.01, item.qty + delta) } // Allow fractions (manual), buttons enforce 1
                    : item
            )
        );
    }, []);

    const removeFromCart = useCallback((id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
        setDiscount(0);
        setPaymentMethod('cash');
        setSelectedCustomer(null);
        setReceivedAmount(0);
    }, []);

    return {
        // State
        cart,
        selectedCustomer,
        discount,
        paymentMethod,
        isZenMode,
        receivedAmount,

        // Computed
        subtotal,
        total,
        change,
        itemsCount,

        // Actions
        addToCart,
        updateQty,
        removeFromCart,
        clearCart,
        setDiscount,
        setPaymentMethod,
        setIsZenMode,
        setSelectedCustomer,
        setReceivedAmount,
        setCart,

        // Utils
        justAddedId,
    };
}
