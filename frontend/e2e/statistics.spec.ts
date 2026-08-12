import { test, expect } from '@playwright/test';
import { mockWails, ensureLoggedIn } from './mock-wails';

test.setTimeout(90000);

test.describe('Dashboard & Statistics Scenario', () => {
    test.beforeEach(async ({ page }) => {
        await mockWails(page);
        await ensureLoggedIn(page, '/#/dashboard');
    });

    test('should display dashboard sections and reports analytics', async ({ page }) => {
        // --- 1. Dashboard Tactile Grid ---
        await expect(page).toHaveURL(/.*dashboard/);

        // Verify key dashboard tactile buttons
        const salesSection = page.locator('button').filter({ hasText: /المبيعات/i }).first();
        await expect(salesSection).toBeVisible();

        const productsSection = page.locator('button').filter({ hasText: /المخزون/i }).first();
        await expect(productsSection).toBeVisible();

        const reportsSection = page.locator('button').filter({ hasText: /التقارير/i }).first();
        await expect(reportsSection).toBeVisible();

        // --- 2. Navigate to Reports ---
        await reportsSection.click();
        await page.waitForTimeout(1500);
        await expect(page).toHaveURL(/.*reports/);

        // --- 3. Verify Reports Tabs ---
        const overviewTab = page.locator('button').filter({ hasText: /نظرة عامة/i }).first();
        await expect(overviewTab).toBeVisible();

        const salesTab = page.locator('button').filter({ hasText: /المبيعات/i }).first();
        await expect(salesTab).toBeVisible();

        // --- 4. Switch Tabs in Reports ---
        await salesTab.click();
        await page.waitForTimeout(1000);

        const customersTab = page.locator('button').filter({ hasText: /العملاء/i }).first();
        await expect(customersTab).toBeVisible();
        await customersTab.click();
        await page.waitForTimeout(1000);

        // --- 5. Return to Dashboard ---
        await page.goto('/#/dashboard');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        await expect(page).toHaveURL(/.*dashboard/);
    });
});

