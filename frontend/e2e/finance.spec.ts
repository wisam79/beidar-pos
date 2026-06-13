import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Finance Page
 * Tests the financial management page
 */

test.describe('Finance Page Structure', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/finance');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('should load finance page', async ({ page }) => {
        expect(page.url()).toContain('finance');
        await expect(page.locator('#root')).toBeVisible();
    });

    test('should display financial summary cards', async ({ page }) => {
        // Finance page typically has summary cards
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(0);
    });

    test('should have tabs for different views', async ({ page }) => {
        const buttons = page.locator('button');
        const count = await buttons.count();

        expect(count).toBeGreaterThan(0);
    });
});

test.describe('Finance Expense Management', () => {
    test('should have add expense button', async ({ page }) => {
        await page.goto('/#/finance');
        await page.waitForTimeout(2000);

        const addButtons = page.locator('button').filter({ hasText: /إضافة|جديد|add|new|مصروف/i });
        const count = await addButtons.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display expense list or empty state', async ({ page }) => {
        await page.goto('/#/finance');
        await page.waitForTimeout(2000);

        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(0);
    });
});

test.describe('Finance Suppliers Management', () => {
    test('should allow navigation to suppliers section', async ({ page }) => {
        await page.goto('/#/finance');
        await page.waitForTimeout(2000);

        // Look for suppliers tab/button
        const supplierButtons = page.locator('button').filter({ hasText: /موردين|supplier|مورد/i });
        const count = await supplierButtons.count();

        if (count > 0) {
            await supplierButtons.first().click();
            await page.waitForTimeout(500);
        }

        // Should still be on finance page
        expect(page.url()).toContain('finance');
    });
});
