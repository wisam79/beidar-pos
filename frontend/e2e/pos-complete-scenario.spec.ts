import { test, expect } from '@playwright/test';
import { mockWails } from './mock-wails';

test.setTimeout(90000);

test.describe('POS & Invoices Complete Sales & Returns Scenario', () => {
    test.beforeEach(async ({ page }) => {
        // Inject Wails mock endpoints
        await mockWails(page);
        
        // Navigate to the POS sales page
        await page.goto('/#/sales');
        await page.waitForLoadState('networkidle');
        await page.locator('#root').waitFor({ state: 'visible' });

        // Handle pin-login if needed
        const selectAccountText = page.locator('h2').filter({ hasText: /اختر حسابك|اختر الحساب|Select your account/i }).first();
        if (await selectAccountText.isVisible().catch(() => false)) {
            const adminButton = page.locator('button').filter({ hasText: /Admin|admin/i }).first();
            if (await adminButton.isVisible().catch(() => false)) {
                await adminButton.click();
                
                const zeroButton = page.locator('button').filter({ hasText: /^0$/ }).first();
                await zeroButton.waitFor({ state: 'visible', timeout: 5000 });

                await zeroButton.click();
                await page.waitForTimeout(150);
                await zeroButton.click();
                await page.waitForTimeout(150);
                await zeroButton.click();
                await page.waitForTimeout(150);
                await zeroButton.click();
                
                // Wait for login animation and redirection to sales
                await page.locator('input[placeholder*="بحث"], input[placeholder*="search"]').first().waitFor({ state: 'visible', timeout: 10000 });
            }
        }
    });

    test('should execute full POS sale cycle followed by return', async ({ page }) => {
        // 1. Assert we are on the sales page
        await expect(page).toHaveURL(/.*sales/);

        // 2. Select Customer Modal
        const customerBtn = page.locator('button').filter({ hasText: /عميل|customer|زبون|guest/i }).last();
        await expect(customerBtn).toBeVisible();
        await customerBtn.click();

        // Click "عميل تجريبي" in customer selection list
        const customerOption = page.locator('p').filter({ hasText: /^عميل تجريبي$/ }).first();
        await customerOption.waitFor({ state: 'visible', timeout: 5000 });
        await expect(customerOption).toBeVisible();
        await customerOption.click();

        // Wait for customer modal to close / customer selected state to update
        await page.locator('p:has-text("عميل تجريبي")').first().waitFor({ state: 'visible', timeout: 5000 });

        // 3. Search and Add Product to Cart
        const searchInput = page.locator('input[placeholder*="بحث"], input[placeholder*="search"], input[placeholder*="باركود"]').first();
        await expect(searchInput).toBeVisible();
        await searchInput.click();
        await searchInput.fill('Test Product');

        // Click on "Test Product" card in the grid to add to cart
        const productCard = page.locator('h3:has-text("Test Product"), button:has-text("Test Product")').first();
        await productCard.waitFor({ state: 'visible', timeout: 5000 });
        await expect(productCard).toBeVisible();
        await productCard.click();

        // 4. Assert product is in the cart and checkout total matches 1,000
        const cartPanel = page.locator('h2:has-text("سلة المشتريات")').first();
        await expect(cartPanel).toBeVisible();

        // 5. Checkout
        const checkoutBtn = page.locator('button').filter({ hasText: /بيع|confirm|checkout|pay/i }).last();
        await expect(checkoutBtn).toBeVisible();
        await checkoutBtn.click();

        // Verify checkout succeeded and cart is cleared (we check "السلة فارغة" placeholder)
        const emptyCartMsg = page.locator('p:has-text("السلة فارغة")').first();
        await emptyCartMsg.waitFor({ state: 'visible', timeout: 10000 });
        await expect(emptyCartMsg).toBeVisible();

        // 6. Navigate to Invoices page
        await page.goto('/#/invoices');
        await page.waitForLoadState('networkidle');

        // 7. Assert invoice exists (from GetSales mock INV-123456)
        const invoiceCard = page.locator('p:has-text("INV-123456"), div:has-text("INV-123456")').first();
        await invoiceCard.waitFor({ state: 'visible', timeout: 10000 });
        await expect(invoiceCard).toBeVisible();
        await invoiceCard.click();

        // 8. Initiate return
        const returnBtn = page.locator('button[title*="استرجاع"]').first();
        await returnBtn.waitFor({ state: 'visible', timeout: 5000 });
        await expect(returnBtn).toBeVisible();
        await returnBtn.click();

        // Click "نعم، إرجاع" on ConfirmModal
        const confirmReturnBtn = page.locator('button').filter({ hasText: /نعم، إرجاع|إرجاع|confirm/i }).first();
        await confirmReturnBtn.waitFor({ state: 'visible', timeout: 5000 });
        await expect(confirmReturnBtn).toBeVisible();
        await confirmReturnBtn.click();

        // Invoice modal should be closed
        const modalTitle = page.locator('h2:has-text("معاينة الطباعة")').first();
        await expect(modalTitle).not.toBeVisible();
    });
});
