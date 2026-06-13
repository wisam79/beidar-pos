import { z } from 'zod';

export const staffSchema = z.object({
    name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
    username: z.string().min(3, 'اسم المستخدم يجب أن يكون 3 حروف على الأقل').regex(/^[a-zA-Z0-9_]+$/, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام فقط'),
    role: z.enum(['admin', 'manager', 'cashier', 'viewer']),
    email: z.string().email('بريد إلكتروني غير صالح').optional().or(z.literal('')),
    phone: z.string().optional(),
    active: z.boolean().default(true),
    permissions: z.array(z.string()).optional()
});

export const validateStaffInput = (data: unknown) => {
    const result = staffSchema.safeParse(data);
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

export const passwordSchema = z.string().min(4, 'كلمة المرور يجب أن تكون 4 حروف على الأقل').optional().or(z.literal(''));
export const pinSchema = z.string().regex(/^\d{4}$/, 'رمز PIN يجب أن يتكون من 4 أرقام').optional().or(z.literal(''));
