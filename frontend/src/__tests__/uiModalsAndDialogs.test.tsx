import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmModal } from '../components/ConfirmModal';
import { PinModal } from '../components/PinModal';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { api } from '../core/api';

describe('UI Modals & Dialogs Component Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── ConfirmModal Tests ──────────────────────────────────────────────────
    it('11. should render ConfirmModal title, message, and buttons when open', () => {
        render(
            <ConfirmModal
                isOpen={true}
                title="تأكيد الحذف"
                message="هل أنت متأكد من حذف هذا السجل نهائياً؟"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        expect(screen.getByText('تأكيد الحذف')).toBeInTheDocument();
        expect(screen.getByText('هل أنت متأكد من حذف هذا السجل نهائياً؟')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'نعم' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'لا' })).toBeInTheDocument();
    });

    it('12. should not render ConfirmModal when isOpen is false', () => {
        render(
            <ConfirmModal
                isOpen={false}
                title="تأكيد الحذف"
                message="مخفي"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        expect(screen.queryByText('تأكيد الحذف')).not.toBeInTheDocument();
    });

    it('13. should trigger onConfirm callback when clicking confirm button', () => {
        const mockConfirm = vi.fn();
        render(
            <ConfirmModal
                isOpen={true}
                title="تأكيد العملية"
                message="يرجى التأكيد"
                confirmText="تأكيد ومتابعة"
                onConfirm={mockConfirm}
                onCancel={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'تأكيد ومتابعة' }));
        expect(mockConfirm).toHaveBeenCalledTimes(1);
    });

    it('14. should trigger onCancel callback when clicking cancel button or Escape', () => {
        const mockCancel = vi.fn();
        render(
            <ConfirmModal
                isOpen={true}
                title="إلغاء العملية"
                message="يرجى الإلغاء"
                cancelText="إلغاء"
                onConfirm={vi.fn()}
                onCancel={mockCancel}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
        expect(mockCancel).toHaveBeenCalledTimes(1);

        // Test Escape key
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(mockCancel).toHaveBeenCalledTimes(2);
    });

    it('15. should apply error styling for type="error"', () => {
        render(
            <ConfirmModal
                isOpen={true}
                title="خطأ فادح"
                message="عملية خطيرة"
                type="error"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        const confirmBtn = screen.getByRole('button', { name: 'نعم' });
        expect(confirmBtn.className).toContain('bg-danger');
    });

    // ── PinModal Tests ──────────────────────────────────────────────────────
    it('16. should render PinModal with title and 4 PIN placeholder dots', () => {
        render(
            <PinModal
                isOpen={true}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
                title="أدخل الرمز السري"
            />
        );

        expect(screen.getByText('أدخل الرمز السري')).toBeInTheDocument();
        expect(screen.getByText('أدخل رمز المدير للمتابعة')).toBeInTheDocument();
        expect(screen.getByText('----')).toBeInTheDocument();
    });

    it('17. should enter 4 digits in PinModal and call onSuccess on valid PIN', async () => {
        const mockSuccess = vi.fn();
        vi.spyOn(api.auth, 'verifyPin').mockResolvedValue(true);

        render(
            <PinModal
                isOpen={true}
                onClose={vi.fn()}
                onSuccess={mockSuccess}
            />
        );

        // Click digits 1, 2, 3, 4
        fireEvent.click(screen.getByRole('button', { name: '1' }));
        fireEvent.click(screen.getByRole('button', { name: '2' }));
        fireEvent.click(screen.getByRole('button', { name: '3' }));
        fireEvent.click(screen.getByRole('button', { name: '4' }));

        // Click submit button 'تأكيد'
        const submitBtn = screen.getByRole('button', { name: 'تأكيد' });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(api.auth.verifyPin).toHaveBeenCalledWith('1234');
            expect(mockSuccess).toHaveBeenCalledTimes(1);
        });
    });

    it('18. should handle invalid PIN gracefully and show error state in PinModal', async () => {
        const mockSuccess = vi.fn();
        vi.spyOn(api.auth, 'verifyPin').mockResolvedValue(false);

        render(
            <PinModal
                isOpen={true}
                onClose={vi.fn()}
                onSuccess={mockSuccess}
            />
        );

        // Enter wrong digits 9, 9, 9, 9
        const btn9 = screen.getByRole('button', { name: '9' });
        fireEvent.click(btn9);
        fireEvent.click(btn9);
        fireEvent.click(btn9);
        fireEvent.click(btn9);

        const submitBtn = screen.getByRole('button', { name: 'تأكيد' });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(api.auth.verifyPin).toHaveBeenCalledWith('9999');
            expect(mockSuccess).not.toHaveBeenCalled();
            expect(screen.getByText(/الرمز غير صحيح/)).toBeInTheDocument();
        });
    });

    it('19. should handle backspace deletion in PinModal', () => {
        render(
            <PinModal
                isOpen={true}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
            />
        );

        // Enter 1, 2
        fireEvent.click(screen.getByRole('button', { name: '1' }));
        fireEvent.click(screen.getByRole('button', { name: '2' }));
        expect(screen.getByText('••')).toBeInTheDocument();

        // Click backspace button with title 'مسح'
        const deleteBtn = screen.getByTitle('مسح');
        fireEvent.click(deleteBtn);
        expect(screen.getByText('•')).toBeInTheDocument();
    });

    // ── ShortcutsModal Tests ────────────────────────────────────────────────
    it('20. should render ShortcutsModal with standard keyboard shortcuts list', () => {
        const mockClose = vi.fn();
        render(
            <ShortcutsModal
                isOpen={true}
                onClose={mockClose}
            />
        );

        expect(screen.getByText('اختصارات لوحة المفاتيح')).toBeInTheDocument();
        expect(screen.getByText('نقطة البيع')).toBeInTheDocument();
        expect(screen.getByText('F2')).toBeInTheDocument();
        expect(screen.getByText('البحث السريع')).toBeInTheDocument();
        expect(screen.getByText('Ctrl+K')).toBeInTheDocument();
    });
});
