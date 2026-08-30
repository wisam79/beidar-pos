import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ImportExportModal } from '../components/ImportExportModal';
import { ChangePasswordModal } from '../components/ChangePasswordModal';

describe('UI Import/Export & Security Modals Tests', () => {
    let mockOnClose: () => void;
    let mockNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
    let mockOnSuccess: () => void;

    let callsClose = 0;

    beforeEach(() => {
        callsClose = 0;

        mockOnClose = () => { callsClose++; };
        mockNotify = () => { };
        mockOnSuccess = () => { };
    });

    // ── ImportExportModal Tests ─────────────────────────────────────────────
    it('1. should not render ImportExportModal when isOpen is false', () => {
        render(
            <ImportExportModal
                isOpen={false}
                onClose={mockOnClose}
                notify={mockNotify}
            />
        );

        expect(screen.queryByText('استيراد / تصدير المنتجات')).not.toBeInTheDocument();
    });

    it('2. should render Export tab by default with export button and instructions', () => {
        render(
            <ImportExportModal
                isOpen={true}
                onClose={mockOnClose}
                notify={mockNotify}
            />
        );

        expect(screen.getByText('استيراد / تصدير المنتجات')).toBeInTheDocument();
        expect(screen.getByText('تصدير المنتجات CSV')).toBeInTheDocument();
        expect(screen.getByText('معلومات التصدير')).toBeInTheDocument();
    });

    it('3. should switch between Export and Import tabs when clicked', () => {
        render(
            <ImportExportModal
                isOpen={true}
                onClose={mockOnClose}
                notify={mockNotify}
            />
        );

        const importTabBtn = screen.getByRole('button', { name: /استيراد/ });
        fireEvent.click(importTabBtn);

        expect(screen.getByText('اسحب ملف CSV هنا')).toBeInTheDocument();
        expect(screen.getByText('تحديث المنتجات الموجودة')).toBeInTheDocument();
        expect(screen.getByText('تحميل قالب CSV')).toBeInTheDocument();
    });

    it('4. should toggle update existing products checkbox in import tab', () => {
        render(
            <ImportExportModal
                isOpen={true}
                onClose={mockOnClose}
                notify={mockNotify}
            />
        );

        const importTabBtn = screen.getByRole('button', { name: /استيراد/ });
        fireEvent.click(importTabBtn);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();

        fireEvent.click(checkbox);
        expect(checkbox).toBeChecked();
    });

    it('5. should call onClose when clicking modal close button', () => {
        render(
            <ImportExportModal
                isOpen={true}
                onClose={mockOnClose}
                notify={mockNotify}
            />
        );

        const allButtons = screen.getAllByRole('button');
        // The header close button is the first button rendered in the modal
        const closeBtn = allButtons[0];
        fireEvent.click(closeBtn);

        expect(callsClose).toBe(1);
    });

    // ── ChangePasswordModal Tests ───────────────────────────────────────────
    it('6. should render ChangePasswordModal with PIN input fields', () => {
        render(
            <ChangePasswordModal
                isOpen={true}
                staffId="staff-1"
                onSuccess={mockOnSuccess}
                onClose={mockOnClose}
            />
        );

        expect(screen.getByText('تغيير رمز PIN')).toBeInTheDocument();
        expect(screen.getByLabelText('رمز PIN الجديد')).toBeInTheDocument();
        expect(screen.getByLabelText('تأكيد رمز PIN')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /تأكيد رمز PIN/ })).toBeInTheDocument();
    });

    it('7. should not render ChangePasswordModal when isOpen is false', () => {
        render(
            <ChangePasswordModal
                isOpen={false}
                staffId="staff-1"
                onSuccess={mockOnSuccess}
                onClose={mockOnClose}
            />
        );

        expect(screen.queryByText('تغيير رمز PIN')).not.toBeInTheDocument();
    });

    it('8. should disable submit button when PIN is shorter than 4 digits', () => {
        render(
            <ChangePasswordModal
                isOpen={true}
                staffId="staff-1"
                onSuccess={mockOnSuccess}
                onClose={mockOnClose}
            />
        );

        const submitBtn = screen.getByRole('button', { name: /تأكيد رمز PIN/ });
        expect(submitBtn).toBeDisabled();
    });

    it('9. should hide cancel button when isForced is true', () => {
        render(
            <ChangePasswordModal
                isOpen={true}
                staffId="staff-1"
                isForced={true}
                onSuccess={mockOnSuccess}
                onClose={mockOnClose}
            />
        );

        expect(screen.queryByRole('button', { name: /إلغاء/ })).not.toBeInTheDocument();
        expect(screen.getByText('يجب تغيير الرمز الافتراضي للمتابعة')).toBeInTheDocument();
    });

    it('10. should show cancel button and trigger onClose when isForced is false', () => {
        render(
            <ChangePasswordModal
                isOpen={true}
                staffId="staff-1"
                isForced={false}
                onSuccess={mockOnSuccess}
                onClose={mockOnClose}
            />
        );

        const cancelBtn = screen.getByRole('button', { name: /إلغاء/ });
        expect(cancelBtn).toBeInTheDocument();
        fireEvent.click(cancelBtn);

        expect(callsClose).toBe(1);
    });
});
