import { z } from 'zod';

export const discountSchema = z.object({
    name: z.string().min(1, 'اسم الخصم مطلوب'),
    type: z.enum(['percentage', 'fixed', 'quantity', 'buyXgetY']),
    value: z.number().min(0.01, 'قيمة الخصم يجب أن تكون أكبر من 0'),
    minPurchase: z.number().min(0).optional(),
    maxDiscount: z.number().min(0).optional(),
    code: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    usageLimit: z.number().min(0).optional(),
    active: z.boolean().default(true),
});

export const discountInputSchema = discountSchema; // Same for now, maybe omit id

export const validateDiscountInput = (data: unknown) => {
    const result = discountInputSchema.safeParse(data);
    if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach((error) => {
            if (error.path[0]) {
                fieldErrors[error.path[0] as string] = error.message;
            }
        });
        return { success: false, errors: fieldErrors };
    }
    return { success: true, data: result.data };
};
