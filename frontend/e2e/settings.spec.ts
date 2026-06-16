import { test, expect } from '@playwright/test';
import { mockWails } from './mock-wails';

test.setTimeout(90000);

test.describe('Settings & Staff Scenario', () => {
    test.beforeEach(async ({ page }) => {
        await mockWails(page);
        await page.goto('/#/settings');
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
                    await page.waitForTimeout(4000); // Wait for login animation and redirection to settings
                }
            }
        }
    });

    test('should modify store preferences and manage staff accounts', async ({ page }) => {
        // 1. Assert we are on the settings URL
        await expect(page).toHaveURL(/.*settings/);

        // 2. Modify Store Preferences (Store Name)
        const storeNameInput = page.locator('input[placeholder="مثال: سوبرماركت الأمل"]').first();
        await expect(storeNameInput).toBeVisible();
        await storeNameInput.fill('بيدر برو Beidar Pro');

        // Verify save button becomes active (hasChanges is true)
        const saveChangesBtn = page.locator('button').filter({ hasText: /حفظ التغييرات/i }).first();
        await expect(saveChangesBtn).toBeVisible();
        await expect(saveChangesBtn).toBeEnabled();

        // Click save button and verify it becomes inactive after success ("محفوظ")
        await saveChangesBtn.click();
        await page.waitForTimeout(2000);

        const savedBtn = page.locator('button').filter({ hasText: /محفوظ/i }).first();
        await expect(savedBtn).toBeVisible();

        // 3. Switch to Security Tab ("الأمان")
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
});
