/**
 * Staff Error Parser Utility
 * Parses structured StaffError from Go backend
 */

export interface StaffError {
    code: string;
    message: string;
    hint?: string;
    field?: string;
}

// Error codes from backend (staff.go)
export const StaffErrorCodes = {
    DUPLICATE_USERNAME: 'DUPLICATE_USERNAME',
    WEAK_PASSWORD: 'WEAK_PASSWORD',
    INVALID_EMAIL: 'INVALID_EMAIL',
    STAFF_INVALID_PHONE: 'STAFF_INVALID_PHONE',
    STAFF_NOT_FOUND: 'STAFF_NOT_FOUND',
    LAST_ADMIN: 'LAST_ADMIN',
    STAFF_HAS_SALES: 'STAFF_HAS_SALES',
    WEAK_PIN: 'WEAK_PIN',
    PIN_TOO_SHORT: 'PIN_TOO_SHORT',
    PIN_NOT_NUMERIC: 'PIN_NOT_NUMERIC',
    STAFF_INVALID_NAME: 'STAFF_INVALID_NAME',
    INVALID_USERNAME: 'INVALID_USERNAME',
    PASSWORD_REQUIRED: 'PASSWORD_REQUIRED',
    MISSING_STAFF_ID: 'MISSING_STAFF_ID',
    DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

/**
 * Parse error from backend into structured StaffError
 * Handles various error formats from Wails/Go
 */
export function parseStaffError(error: unknown): StaffError {
    // Default error
    const defaultError: StaffError = {
        code: 'UNKNOWN_ERROR',
        message: 'حدث خطأ غير متوقع',
        hint: 'حاول مرة أخرى أو تواصل مع الدعم الفني',
    };

    if (!error) return defaultError;

    // Handle string errors
    if (typeof error === 'string') {
        // Try to parse as JSON (Go errors are often JSON strings)
        try {
            const parsed = JSON.parse(error);
            if (parsed.code && parsed.message) {
                return {
                    code: parsed.code,
                    message: parsed.message,
                    hint: parsed.hint || getDefaultHint(parsed.code),
                    field: parsed.field,
                };
            }
        } catch {
            // Not JSON, use as message
            return {
                code: 'UNKNOWN_ERROR',
                message: error,
                hint: getDefaultHint('UNKNOWN_ERROR'),
            };
        }
    }

    // Handle Error objects
    if (error instanceof Error) {
        // Try to parse error.message as JSON
        try {
            const parsed = JSON.parse(error.message);
            if (parsed.code && parsed.message) {
                return {
                    code: parsed.code,
                    message: parsed.message,
                    hint: parsed.hint || getDefaultHint(parsed.code),
                    field: parsed.field,
                };
            }
        } catch {
            // Not JSON
        }

        return {
            code: 'UNKNOWN_ERROR',
            message: error.message,
            hint: getDefaultHint('UNKNOWN_ERROR'),
        };
    }

    // Handle object with message property
    if (typeof error === 'object' && error !== null) {
        const obj = error as Record<string, unknown>;

        // Direct StaffError format
        if (obj.code && obj.message) {
            return {
                code: String(obj.code),
                message: String(obj.message),
                hint: obj.hint ? String(obj.hint) : getDefaultHint(String(obj.code)),
                field: obj.field ? String(obj.field) : undefined,
            };
        }

        // Wails error format
        if (obj.message) {
            return {
                code: 'UNKNOWN_ERROR',
                message: String(obj.message),
                hint: getDefaultHint('UNKNOWN_ERROR'),
            };
        }
    }

    return defaultError;
}

/**
 * Get default hint for error code if backend didn't provide one
 */
function getDefaultHint(code: string): string {
    const hints: Record<string, string> = {
        DUPLICATE_USERNAME: 'جرب اسم مستخدم آخر أو أضف أرقاماً في النهاية',
        WEAK_PASSWORD: 'استخدم كلمة مرور أقوى (4 أحرف على الأقل)',
        INVALID_EMAIL: 'تأكد من صحة البريد الإلكتروني (مثال: user@example.com)',
        STAFF_INVALID_PHONE: 'يجب أن يبدأ بـ 07 ويتكون من 11 رقماً',
        STAFF_NOT_FOUND: 'الموظف غير موجود، حاول تحديث القائمة',
        LAST_ADMIN: 'أضف مديراً آخر أولاً قبل تعديل هذا المدير',
        STAFF_HAS_SALES: 'الموظف لديه سجل مبيعات. يُنصح بتعطيله بدلاً من حذفه',
        WEAK_PIN: 'تجنب الأرقام السهلة مثل 0000 أو 1234',
        PIN_TOO_SHORT: 'رمز PIN يجب أن يكون 4 أرقام',
        PIN_NOT_NUMERIC: 'رمز PIN يجب أن يحتوي على أرقام فقط',
        STAFF_INVALID_NAME: 'الاسم يجب أن يكون حرفين على الأقل',
        INVALID_USERNAME: 'اسم المستخدم يجب أن يكون 3-20 حرفاً',
        PASSWORD_REQUIRED: 'كلمة المرور مطلوبة للموظف الجديد',
        MISSING_STAFF_ID: 'حدث خطأ تقني، حاول تحديث الصفحة',
        DATABASE_ERROR: 'حدث خطأ في قاعدة البيانات، حاول مرة أخرى',
    };

    return hints[code] || 'حاول مرة أخرى أو تواصل مع الدعم الفني';
}

/**
 * Map error code to field name for highlighting
 */
export function getErrorField(code: string): string | undefined {
    const fieldMap: Record<string, string> = {
        DUPLICATE_USERNAME: 'username',
        INVALID_USERNAME: 'username',
        WEAK_PASSWORD: 'password',
        PASSWORD_REQUIRED: 'password',
        INVALID_EMAIL: 'email',
        STAFF_INVALID_PHONE: 'phone',
        STAFF_INVALID_NAME: 'name',
        WEAK_PIN: 'pin',
        PIN_TOO_SHORT: 'pin',
        PIN_NOT_NUMERIC: 'pin',
    };

    return fieldMap[code];
}
