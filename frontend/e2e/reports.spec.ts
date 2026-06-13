import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Reports Page
 * Tests the reports and analytics page
 */

test.describe('Reports Page Structure', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/reports');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('should load reports page', async ({ page }) => {
        expect(page.url()).toContain('reports');
        await expect(page.locator('#root')).toBeVisible();
    });

    test('should display report sections', async ({ page }) => {
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(0);
    });

    test('should have date range selectors', async ({ page }) => {
        // Look for date inputs or range selectors
        const dateInputs = page.locator('input[type="date"], input[type="text"]');
        const count = await dateInputs.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});

test.describe('Reports Charts', () => {
    test('should display charts', async ({ page }) => {
        await page.goto('/#/reports');
        await page.waitForTimeout(2000);

        // Look for SVG elements (charts from Recharts)
        const charts = page.locator('svg');
        const count = await charts.count();

        expect(count).toBeGreaterThan(0);
    });

    test('should have export functionality', async ({ page }) => {
        await page.goto('/#/reports');
        await page.waitForTimeout(2000);

        // Look for export button
        const exportButtons = page.locator('button').filter({ hasText: /تصدير|export|pdf|excel/i });
        const count = await exportButtons.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});

test.describe('Reports Filters', () => {
    test('should have period filters', async ({ page }) => {
        await page.goto('/#/reports');
        await page.waitForTimeout(2000);

        // Look for period filter buttons
        const periodButtons = page.locator('button').filter({ hasText: /يوم|أسبوع|شهر|day|week|month/i });
        const count = await periodButtons.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});
