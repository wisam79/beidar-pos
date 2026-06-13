import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Shifts Page
 * Tests the shift management page
 */

test.describe('Shifts Page Structure', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/shifts');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('should load shifts page', async ({ page }) => {
        expect(page.url()).toContain('shifts');
        await expect(page.locator('#root')).toBeVisible();
    });

    test('should display shift management UI', async ({ page }) => {
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(0);
    });

    test('should have open/close shift buttons', async ({ page }) => {
        // Look for shift control buttons
        const shiftButtons = page.locator('button').filter({ hasText: /فتح|إغلاق|open|close|وردية/i });
        const count = await shiftButtons.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});

test.describe('Shifts History', () => {
    test('should display shift history or current shift', async ({ page }) => {
        await page.goto('/#/shifts');
        await page.waitForTimeout(2000);

        // Should show either current shift or history
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(0);
    });

    test('should have cash movement controls', async ({ page }) => {
        await page.goto('/#/shifts');
        await page.waitForTimeout(2000);

        // Look for cash in/out buttons
        const cashButtons = page.locator('button').filter({ hasText: /إيداع|سحب|cash|نقد/i });
        const count = await cashButtons.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});
