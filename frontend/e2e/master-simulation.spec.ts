import { test, expect } from '@playwright/test';
import { mockWails } from './mock-wails';

test.setTimeout(120000); // 2 minutes for full scenario

test.describe('Master Simulation: Full E2E Business Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Inject our stateful Wails mock endpoints
        await mockWails(page);
        
        // Start at root
        await page.goto('/#/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // Handle pin-login if we land on POS/Sales first and it prompts
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
                    await page.waitForTimeout(4000); 
                }
            }
        }
    });

    test('should simulate the entire application lifecycle continuously', async ({ page }) => {
        
        // ==========================================
        // STEP 1: SETTINGS & STAFF MANAGEMENT
        // ==========================================
        await test.step('Step 1: Settings and Staff Configuration', async () => {
            await page.goto('/#/settings');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);

            // Switch to Security Tab ("الأمان")
            const securityTabBtn = page.locator('button').filter({ hasText: /^الأمان$/ }).first();
            await expect(securityTabBtn).toBeVisible();
            await securityTabBtn.click();
            await page.waitForTimeout(1000);

            // Click "إدارة الموظفين" button to open Staff Manager
            const manageStaffBtn = page.locator('button').filter({ hasText: /إدارة الموظفين/i }).first();
            await expect(manageStaffBtn).toBeVisible();
            await manageStaffBtn.click();
            await page.waitForTimeout(1500);

            // Verify StaffManager Modal is open
            const modalTitle = page.locator('h2').filter({ hasText: /إدارة الموظفين/i }).first();
            await expect(modalTitle).toBeVisible();

            // Click "إضافة موظف" button to open the form
            const addStaffBtn = page.locator('button').filter({ hasText: /إضافة موظف/i }).first();
            await expect(addStaffBtn).toBeVisible();
            await addStaffBtn.click();
            await page.waitForTimeout(1000);

            // Fill out staff details
            const fullNameInput = page.locator('input[title="الاسم الكامل"]').first();
            await expect(fullNameInput).toBeVisible();
            await fullNameInput.fill('كاشير جديد E2E');

            const usernameInput = page.locator('input[title="اسم المستخدم"]').first();
            await expect(usernameInput).toBeVisible();
            await usernameInput.fill('cashier_e2e');

            const pinInput = page.locator('input[title="رمز PIN"]').first();
            await expect(pinInput).toBeVisible();
            await pinInput.fill('1111');

            const phoneInput = page.locator('input[title="رقم الهاتف"]').first();
            await expect(phoneInput).toBeVisible();
            await phoneInput.fill('07701234567');

            const emailInput = page.locator('input[title="البريد الإلكتروني"]').first();
            await expect(emailInput).toBeVisible();
            await emailInput.fill('cashier@e2e.com');

            // Select Role: Cashier ("كاشير")
            const roleSelect = page.locator('select[title="صلاحية الموظف"]').first();
            await expect(roleSelect).toBeVisible();
            await roleSelect.selectOption('cashier');

            // Submit the form
            const submitBtn = page.locator('button').filter({ hasText: /^إضافة الموظف$/ }).first();
            await expect(submitBtn).toBeVisible();
            await submitBtn.click();
            await page.waitForTimeout(2000);

            // Verify the new staff member is listed in the Staff list
            const newStaffCard = page.locator('h4').filter({ hasText: /كاشير جديد E2E/i }).first();
            await expect(newStaffCard).toBeVisible();

            // Close the modal
            const staffManagerModal = page.locator('div.fixed').filter({ hasText: 'إدارة الموظفين' });
            const closeBtn = staffManagerModal.locator('button[title="إغلاق"]').first();
            await expect(closeBtn).toBeVisible();
            await closeBtn.click();
            await page.waitForTimeout(1000);

            // Verify modal is closed
            await expect(modalTitle).not.toBeVisible();
        });

        // ==========================================
        // STEP 2: INVENTORY & PRODUCT MANAGEMENT
        // ==========================================
        await test.step('Step 2: Inventory Check & Adjustment', async () => {
            await page.goto('/#/inventory');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);

            // Expect to see Inventory title
            await expect(page.locator('h1').filter({ hasText: 'المخزون' }).first()).toBeVisible();

            // Search for product
            const searchInput = page.locator('input[placeholder*="بحث"]').first();
            await searchInput.fill('Test Product');
            await page.waitForTimeout(500);

            // Adjust stock
            const adjustBtn = page.locator('button[title*="تعديل"], button[title*="adjust"]').first();
            if (await adjustBtn.isVisible().catch(() => false)) {
                await adjustBtn.click();
                await page.waitForTimeout(500);

                const typeSelect = page.locator('select').first();
                await typeSelect.selectOption('in');

                const qtyInput = page.locator('input[type="number"]').first();
                await qtyInput.fill('10');

                const notesInput = page.locator('textarea').first();
                await notesInput.fill('E2E Simulation Stocking');

                const confirmBtn = page.locator('button').filter({ hasText: /حفظ|تأكيد/ }).first();
                await confirmBtn.click();
                await page.waitForTimeout(1000);
            }
        });

        // ==========================================
        // STEP 3: POINT OF SALE (SALES)
        // ==========================================
        await test.step('Step 3: Point of Sale Transaction', async () => {
            await page.goto('/#/sales');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);

            // Select Customer
            const customerBtn = page.locator('button').filter({ hasText: /عميل|customer|زبون|guest/i }).last();
            await expect(customerBtn).toBeVisible();
            await customerBtn.click();
            await page.waitForTimeout(1000);

            const customerOption = page.locator('p').filter({ hasText: /^عميل تجريبي$/ }).first();
            await expect(customerOption).toBeVisible();
            await customerOption.click();
            await page.waitForTimeout(1000);

            // Add Product to Cart
            const searchInput = page.locator('input[placeholder*="بحث"], input[placeholder*="search"]').first();
            await searchInput.click();
            await searchInput.fill('Test Product');
            await page.waitForTimeout(500);

            const productCard = page.locator('h3:has-text("Test Product"), button:has-text("Test Product")').first();
            await expect(productCard).toBeVisible();
            await productCard.click();
            await page.waitForTimeout(1000);

            // Checkout
            const checkoutBtn = page.locator('button').filter({ hasText: /بيع|confirm|checkout|pay/i }).last();
            await expect(checkoutBtn).toBeVisible();
            await checkoutBtn.click();
            await page.waitForTimeout(1500);

            const emptyCartMsg = page.locator('p:has-text("السلة فارغة")').first();
            await expect(emptyCartMsg).toBeVisible();
        });

        // ==========================================
        // STEP 4: INVOICES & RETURNS
        // ==========================================
        await test.step('Step 4: Invoice Verification and Return', async () => {
            await page.goto('/#/invoices');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1500);

            // Verify invoice exists
            const invoiceCard = page.locator('p:has-text("INV-123456"), div:has-text("INV-123456")').first();
            await expect(invoiceCard).toBeVisible();
            await invoiceCard.click();
            await page.waitForTimeout(1500);

            // Initiate Return
            const returnBtn = page.locator('button[title*="استرجاع"]').first();
            await expect(returnBtn).toBeVisible();
            await returnBtn.click();
            await page.waitForTimeout(1000);

            const confirmReturnBtn = page.locator('button').filter({ hasText: /نعم، إرجاع|إرجاع|confirm/i }).first();
            await expect(confirmReturnBtn).toBeVisible();
            await confirmReturnBtn.click();
            await page.waitForTimeout(1500);
        });

        // ==========================================
        // STEP 5: CRM (DEBTS & INSTALLMENTS)
        // ==========================================
        await test.step('Step 5: CRM Debt Management', async () => {
            await page.goto('/#/customers');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);

            // Verify customer card exists
            const customerCard = page.locator('h3:has-text("عميل تجريبي")').first();
            await expect(customerCard).toBeVisible();

            // Pay general debt
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
        });

        // ==========================================
        // STEP 6: FINANCE (TREASURY)
        // ==========================================
        await test.step('Step 6: Treasury & Expense Tracking', async () => {
            await page.goto('/#/finance');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);

            // Click "تسجيل مصروف" button
            const recordExpenseBtn = page.locator('button').filter({ hasText: /تسجيل مصروف/i }).first();
            await expect(recordExpenseBtn).toBeVisible();
            await recordExpenseBtn.click();
            await page.waitForTimeout(1000);

            // Fill Expense Form Modal
            const modalTitleExpense = page.locator('h2').filter({ hasText: /تسجيل مصروف جديد/i }).first();
            await expect(modalTitleExpense).toBeVisible();

            const expenseTitleInput = page.locator('input[placeholder="مثال: فاتورة مولدة"]').first();
            await expect(expenseTitleInput).toBeVisible();
            await expenseTitleInput.fill('فاتورة كهرباء E2E');

            const expenseAmountInput = page.locator('input[title="المبلغ"]').first();
            await expect(expenseAmountInput).toBeVisible();
            await expenseAmountInput.fill('2500');

            // Choose category
            const categorySelect = page.locator('select[title="اختر الفئة"]').first();
            await expect(categorySelect).toBeVisible();
            await categorySelect.selectOption('bills');
            await page.waitForTimeout(500);

            // Click save
            const saveExpenseBtn = page.locator('button').filter({ hasText: /^حفظ$/ }).first();
            await expect(saveExpenseBtn).toBeVisible();
            await saveExpenseBtn.click();
            await page.waitForTimeout(1500);

            // Verify modal is closed
            await expect(modalTitleExpense).not.toBeVisible();
        });

        // ==========================================
        // STEP 7: STATISTICS & DASHBOARD
        // ==========================================
        await test.step('Step 7: Dashboard Verification', async () => {
            await page.goto('/#/dashboard');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);

            // Validate Revenue Card
            const revenueCard = page.locator('span').filter({ hasText: /^الإيرادات$/ }).first();
            await expect(revenueCard).toBeVisible();

            // Validate Products Card
            const productsCard = page.locator('span').filter({ hasText: /^المنتجات$/ }).first();
            await expect(productsCard).toBeVisible();

            // End of master simulation!
            await page.waitForTimeout(1000);
        });
    });
});
