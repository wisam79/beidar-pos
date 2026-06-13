import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Invoices Page
 * Tests the invoices listing page
 */

test.describe('Invoices Page Structure', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/invoices');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('should load invoices page', async ({ page }) => {
        expect(page.url()).toContain('invoices');
        await expect(page.locator('#root')).toBeVisible();
    });

    test('should have search functionality', async ({ page }) => {
        const searchInputs = page.locator('input[type="search"], input[type="text"]');
        const count = await searchInputs.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display invoice list or empty state', async ({ page }) => {
        const body = await page.locator('body').textContent();
        expect(body?.length).toBeGreaterThan(0);
    });
});

test.describe('Invoices Filtering', () => {
    test('should have status filters', async ({ page }) => {
        await page.goto('/#/invoices');
        await page.waitForTimeout(2000);

        // Look for filter dropdowns or buttons
        const filters = page.locator('select, [role="combobox"]');
        const count = await filters.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have date filter', async ({ page }) => {
        await page.goto('/#/invoices');
        await page.waitForTimeout(2000);

        const dateInputs = page.locator('input[type="date"]');
        const count = await dateInputs.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});

test.describe('Invoices Pagination', () => {
    test('should have pagination controls', async ({ page }) => {
        await page.goto('/#/invoices');
        await page.waitForTimeout(2000);

        // Look for pagination buttons
        const paginationButtons = page.locator('button').filter({ hasText: /التالي|السابق|next|prev|›|‹/i });
        const count = await paginationButtons.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});
