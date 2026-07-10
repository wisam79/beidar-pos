import { test, expect } from '@playwright/test';
import { mockWails } from './mock-wails';

test.setTimeout(90000);

test.describe('Finance & Treasury (Shifts) Scenario', () => {
    test.beforeEach(async ({ page }) => {
        await mockWails(page);
        await page.goto('/#/finance');
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
                    await page.waitForTimeout(4000); // Wait for login animation and redirection to finance
                }
            }
        }
    });

    test('should perform complete finance, expenses, suppliers and shift management flow', async ({ page }) => {
        // --- 1. Finance & Expenses Flow ---
        await expect(page).toHaveURL(/.*finance/);

        // Verify page header
        const pageHeader = page.locator('h1').filter({ hasText: /الإدارة المالية/i }).first();
        await expect(pageHeader).toBeVisible();

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

        // Switch to "سجل المصروفات" Tab
        const expensesTab = page.locator('button').filter({ hasText: /سجل المصروفات/i }).first();
        await expect(expensesTab).toBeVisible();
        await expensesTab.click();
        await page.waitForTimeout(1000);

        // Verify test expense table or search input works
        const expenseSearchInput = page.locator('input[placeholder="بحث في المصروفات..."]').first();
        await expect(expenseSearchInput).toBeVisible();
        await expenseSearchInput.fill('الكهرباء'); // Mock list has "الكهرباء"
        await page.waitForTimeout(1000);

        // Verify delete expense button opens ConfirmModal
        const deleteExpenseBtn = page.locator('button[title="حذف المصروف"]').first();
        await expect(deleteExpenseBtn).toBeVisible();
        await deleteExpenseBtn.click();
        await page.waitForTimeout(1000);

        // Confirm deletion in confirm modal
        const confirmDeleteBtn = page.locator('button').filter({ hasText: /^حذف$/ }).first();
        await expect(confirmDeleteBtn).toBeVisible();
        await confirmDeleteBtn.click();
        await page.waitForTimeout(1000);

        // Clear search input to avoid filtering suppliers in the next tab
        await expenseSearchInput.fill('');
        await page.waitForTimeout(1000);

        // --- 2. Suppliers Flow ---
        const suppliersTab = page.locator('button').filter({ hasText: /قائمة الموردين/i }).first();
        await expect(suppliersTab).toBeVisible();
        await suppliersTab.click();
        await page.waitForTimeout(1000);

        // Verify Supplier card
        const supplierCardName = page.locator('p').filter({ hasText: /مورد تجريبي/i }).first();
        await expect(supplierCardName).toBeVisible();

        // Open "إدارة الموردين" modal
        const addSupplierBtn = page.locator('button').filter({ hasText: /إدارة الموردين/i }).first();
        await expect(addSupplierBtn).toBeVisible();
        await addSupplierBtn.click();
        await page.waitForTimeout(1000);

        const modalTitleSupplier = page.locator('h2').filter({ hasText: /بيانات المورد/i }).first();
        await expect(modalTitleSupplier).toBeVisible();

        // Close supplier modal via Close button
        const closeSupplierBtn = page.locator('button').filter({ hasText: /إغلاق|close|X/i }).first();
        if (await closeSupplierBtn.isVisible()) {
            await closeSupplierBtn.click();
        } else {
            await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(1000);
        await expect(modalTitleSupplier).not.toBeVisible();

        // --- 3. Shift Management (Treasury) Flow ---
        // Go to shifts page
        await page.goto('/#/shifts');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Verify shifts page title
        const shiftsHeader = page.locator('h1').filter({ hasText: /إدارة الشفتات/i }).first();
        await expect(shiftsHeader).toBeVisible();

        // If there's an active shift, perform Cash In / Cash Out and Close
        const activeShiftBadge = page.locator('span').filter({ hasText: /شفت مفتوح/i }).first();
        if (await activeShiftBadge.isVisible().catch(() => false)) {
            // Perform Deposit (إيداع)
            const depositBtn = page.locator('button').filter({ hasText: /^إيداع$/ }).first();
            await expect(depositBtn).toBeVisible();
            await depositBtn.click();
            await page.waitForTimeout(1000);

            const depositInput = page.locator('input[type="number"]').first();
            await expect(depositInput).toBeVisible();
            await depositInput.fill('500');

            const depositReasonInput = page.locator('input[placeholder="مثال: إضافة فكة"]').first();
            await expect(depositReasonInput).toBeVisible();
            await depositReasonInput.fill('زيادة فكة تجريبية');

            const confirmDepositBtn = page.locator('button').filter({ hasText: /تأكيد الإيداع/i }).first();
            await expect(confirmDepositBtn).toBeVisible();
            await confirmDepositBtn.click();
            await page.waitForTimeout(1500);

            // Perform Withdrawal (سحب)
            const withdrawBtn = page.locator('button').filter({ hasText: /^سحب$/ }).first();
            await expect(withdrawBtn).toBeVisible();
            await withdrawBtn.click();
            await page.waitForTimeout(1000);

            const withdrawInput = page.locator('input[type="number"]').first();
            await expect(withdrawInput).toBeVisible();
            await withdrawInput.fill('200');

            const withdrawReasonInput = page.locator('input[placeholder="مثال: سحب للمصروفات"]').first();
            await expect(withdrawReasonInput).toBeVisible();
            await withdrawReasonInput.fill('سحب مصروف تجريبي');

            const confirmWithdrawBtn = page.locator('button').filter({ hasText: /تأكيد السحب/i }).first();
            await expect(confirmWithdrawBtn).toBeVisible();
            await confirmWithdrawBtn.click();
            await page.waitForTimeout(1500);

            // Close Shift
            const closeShiftBtn = page.locator('button').filter({ hasText: /إغلاق الشفت الحالي/i }).first();
            await expect(closeShiftBtn).toBeVisible();
            await closeShiftBtn.click();
            await page.waitForTimeout(1000);

            const closeConfirmBtn = page.locator('button').filter({ hasText: /تأكيد الإغلاق النهائي/i }).first();
            await expect(closeConfirmBtn).toBeVisible();
            await closeConfirmBtn.click();
            await page.waitForTimeout(2000);
        }

        // Now shift is closed, open a new shift
        const openNewShiftBtn = page.locator('button').filter({ hasText: /فتح شفت جديد/i }).first();
        await expect(openNewShiftBtn).toBeVisible();
        await openNewShiftBtn.click();
        await page.waitForTimeout(1000);

        const openBalanceInput = page.locator('input[type="number"]').first();
        await expect(openBalanceInput).toBeVisible();
        await openBalanceInput.fill('1000');

        const confirmOpenBtn = page.locator('button').filter({ hasText: /تأكيد وفتح الشفت/i }).first();
        await expect(confirmOpenBtn).toBeVisible();
        await confirmOpenBtn.click();
        await page.waitForTimeout(2000);

        // Verify active shift badge appears again
        await expect(activeShiftBadge).toBeVisible();
    });
});
