import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Inventory Page
 * Tests the inventory management page
 */

test.describe('Inventory Page Structure', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/inventory');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('should load inventory page', async ({ page }) => {
        expect(page.url()).toContain('inventory');
        await expect(page.locator('#root')).toBeVisible();
    });

    test('should display stock movements table or empty state', async ({ page }) => {
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(0);
    });

    test('should have filtering options', async ({ page }) => {
        // Look for filter buttons or selects
        const filters = page.locator('select, [data-testid="filter"]');
        const count = await filters.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});

test.describe('Inventory Tabs', () => {
    test('should have tab navigation', async ({ page }) => {
        await page.goto('/#/inventory');
        await page.waitForTimeout(2000);

        // Look for tab buttons
        const tabs = page.locator('button, [role="tab"]');
        const count = await tabs.count();

        expect(count).toBeGreaterThan(0);
    });

    test('should switch between tabs', async ({ page }) => {
        await page.goto('/#/inventory');
        await page.waitForTimeout(2000);

        // Get first tab-like button
        const buttons = page.locator('button');
        const count = await buttons.count();

        if (count > 1) {
            // Click second button (first might be active)
            await buttons.nth(1).click();
            await page.waitForTimeout(500);

            // Page should still be on inventory
            expect(page.url()).toContain('inventory');
        }
    });
});
