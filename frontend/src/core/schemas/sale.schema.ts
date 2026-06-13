import { z } from 'zod';
import {
    idSchema,
    priceSchema,
    positiveNumberSchema,
    timestampSchema,
    notesSchema,
} from './common.schema';

// Sale Item Schema
export const saleItemSchema = z.object({
    id: idSchema,
    pid: z.number().optional(),
    name: z.string().min(1),
    qty: z.number().int().positive('الكمية مطلوبة'),
    price: priceSchema,
    cost: priceSchema,
    discount: priceSchema.optional(),
    total: priceSchema.optional(),
});

// Installment Schema
export const installmentSchema = z.object({
    number: z.number().int().positive(),
    dueDate: z.string(),
    amount: priceSchema,
    status: z.enum(['pending', 'paid', 'overdue']),
    paidAt: timestampSchema.optional(),
});

// Installment Plan Schema
export const installmentPlanSchema = z.object({
    totalAmount: priceSchema,
    downPayment: priceSchema,
    months: z.number().int().positive(),
    startDate: z.string(),
    schedule: z.array(installmentSchema),
});

// Payment Method
export const paymentMethodSchema = z.enum([
    'cash',
    'card',
    'transfer',
    'installment',
    'split',
]);

// Sale Schema
export const saleSchema = z.object({
    id: idSchema,
    customer: z.string().default('عميل نقدي'),
    customerId: z.string().optional(),
    date: z.string(),
    timestamp: timestampSchema,
    subtotal: priceSchema,
    discount: priceSchema.default(0),
    vat: priceSchema.default(0),
    total: priceSchema,
    paymentMethod: z.string(),
    splitDetails: z.record(z.number()).optional(),
    installmentPlan: installmentPlanSchema.optional(),
    status: z.enum(['completed', 'pending', 'returned', 'partial']),
    note: notesSchema,
    itemsCount: positiveNumberSchema.int(),
    items: z.array(saleItemSchema),
    pointsRedeemed: positiveNumberSchema.optional(),
    pointsEarned: positiveNumberSchema.optional(),
});

// Types inferred from schemas
export type SaleItemSchema = z.infer<typeof saleItemSchema>;
export type InstallmentSchema = z.infer<typeof installmentSchema>;
export type SaleSchema = z.infer<typeof saleSchema>;

// Validation helpers
export const validateSale = (data: unknown) => {
    return saleSchema.safeParse(data);
};

export const validateSaleItem = (data: unknown) => {
    return saleItemSchema.safeParse(data);
};
