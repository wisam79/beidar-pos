import * as ProductHandler from '../../../wailsjs/go/handlers/ProductHandler';
import * as FinanceHandler from '../../../wailsjs/go/handlers/FinanceHandler';
import { Product, CategoryDef, PaginatedProducts } from './types';

export const products = {
    list: (page: number, pageSize: number, search: string, category: string, supplier: string, status: string) => {
        return ProductHandler.GetAllProducts().then(allProducts => {
            let filtered = allProducts;
            if (search) {
                const q = search.toLowerCase();
                filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q));
            }
            if (category && category !== 'الكل' && category !== 'all') {
                filtered = filtered.filter(p => p.category === category);
            }
            if (supplier) {
                filtered = filtered.filter(p => p.supplier === supplier);
            }
            if (status === 'low') {
                filtered = filtered.filter(p => p.stock <= p.minStock && p.stock > 0);
            } else if (status === 'out') {
                filtered = filtered.filter(p => p.stock <= 0);
            }

            let totalStock = 0;
            let totalValue = 0;
            let totalCost = 0;
            filtered.forEach(p => {
                totalStock += p.stock;
                totalValue += p.price * p.stock;
                totalCost += p.cost * p.stock;
            });

            const total = filtered.length;
            const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;
            const start = page > 0 ? (page - 1) * pageSize : 0;
            const paginatedData = pageSize > 0 ? filtered.slice(start, start + pageSize) : filtered;

            return {
                data: paginatedData,
                total: total,
                totalPages: totalPages,
                page: page,
                stats: { totalStock, totalValue, totalCost, profit: totalValue - totalCost }
            } as PaginatedProducts;
        });
    },
    save: (p: Product) => {
        if (p.id) {
            return ProductHandler.UpdateProduct(p);
        } else {
            return ProductHandler.CreateProduct(p);
        }
    },
    delete: (id: string, force?: boolean) => ProductHandler.DeleteProduct(id),
    search: (q: string) => ProductHandler.SearchProducts(q),
};

export const stock = {
    movements: () => ProductHandler.GetStockMovements(),
    log: (productId: string, productName: string, type: string, qty: number, reason: string) => ProductHandler.LogStockMovement(productId, productName, type, qty, reason),
};

export const categories = {
    list: () => FinanceHandler.GetCategories(),
    save: (c: CategoryDef) => FinanceHandler.SaveCategory(c),
    delete: (id: string, force?: boolean) => FinanceHandler.DeleteCategory(id, force || false),
};
