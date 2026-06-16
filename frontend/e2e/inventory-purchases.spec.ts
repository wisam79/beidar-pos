import { test, expect } from '@playwright/test';
import { mockWails } from './mock-wails';

test.setTimeout(90000);

test.describe('Inventory & Products Scenario', () => {
    test.beforeEach(async ({ page }) => {
        await mockWails(page);
        await page.goto('/#/products');
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
                    await page.waitForTimeout(4000); // Wait for login animation and redirection to products
                }
            }
        }
    });

    test('should add a new product and perform inventory quick adjustments', async ({ page }) => {
        // 1. Assert we are on the products management page
        await expect(page).toHaveURL(/.*products/);

        // 2. Click Add Product button
        const addProductBtn = page.locator('button').filter({ hasText: /إضافة منتج|Add Product/i }).first();
        await expect(addProductBtn).toBeVisible();
        await addProductBtn.click();
        await page.waitForTimeout(1500);

        // Assert ProductFormModal title
        const modalTitle = page.locator('h2').filter({ hasText: /إضافة منتج جديد|Add Product/i }).first();
        await expect(modalTitle).toBeVisible();

        // 3. Fill out the new product form
        // Product Name
        const nameInput = page.locator('input[placeholder="عصير برتقال طبيعي..."]').first();
        await nameInput.fill('عصير برتقال تجريبي');

        // Barcode
        const barcodeInput = page.locator('input[placeholder="Scan or type..."]').first();
        await barcodeInput.fill('999999');

        // Selling Price
        const priceInput = page.locator('label:has-text("سعر البيع") + div input').first();
        await priceInput.fill('2000');

        // Cost Price
        const costInput = page.locator('label:has-text("سعر التكلفة") + div input').first();
        await costInput.fill('1500');

        // Wholesale Price
        const wholesaleInput = page.locator('label:has-text("سعر الجملة") + div input').first();
        await wholesaleInput.fill('1800');

        // Inventory Stock
        const stockInput = page.locator('label:has-text("المخزون المتوفر") + input').first();
        await stockInput.fill('50');

        await page.waitForTimeout(500);

        // Click Save/Submit button
        const saveBtn = page.locator('button').filter({ hasText: /إضافة المنتج الجديد/i }).first();
        await expect(saveBtn).toBeVisible();
        await saveBtn.click();
        await page.waitForTimeout(2000);

        // Assert modal closes
        await expect(modalTitle).not.toBeVisible();

        // 4. Navigate to Inventory management tab
        await page.goto('/#/inventory');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Verify we are on inventory URL
        await expect(page).toHaveURL(/.*inventory/);

        // Verify mock products are listed
        const productRow = page.locator('p:has-text("Test Product")').first();
        await expect(productRow).toBeVisible();

        // Perform quick stock adjustment (plus button on hover/quick actions)
        const plusBtn = page.locator('button[title="زيادة المخزون"]').first();
        await expect(plusBtn).toBeVisible();
        await plusBtn.click();
        await page.waitForTimeout(1000);
    });
});
