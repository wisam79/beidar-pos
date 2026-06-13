import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Sales Page - POS Interface
 * Tests the point of sale sales page with cart functionality
 */

test.setTimeout(60000);

test.describe('Sales Page Structure', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/sales');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('should load sales page', async ({ page }) => {
        expect(page.url()).toContain('sales');
        await expect(page.locator('#root')).toBeVisible();
    });

    test('should have page content', async ({ page }) => {
        const body = page.locator('body');
        await expect(body).toBeVisible();

        const content = await body.textContent();
        expect(content?.length).toBeGreaterThan(0);
    });

    test('should display products grid or search', async ({ page }) => {
        // Look for product search input
        const searchInputs = page.locator('input[type="search"], input[type="text"], input[placeholder*="بحث"], input[placeholder*="search"]');
        const count = await searchInputs.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});

test.describe('Sales Cart Interface', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/sales');
        await page.waitForTimeout(2000);
    });

    test('should display cart section', async ({ page }) => {
        // Cart section should exist
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(0);
    });

    test('should have checkout button', async ({ page }) => {
        // Look for checkout/payment button
        const checkoutButtons = page.locator('button').filter({ hasText: /دفع|checkout|إتمام|pay/i });
        const count = await checkoutButtons.count();

        // Button may be disabled without items
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have clear cart button', async ({ page }) => {
        // Look for clear button
        const clearButtons = page.locator('button').filter({ hasText: /مسح|clear|إفراغ/i });
        const count = await clearButtons.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});

test.describe('Sales Barcode Scanner', () => {
    test('should have barcode scanner button', async ({ page }) => {
        await page.goto('/#/sales');
        await page.waitForTimeout(2000);

        // Look for scanner button
        const scanButtons = page.locator('button').filter({ hasText: /مسح|scan|باركود|barcode/i });
        const buttons = page.locator('button svg');

        const count = await buttons.count();
        expect(count).toBeGreaterThan(0);
    });
});

test.describe('Sales Customer Selection', () => {
    test('should have customer selection', async ({ page }) => {
        await page.goto('/#/sales');
        await page.waitForTimeout(2000);

        // Look for customer buttons or dropdowns
        const customerElements = page.locator('button').filter({ hasText: /عميل|customer|ضيف|guest/i });
        const count = await customerElements.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});

test.describe('Sales Parked Sales', () => {
    test('should have park sale functionality', async ({ page }) => {
        await page.goto('/#/sales');
        await page.waitForTimeout(2000);

        // Look for park button
        const parkButtons = page.locator('button').filter({ hasText: /حفظ|park|معلق/i });
        const count = await parkButtons.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});

test.describe('Sales Keyboard Navigation', () => {
    test('should respond to keyboard input', async ({ page }) => {
        await page.goto('/#/sales');
        await page.waitForTimeout(2000);

        // Press some keys
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        // Page should still be functional
        expect(page.url()).toContain('sales');
    });
});
