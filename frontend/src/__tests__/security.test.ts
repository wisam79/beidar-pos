import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../store/appStore';
import { apiClient, ApiResponse } from '../core/api/client';
import { sanitizeCSVCell, sanitizeInput } from '../core/utils';
import { validateProduct, validateProductInput } from '../core/schemas/product.schema';

describe('Security & Validation Protocols (Zero-Vulnerability Suite)', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.clearAllMocks();
        useAppStore.setState({
            activeView: 'dashboard',
            appState: 'app',
        });
    });

    /**
     * Test 1: Session timeout action clears token, user details, and resets auth status in Zustand store
     */
    it('test_appStore_sessionExpiry_clearsAuth', () => {
        // Pre-populate session state in localStorage
        localStorage.setItem('beidar_auth_session', JSON.stringify({ user: { id: 'staff_1', role: 'cashier' }, permissions: ['sales'] }));
        localStorage.setItem('beidar_auth_token', 'jwt_session_token_xyz_123');
        localStorage.setItem('beidar_last_activity', Date.now().toString());

        expect(localStorage.getItem('beidar_auth_token')).toBe('jwt_session_token_xyz_123');
        expect(useAppStore.getState().appState).toBe('app');

        // Trigger session expiry / clear auth session
        useAppStore.getState().clearAuthSession();

        // Verify tokens, sessions, and activity timestamps are wiped from storage
        expect(localStorage.getItem('beidar_auth_token')).toBeNull();
        expect(localStorage.getItem('beidar_auth_session')).toBeNull();
        expect(localStorage.getItem('beidar_last_activity')).toBeNull();

        // Verify application lifecycle is redirected to login view
        expect(useAppStore.getState().appState).toBe('login');
    });

    /**
     * Test 2: Mocking 401 response triggers auth clear / redirect action
     */
    it('test_apiClient_unauthorizedResponse_triggersLogout', async () => {
        localStorage.setItem('beidar_auth_token', 'active_bearer_token');
        useAppStore.setState({ appState: 'app' });

        const unauthorizedResponse: ApiResponse = {
            status: 401,
            error: 'Session expired or invalid token',
        };

        // Handling 401 response must throw an Unauthorized error and trigger logout
        expect(() => {
            apiClient.handleResponse(unauthorizedResponse);
        }).toThrow('Unauthorized');

        // State must transition to login and storage wiped
        expect(useAppStore.getState().appState).toBe('login');
        expect(localStorage.getItem('beidar_auth_token')).toBeNull();

        // Test with async request wrapper
        await expect(
            apiClient.request(async () => unauthorizedResponse)
        ).rejects.toThrow('Unauthorized');
    });

    /**
     * Test 3: CSV export helper escapes cells starting with '=', '+', '-', '@' with single quote `'`
     * Prevents CSV Formula Injection (CWE-1236)
     */
    it('test_csvExport_formulaInjection_sanitized', () => {
        // Malicious CSV formula injection payloads
        expect(sanitizeCSVCell("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
        expect(sanitizeCSVCell('=1+1')).toBe("'=1+1");
        expect(sanitizeCSVCell('+1234567890')).toBe("'+1234567890");
        expect(sanitizeCSVCell('-20% DISCOUNT')).toBe("'-20% DISCOUNT");
        expect(sanitizeCSVCell('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
        expect(sanitizeCSVCell('@HYPERLINK("http://attacker.com")')).toBe("'@HYPERLINK(\"http://attacker.com\")");

        // Benign values must remain untouched (no unnecessary prepended quotes)
        expect(sanitizeCSVCell('عصير برتقال طبيعي')).toBe('عصير برتقال طبيعي');
        expect(sanitizeCSVCell('Product ABC')).toBe('Product ABC');
        expect(sanitizeCSVCell('628100123456')).toBe('628100123456');
        expect(sanitizeCSVCell(1250)).toBe('1250');
        expect(sanitizeCSVCell(null)).toBe('');
        expect(sanitizeCSVCell(undefined)).toBe('');
    });

    /**
     * Test 4: Input sanitization cleans or escapes `<script>` / HTML payloads in text fields (XSS prevention)
     */
    it('test_inputValidation_xssInProductName', () => {
        // Script execution payloads
        const xssPayload1 = "<script>alert('XSS')</script>منتج جديد";
        expect(sanitizeInput(xssPayload1)).toBe('منتج جديد');

        // Image with onerror handler payload
        const xssPayload2 = "<img src=x onerror=alert('hacked')>شاي أسود";
        expect(sanitizeInput(xssPayload2)).toBe('شاي أسود');

        // Nested HTML tags payload
        const xssPayload3 = "<b>حليب</b> <i>طازج</i> <iframe src='javascript:alert(1)'></iframe>";
        expect(sanitizeInput(xssPayload3)).toBe('حليب طازج');

        // Clean input remains intact
        expect(sanitizeInput('قهوة عربية أصيلة')).toBe('قهوة عربية أصيلة');
        expect(sanitizeInput('')).toBe('');
    });

    /**
     * Test 5: Stock / price numeric validation rejects negative input values
     */
    it('test_numericInput_preventNegativeStock', () => {
        const baseProduct = {
            id: 'prod_sec_1',
            name: 'منتج أمان تجريبي',
            price: 1500,
            cost: 1000,
            stock: 25,
            minStock: 5,
            category: 'عام',
            barcode: '99887766',
        };

        // 1. Valid product with non-negative numbers passes
        expect(validateProduct(baseProduct).success).toBe(true);

        // 2. Zero stock and zero price are valid boundary values
        const zeroStockProduct = { ...baseProduct, stock: 0, price: 0, cost: 0, minStock: 0 };
        expect(validateProduct(zeroStockProduct).success).toBe(true);

        // 3. Negative stock must be rejected
        const negativeStockProduct = { ...baseProduct, stock: -5 };
        const stockResult = validateProduct(negativeStockProduct);
        expect(stockResult.success).toBe(false);

        // 4. Negative price must be rejected
        const negativePriceProduct = { ...baseProduct, price: -100 };
        const priceResult = validateProduct(negativePriceProduct);
        expect(priceResult.success).toBe(false);

        // 5. Negative cost must be rejected
        const negativeCostProduct = { ...baseProduct, cost: -50 };
        const costResult = validateProduct(negativeCostProduct);
        expect(costResult.success).toBe(false);

        // 6. Negative minStock in input form must also be rejected
        const negativeMinStockInput = {
            name: 'منتج جديد',
            price: 2000,
            cost: 1200,
            stock: 10,
            minStock: -2,
            category: 'عام',
        };
        const inputResult = validateProductInput(negativeMinStockInput);
        expect(inputResult.success).toBe(false);
    });
});
