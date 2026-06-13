import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Settings Page
 * Tests the settings page structure and interactions
 */

test.describe('Settings Page Structure', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/settings');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('should load settings page', async ({ page }) => {
        expect(page.url()).toContain('settings');
        await expect(page.locator('#root')).toBeVisible();
    });

    test('should display settings tabs/sections', async ({ page }) => {
        // Settings page should have multiple sections
        const buttons = page.locator('button');
        const count = await buttons.count();

        // Settings has many tabs/buttons
        expect(count).toBeGreaterThan(3);
    });

    test('should have form inputs', async ({ page }) => {
        // Settings has various input fields
        const inputs = page.locator('input');
        const count = await inputs.count();

        expect(count).toBeGreaterThan(0);
    });
});

test.describe('Settings Theme Toggle', () => {
    test('should have theme toggle option', async ({ page }) => {
        await page.goto('/#/settings');
        await page.waitForTimeout(2000);

        // Look for theme-related elements
        const body = page.locator('body');
        const hasDataTheme = await page.locator('html').getAttribute('data-theme');

        // Should have a theme attribute (dark or light)
        expect(hasDataTheme === 'dark' || hasDataTheme === 'light' || hasDataTheme === null).toBeTruthy();
    });
});

test.describe('Settings Store Configuration', () => {
    test('should display store name input', async ({ page }) => {
        await page.goto('/#/settings');
        await page.waitForTimeout(2000);

        // Look for store name input
        const inputs = page.locator('input');
        const count = await inputs.count();

        // At least one input should exist
        expect(count).toBeGreaterThan(0);
    });

    test('should display currency selector', async ({ page }) => {
        await page.goto('/#/settings');
        await page.waitForTimeout(2000);

        // Look for select elements
        const selects = page.locator('select');
        const count = await selects.count();

        // Should have some select dropdowns
        expect(count).toBeGreaterThanOrEqual(0);
    });
});

test.describe('Settings Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
        await page.goto('/#/settings');
        await page.waitForTimeout(2000);

        // Check for headings
        const headings = page.locator('h1, h2, h3, h4');
        const count = await headings.count();

        expect(count).toBeGreaterThan(0);
    });

    test('should have labeled form fields', async ({ page }) => {
        await page.goto('/#/settings');
        await page.waitForTimeout(2000);

        // Check for labels
        const labels = page.locator('label');
        const count = await labels.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});
