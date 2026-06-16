import { test, expect } from '@playwright/test';
import { mockWails } from './mock-wails';

test.setTimeout(90000);

test.describe('CRM: Debts & Installments Scenario', () => {
    test.beforeEach(async ({ page }) => {
        await mockWails(page);
        await page.goto('/#/customers');
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
                    await page.waitForTimeout(4000); // Wait for login animation and redirection to customers
                }
            }
        }
    });

    test('should manage debts and pay installments for customers', async ({ page }) => {
        // 1. Assert we are on the customers page
        await expect(page).toHaveURL(/.*customers/);

        // 2. Verify customer card exists
        const customerCard = page.locator('h3:has-text("عميل تجريبي")').first();
        await expect(customerCard).toBeVisible();

        // 3. Pay general debt
        const payDebtBtn = page.locator('button').filter({ hasText: /تسديد/i }).first();
        await expect(payDebtBtn).toBeVisible();
        await payDebtBtn.click();
        await page.waitForTimeout(1000);

        // Assert Pay Debt modal title
        const modalTitlePay = page.locator('h2:has-text("تسديد دفعة")').first();
        await expect(modalTitlePay).toBeVisible();

        // Fill pay amount input
        const payAmountInput = page.locator('input#payAmount').first();
        await expect(payAmountInput).toBeVisible();
        await payAmountInput.fill('2000');
        await page.waitForTimeout(500);

        // Click confirm payment inside modal
        const confirmPayBtn = page.locator('button').filter({ hasText: /تأكيد الدفع/i }).first();
        await expect(confirmPayBtn).toBeVisible();
        await confirmPayBtn.click();
        await page.waitForTimeout(1500);

        // Assert Pay Debt modal closes
        await expect(modalTitlePay).not.toBeVisible();

        // 4. View and pay installments
        const installmentsBtn = page.locator('button').filter({ hasText: /أقساط/i }).first();
        await expect(installmentsBtn).toBeVisible();
        await installmentsBtn.click();
        await page.waitForTimeout(1500);

        // Assert Installments modal is visible
        const modalTitleInst = page.locator('h2:has-text("الأقساط المستحقة")').first();
        await expect(modalTitleInst).toBeVisible();

        // Find "تسديد الآن" button for mock installment INV-789101
        const payNowBtn = page.locator('button').filter({ hasText: /تسديد الآن/i }).first();
        await expect(payNowBtn).toBeVisible();
        await payNowBtn.click();
        await page.waitForTimeout(1500);

        // Close installments modal
        const closeBtn = page.locator('button').filter({ hasText: /close|إغلاق/i }).first();
        if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click();
        } else {
            // Alternatively press Escape key
            await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(1000);
        await expect(modalTitleInst).not.toBeVisible();
    });
});
