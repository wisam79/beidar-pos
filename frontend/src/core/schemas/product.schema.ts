import { z } from 'zod';
import {
    idSchema,
    arabicNameSchema,
    priceSchema,
    stockSchema,
    notesSchema,
} from './common.schema';

// Product Schema
export const productSchema = z.object({
    id: idSchema,
    name: arabicNameSchema,
    price: priceSchema,
    cost: priceSchema,
    stock: stockSchema,
    minStock: stockSchema.nonnegative(),
    category: z.string().min(1, 'التصنيف مطلوب'),
    image: z.string().optional().default(''),
    barcode: z.string().optional().default(''),
    supplier: z.string().optional(),
    description: notesSchema,
    customDetails: z.record(z.any()).optional(),
});

// Product input (for forms - id is optional for new products)
export const productInputSchema = productSchema.extend({
    id: z.string().optional(),
});

// Product list item (minimal for grids)
export const productListItemSchema = productSchema.pick({
    id: true,
    name: true,
    price: true,
    stock: true,
    category: true,
    barcode: true,
});

// Types inferred from schemas
export type ProductSchema = z.infer<typeof productSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductListItem = z.infer<typeof productListItemSchema>;

// Validation helper
export const validateProduct = (data: unknown) => {
    return productSchema.safeParse(data);
};

export const validateProductInput = (data: unknown) => {
    return productInputSchema.safeParse(data);
};
