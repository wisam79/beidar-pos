import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryModal } from '../features/products/components/CategoryModal';
import { CategoryDef } from '../core/types';

describe('UI Product & Category Forms Tests', () => {
    let mockOnClose: () => void;
    let mockOnSaveCategory: () => void;
    let mockOnEditCategory: (cat: CategoryDef) => void;
    let mockOnDeleteCategory: (cat: CategoryDef) => void;
    let mockOnCancelEdit: () => void;

    let callsClose = 0;
    let callsSave = 0;
    let editedCat: CategoryDef | null = null;
    let deletedCat: CategoryDef | null = null;
    let callsCancel = 0;

    const sampleCategories: CategoryDef[] = [
        {
            id: 'cat-1',
            name: 'إلكترونيات',
            fields: [
                { name: 'الضمان', type: 'text' },
                { name: 'اللون', type: 'text' },
            ],
        },
        {
            id: 'cat-2',
            name: 'إكسسوارات',
            fields: [],
        },
    ];

    beforeEach(() => {
        callsClose = 0;
        callsSave = 0;
        editedCat = null;
        deletedCat = null;
        callsCancel = 0;

        mockOnClose = () => { callsClose++; };
        mockOnSaveCategory = () => { callsSave++; };
        mockOnEditCategory = (cat) => { editedCat = cat; };
        mockOnDeleteCategory = (cat) => { deletedCat = cat; };
        mockOnCancelEdit = () => { callsCancel++; };
    });

    it('1. should not render CategoryModal when isOpen is false', () => {
        render(
            <CategoryModal
                isOpen={false}
                onClose={mockOnClose}
                editingCategory={null}
                categories={sampleCategories}
                catForm={{ name: '' }}
                setCatForm={() => {}}
                newField={{ name: '', type: 'text', options: '' }}
                setNewField={() => {}}
                onSaveCategory={mockOnSaveCategory}
                onEditCategory={mockOnEditCategory}
                onDeleteCategory={mockOnDeleteCategory}
                onCancelEdit={mockOnCancelEdit}
            />
        );

        expect(screen.queryByText('إدارة الفئات')).not.toBeInTheDocument();
    });

    it('2. should render list of existing categories with custom field count', () => {
        render(
            <CategoryModal
                isOpen={true}
                onClose={mockOnClose}
                editingCategory={null}
                categories={sampleCategories}
                catForm={{ name: '' }}
                setCatForm={() => {}}
                newField={{ name: '', type: 'text', options: '' }}
                setNewField={() => {}}
                onSaveCategory={mockOnSaveCategory}
                onEditCategory={mockOnEditCategory}
                onDeleteCategory={mockOnDeleteCategory}
                onCancelEdit={mockOnCancelEdit}
            />
        );

        expect(screen.getByText('إدارة الفئات')).toBeInTheDocument();
        expect(screen.getByText('إلكترونيات')).toBeInTheDocument();
        expect(screen.getByText('إكسسوارات')).toBeInTheDocument();
    });

    it('3. should render category name input and save button', () => {
        render(
            <CategoryModal
                isOpen={true}
                onClose={mockOnClose}
                editingCategory={null}
                categories={sampleCategories}
                catForm={{ name: 'ملابس' }}
                setCatForm={() => {}}
                newField={{ name: '', type: 'text', options: '' }}
                setNewField={() => {}}
                onSaveCategory={mockOnSaveCategory}
                onEditCategory={mockOnEditCategory}
                onDeleteCategory={mockOnDeleteCategory}
                onCancelEdit={mockOnCancelEdit}
            />
        );

        expect(screen.getByPlaceholderText('اسم الفئة الجديدة')).toHaveValue('ملابس');
        const saveBtn = screen.getByRole('button', { name: /إضافة الفئة/ });
        expect(saveBtn).toBeInTheDocument();
    });

    it('4. should trigger onSaveCategory when save button is clicked', () => {
        render(
            <CategoryModal
                isOpen={true}
                onClose={mockOnClose}
                editingCategory={null}
                categories={sampleCategories}
                catForm={{ name: 'ملابس' }}
                setCatForm={() => {}}
                newField={{ name: '', type: 'text', options: '' }}
                setNewField={() => {}}
                onSaveCategory={mockOnSaveCategory}
                onEditCategory={mockOnEditCategory}
                onDeleteCategory={mockOnDeleteCategory}
                onCancelEdit={mockOnCancelEdit}
            />
        );

        const saveBtn = screen.getByRole('button', { name: /إضافة الفئة/ });
        fireEvent.click(saveBtn);
        expect(callsSave).toBe(1);
    });

    it('5. should trigger onEditCategory with selected category when edit button is clicked', () => {
        render(
            <CategoryModal
                isOpen={true}
                onClose={mockOnClose}
                editingCategory={null}
                categories={sampleCategories}
                catForm={{ name: '' }}
                setCatForm={() => {}}
                newField={{ name: '', type: 'text', options: '' }}
                setNewField={() => {}}
                onSaveCategory={mockOnSaveCategory}
                onEditCategory={mockOnEditCategory}
                onDeleteCategory={mockOnDeleteCategory}
                onCancelEdit={mockOnCancelEdit}
            />
        );

        const editBtns = screen.getAllByTitle('تعديل');
        fireEvent.click(editBtns[0]);

        expect(editedCat).toEqual(sampleCategories[0]);
    });

    it('6. should trigger onDeleteCategory when delete button is clicked', () => {
        render(
            <CategoryModal
                isOpen={true}
                onClose={mockOnClose}
                editingCategory={null}
                categories={sampleCategories}
                catForm={{ name: '' }}
                setCatForm={() => {}}
                newField={{ name: '', type: 'text', options: '' }}
                setNewField={() => {}}
                onSaveCategory={mockOnSaveCategory}
                onEditCategory={mockOnEditCategory}
                onDeleteCategory={mockOnDeleteCategory}
                onCancelEdit={mockOnCancelEdit}
            />
        );

        const deleteBtns = screen.getAllByTitle('حذف');
        fireEvent.click(deleteBtns[1]);

        expect(deletedCat).toEqual(sampleCategories[1]);
    });

    it('7. should display "تعديل الفئة" title when editingCategory is set', () => {
        render(
            <CategoryModal
                isOpen={true}
                onClose={mockOnClose}
                editingCategory={sampleCategories[0]}
                categories={sampleCategories}
                catForm={{ name: 'إلكترونيات معدلة' }}
                setCatForm={() => {}}
                newField={{ name: '', type: 'text', options: '' }}
                setNewField={() => {}}
                onSaveCategory={mockOnSaveCategory}
                onEditCategory={mockOnEditCategory}
                onDeleteCategory={mockOnDeleteCategory}
                onCancelEdit={mockOnCancelEdit}
            />
        );

        expect(screen.getByText('تعديل الفئة')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /حفظ التعديلات/ })).toBeInTheDocument();
    });

    it('8. should trigger onCancelEdit when cancel edit button is clicked', () => {
        render(
            <CategoryModal
                isOpen={true}
                onClose={mockOnClose}
                editingCategory={sampleCategories[0]}
                categories={sampleCategories}
                catForm={{ name: 'إلكترونيات معدلة' }}
                setCatForm={() => {}}
                newField={{ name: '', type: 'text', options: '' }}
                setNewField={() => {}}
                onSaveCategory={mockOnSaveCategory}
                onEditCategory={mockOnEditCategory}
                onDeleteCategory={mockOnDeleteCategory}
                onCancelEdit={mockOnCancelEdit}
            />
        );

        const cancelBtn = screen.getByRole('button', { name: /إلغاء$/ });
        fireEvent.click(cancelBtn);

        expect(callsCancel).toBe(1);
    });

    it('9. should render custom fields management section with add field inputs', () => {
        render(
            <CategoryModal
                isOpen={true}
                onClose={mockOnClose}
                editingCategory={null}
                categories={sampleCategories}
                catForm={{ name: '' }}
                setCatForm={() => {}}
                newField={{ name: '', type: 'text', options: '' }}
                setNewField={() => {}}
                onSaveCategory={mockOnSaveCategory}
                onEditCategory={mockOnEditCategory}
                onDeleteCategory={mockOnDeleteCategory}
                onCancelEdit={mockOnCancelEdit}
            />
        );

        expect(screen.getByText('حقول مخصصة (اختياري)')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('مثال: اللون')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'إضافة حقل' })).toBeInTheDocument();
    });

    it('10. should trigger modal onClose when clicking close button', () => {
        render(
            <CategoryModal
                isOpen={true}
                onClose={mockOnClose}
                editingCategory={null}
                categories={sampleCategories}
                catForm={{ name: '' }}
                setCatForm={() => {}}
                newField={{ name: '', type: 'text', options: '' }}
                setNewField={() => {}}
                onSaveCategory={mockOnSaveCategory}
                onEditCategory={mockOnEditCategory}
                onDeleteCategory={mockOnDeleteCategory}
                onCancelEdit={mockOnCancelEdit}
            />
        );

        const closeBtn = screen.getByTitle('إغلاق');
        fireEvent.click(closeBtn);

        expect(callsClose).toBe(1);
    });
});
