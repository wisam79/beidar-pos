import { z } from 'zod';
import {
    idSchema,
    arabicNameSchema,
    phoneSchema,
    positiveNumberSchema,
    notesSchema,
} from './common.schema';

// Customer Schema
export const customerSchema = z.object({
    id: idSchema,
    name: arabicNameSchema,
    phone: phoneSchema.default(''),
    totalPurchases: positiveNumberSchema.default(0),
    debt: z.number().default(0),
    lastVisit: z.string().optional(),
    points: positiveNumberSchema.int().default(0),
    notes: notesSchema,
});

// Customer input (for forms)
export const customerInputSchema = customerSchema.extend({
    id: z.string().optional(),
});

// Types inferred from schemas
export type CustomerSchema = z.infer<typeof customerSchema>;
export type CustomerInput = z.infer<typeof customerInputSchema>;

// Validation helper
export const validateCustomer = (data: unknown) => {
    return customerSchema.safeParse(data);
};

export const validateCustomerInput = (data: unknown) => {
    return customerInputSchema.safeParse(data);
};
