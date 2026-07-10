import { z } from 'zod';

export const settingsSchema = z.object({
    storeName: z.string().min(1, 'اسم المتجر مطلوب'),
    storePhone: z.string().min(4, 'رقم الهاتف قصير جداً').optional().or(z.literal('')),
    vatRate: z.number().min(0).optional().default(0),
    taxRate: z.number().min(0).optional().default(0),
    lowStockTrigger: z.number().min(0, 'حد التنبيه لا يمكن أن يكون سالباً').optional().default(5),
    adminPin: z.string().min(4, 'رمز المسؤول يجب أن يكون 4 أرقام على الأقل').optional().or(z.literal('')),

    dailySalesTarget: z.number().min(0, 'هدف المبيعات لا يمكن أن يكون سالباً').optional().default(0),
    // Optional validations
    storeAddress: z.string().optional(),
    receiptFooter: z.string().optional(),
    geminiApiKey: z.string().optional(),
    aiProvider: z.string().optional(),
    aiModel: z.string().optional(),
    aiRotationMode: z.string().optional(),
    groqApiKey: z.string().optional(),
    // Enums (less critical for form input validation as they use Select usually, but good for data integrity)
    fontSize: z.enum(['normal', 'large', 'xl']).optional(),
    language: z.string().optional(),
    currency: z.string().optional(),
});

export const validateSettings = (data: unknown) => {
    // We only validate a subset of fields typically, or all. 
    // Since localPrefs has everything, we can validate loosely or strip unknown.
    // 'passthrough' allows other fields (like theme, booleans) to pass without error if we didn't define them all.
    const result = settingsSchema.passthrough().safeParse(data);

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
