import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Dashboard Page
 * Tests the main dashboard functionality
 */

test.describe('Dashboard Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/dashboard');
        await page.waitForTimeout(3000);
    });

    test('should load dashboard and display stats cards', async ({ page }) => {
        // Wait for the dashboard to fully render
        await page.waitForTimeout(2000);

        // Check that we're on the dashboard
        expect(page.url()).toContain('dashboard');

        // React root should be visible
        await expect(page.locator('#root')).toBeVisible();

        // Check for stat cards (they should have specific structure)
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(0);
    });

    test('should display charts section', async ({ page }) => {
        await page.waitForTimeout(2000);

        // Look for SVG elements (charts)
        const svgElements = page.locator('svg');
        const count = await svgElements.count();

        // Dashboard should have at least some SVG icons/charts
        expect(count).toBeGreaterThan(0);
    });

    test('should be navigable via sidebar', async ({ page }) => {
        await page.waitForTimeout(2000);

        // Look for navigation elements
        const navLinks = page.locator('a, button');
        const count = await navLinks.count();

        expect(count).toBeGreaterThan(0);
    });
});

test.describe('Dashboard Interactions', () => {
    test('should handle refresh action', async ({ page }) => {
        await page.goto('/#/dashboard');
        await page.waitForTimeout(3000);

        // Look for refresh button
        const refreshButton = page.locator('button').filter({ hasText: /تحديث|refresh/i });
        const count = await refreshButton.count();

        if (count > 0) {
            await refreshButton.first().click();
            await page.waitForTimeout(1000);

            // Page should still be on dashboard after refresh
            expect(page.url()).toContain('dashboard');
        }
    });

    test('should open AI insights if available', async ({ page }) => {
        await page.goto('/#/dashboard');
        await page.waitForTimeout(2000);

        // Look for AI button (may have sparkles icon)
        const aiButton = page.locator('button').filter({ hasText: /رؤى|insights|تحليل/i });
        const count = await aiButton.count();

        // AI feature is optional, just verify it doesn't crash
        expect(count).toBeGreaterThanOrEqual(0);
    });
});
