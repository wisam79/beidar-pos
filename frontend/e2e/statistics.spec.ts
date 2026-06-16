import { test, expect } from '@playwright/test';
import { mockWails } from './mock-wails';

test.setTimeout(90000);

test.describe('Dashboard & Statistics Scenario', () => {
    test.beforeEach(async ({ page }) => {
        await mockWails(page);
        await page.goto('/#/dashboard');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // Handle pin-login if needed
        const selectAccountText = page.locator('h2').filter({ hasText: /اختر حسابك|اختر الحساب|Select your account/i }).first();
        if (await selectAccountText.isVisible().catch(() => false)) {
            const adminButton = page.locator('button').filter({ hasText: /Admin|admin/i }).first();
            if (await adminButton.isVisible().catch(() => false)) {
                await adminButton.click();
                await page.waitForTimeout(800);

                const zeroButton = page.locator('button').filter({ hasText: /^0$/ }).first();
                if (await zeroButton.isVisible().catch(() => false)) {
                    await zeroButton.click();
                    await page.waitForTimeout(150);
                    await zeroButton.click();
                    await page.waitForTimeout(150);
                    await zeroButton.click();
                    await page.waitForTimeout(150);
                    await zeroButton.click();
                    await page.waitForTimeout(4000); // Wait for login animation and redirection to dashboard
                }
            }
        }
    });

    test('should display dashboard statistics, charts, widgets and quick actions', async ({ page }) => {
        // --- 1. Header welcome and AI Advisor ---
        await expect(page).toHaveURL(/.*dashboard/);

        const welcomeHeader = page.locator('h1').filter({ hasText: /مرحباً،/i }).first();
        await expect(welcomeHeader).toBeVisible();

        const advisorBtn = page.locator('button').filter({ hasText: /المستشار الذكي/i }).first();
        await expect(advisorBtn).toBeVisible();
        await advisorBtn.click();
        await page.waitForTimeout(1500);
        await expect(page).toHaveURL(/.*reports/);

        // Go back to dashboard
        await page.goto('/#/dashboard');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // --- 2. Stat Cards ---
        // Validate Revenue Card
        const revenueCard = page.locator('span').filter({ hasText: /^الإيرادات$/ }).first();
        await expect(revenueCard).toBeVisible();

        // Validate Orders Card
        const ordersCard = page.locator('span').filter({ hasText: /^الطلبات$/ }).first();
        await expect(ordersCard).toBeVisible();

        // Validate Products Card
        const productsCard = page.locator('span').filter({ hasText: /^المنتجات$/ }).first();
        await expect(productsCard).toBeVisible();

        // Validate Alerts Card
        const alertsCard = page.locator('span').filter({ hasText: /^التنبيهات$/ }).first();
        await expect(alertsCard).toBeVisible();

        // --- 3. Filter Controls & Charts ---
        // Locate filter options
        const dayFilter = page.locator('button').filter({ hasText: /^يوم$/ }).first();
        const monthFilter = page.locator('button').filter({ hasText: /^شهر$/ }).first();
        const weekFilter = page.locator('button').filter({ hasText: /^أسبوع$/ }).first();

        await expect(weekFilter).toBeVisible();
        await expect(dayFilter).toBeVisible();
        await expect(monthFilter).toBeVisible();

        // Click "يوم" and wait
        await dayFilter.click();
        await page.waitForTimeout(1000);

        // Click "شهر" and wait
        await monthFilter.click();
        await page.waitForTimeout(1000);

        // Check if chart element or container is visible
        const chartTitle = page.locator('h3').filter({ hasText: /تحليل الإيرادات/i }).first();
        await expect(chartTitle).toBeVisible();

        // --- 4. Sidebar Widgets ---
        // Recent Transactions
        const recentTransTitle = page.locator('h3').filter({ hasText: /أحدث المعاملات/i }).first();
        await expect(recentTransTitle).toBeVisible();
        // Check mock sale ID (displays last 4 digits: 3456)
        const mockInvoiceId = page.locator('p').filter({ hasText: /3456/i }).first();
        await expect(mockInvoiceId).toBeVisible();

        // Top Selling Product
        const topSellingTitle = page.locator('h4').filter({ hasText: /الأكثر مبيعاً/i }).first();
        await expect(topSellingTitle).toBeVisible();
        const topSellingProduct = page.locator('span').filter({ hasText: /عصير برتقال طبيعي/i }).first();
        await expect(topSellingProduct).toBeVisible();

        // Top Customer
        const topCustomerTitle = page.locator('h4').filter({ hasText: /أفضل العملاء/i }).first();
        await expect(topCustomerTitle).toBeVisible();
        const topCustomerName = page.locator('span').filter({ hasText: /عميل تجريبي/i }).first();
        await expect(topCustomerName).toBeVisible();

        // --- 5. Quick Actions ---
        const quickSalesBtn = page.locator('button').filter({ hasText: /بيع سريع/i }).first();
        await expect(quickSalesBtn).toBeVisible();
        await quickSalesBtn.click();
        await page.waitForTimeout(1500);
        await expect(page).toHaveURL(/.*sales/);

        // Go back to dashboard
        await page.goto('/#/dashboard');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        const quickProductBtn = page.locator('button').filter({ hasText: /مادة جديدة/i }).first();
        await expect(quickProductBtn).toBeVisible();
        await quickProductBtn.click();
        await page.waitForTimeout(1500);
        await expect(page).toHaveURL(/.*products/);
    });
});
