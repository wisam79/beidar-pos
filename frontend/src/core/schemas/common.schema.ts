import { z } from 'zod';

// Common reusable schemas
export const idSchema = z.string().min(1, 'المعرف مطلوب');

export const arabicNameSchema = z
    .string()
    .min(2, 'الاسم يجب أن يكون حرفين على الأقل')
    .max(100, 'الاسم طويل جداً');

export const phoneSchema = z
    .string()
    .regex(/^[\d\s\-+()]+$/, 'رقم الهاتف غير صالح')
    .optional()
    .or(z.literal(''));

export const positiveNumberSchema = z
    .number()
    .nonnegative('القيمة يجب أن تكون صفر أو أكبر');

export const priceSchema = z
    .number()
    .nonnegative('السعر يجب أن يكون صفر أو أكبر');

export const stockSchema = z
    .number()
    .int('الكمية يجب أن تكون عدد صحيح');

export const timestampSchema = z.number().int().positive();

export const notesSchema = z.string().max(500, 'الملاحظات طويلة جداً').optional();
