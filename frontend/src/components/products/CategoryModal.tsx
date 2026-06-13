import React from 'react';
import { Layers, Folder, Settings, Trash2, X, Plus } from 'lucide-react';
import { Modal } from '../ui';
import { CategoryDef } from '../../core/types';

interface CategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingCategory: CategoryDef | null;
    categories: CategoryDef[];
    catForm: Partial<CategoryDef>;
    setCatForm: React.Dispatch<React.SetStateAction<Partial<CategoryDef>>>;
    newField: { name: string; type: 'text' | 'number' | 'select'; options: string };
    setNewField: React.Dispatch<React.SetStateAction<{ name: string; type: 'text' | 'number' | 'select'; options: string }>>;
    onSaveCategory: () => void;
    onEditCategory: (cat: CategoryDef) => void;
    onDeleteCategory: (cat: CategoryDef) => void;
    onCancelEdit: () => void;
}

export const CategoryModal = ({
    isOpen, onClose, editingCategory, categories, catForm, setCatForm,
    newField, setNewField, onSaveCategory, onEditCategory, onDeleteCategory, onCancelEdit
}: CategoryModalProps) => {

    if (!isOpen) return null;

    return (
        <Modal title={editingCategory ? 'تعديل الفئة' : 'إدارة الفئات'} onClose={onClose} size="md">
            <div className="space-y-5 pt-2 h-[65vh] flex flex-col">
                {/* Existing Categories List */}
                {!editingCategory && categories.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-text-muted flex items-center gap-2"><Layers size={14} /> الفئات الحالية ({categories.length})</h4>
                        <div className="max-h-[180px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                            {categories.map(cat => (
                                <div key={cat.id} className="flex justify-between items-center bg-surface border border-border p-3 rounded-xl hover:border-primary/30 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                                            <Folder size={16} className="text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-text-main text-sm">{cat.name}</p>
                                            {cat.fields && cat.fields.length > 0 && (
                                                <p className="text-[10px] text-text-muted">{cat.fields.length} حقول مخصصة</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => onEditCategory(cat)}
                                            className="p-2 hover:bg-primary/10 rounded-lg text-text-muted hover:text-primary transition-all"
                                            title="تعديل"
                                        >
                                            <Settings size={14} />
                                        </button>
                                        <button
                                            onClick={() => onDeleteCategory(cat)}
                                            className="p-2 hover:bg-red-500/10 rounded-lg text-text-muted hover:text-red-500 transition-all"
                                            title="حذف"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Divider */}
                {!editingCategory && categories.length > 0 && (
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-border"></div>
                        <span className="text-[10px] text-text-muted font-bold">إضافة فئة جديدة</span>
                        <div className="flex-1 h-px bg-border"></div>
                    </div>
                )}

                {/* Add/Edit Form */}
                <div className="flex-1 space-y-4">
                    <div className="flex gap-2">
                        <input
                            className="flex-1 bg-input-bg border border-border text-text-main rounded-xl px-4 py-3 outline-none focus:border-primary focus:shadow-glow font-bold text-sm transition-all"
                            placeholder={editingCategory ? 'اسم الفئة' : 'اسم الفئة الجديدة'}
                            value={catForm.name}
                            onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                            autoFocus
                        />
                        {editingCategory && (
                            <button
                                onClick={onCancelEdit}
                                className="px-4 bg-surface hover:bg-surface-hover text-text-muted border border-border rounded-xl transition-all"
                                title="إلغاء التعديل"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    <div className="bg-bg p-4 rounded-2xl border border-border space-y-4">
                        <h4 className="text-xs font-bold text-text-muted flex items-center gap-2"><Settings size={14} /> حقول مخصصة (اختياري)</h4>
                        <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                                <label className="text-[9px] text-text-muted font-bold">اسم الحقل</label>
                                <input className="w-full bg-input-bg border border-border text-text-main rounded-lg px-3 py-2 text-xs font-bold" value={newField.name} onChange={e => setNewField({ ...newField, name: e.target.value })} placeholder="مثال: اللون" />
                            </div>
                            <div className="w-24 space-y-1">
                                <label className="text-[9px] text-text-muted font-bold">النوع</label>
                                <select className="w-full bg-input-bg border border-border text-text-main rounded-lg px-2 py-2 text-xs font-bold" value={newField.type} onChange={e => setNewField({ ...newField, type: e.target.value as 'text' | 'number' | 'select' })} aria-label="نوع الحقل">
                                    <option value="text">نص</option>
                                    <option value="number">رقم</option>
                                    <option value="select">قائمة</option>
                                </select>
                            </div>
                            <button onClick={() => { if (newField.name) { setCatForm(prev => ({ ...prev, fields: [...(prev.fields || []), { name: newField.name, type: newField.type, options: newField.type === 'select' ? newField.options.split(',') : undefined }] })); setNewField({ name: '', type: 'text', options: '' }); } }} className="bg-surface hover:bg-surface-active text-text-main p-2 rounded-lg h-[34px] border border-border hover:border-primary transition-all" aria-label="إضافة حقل"><Plus size={16} /></button>
                        </div>
                        {newField.type === 'select' && (
                            <input className="w-full bg-input-bg border border-border text-text-main rounded-lg px-3 py-2 text-xs font-bold" placeholder="الخيارات (مفصولة بفاصلة): أحمر,أزرق,أخضر" value={newField.options} onChange={e => setNewField({ ...newField, options: e.target.value })} />
                        )}

                        {/* Fields List */}
                        {catForm.fields && catForm.fields.length > 0 && (
                            <div className="space-y-2 mt-2">
                                {catForm.fields.map((f, i) => (
                                    <div key={i} className="flex justify-between items-center bg-surface p-2.5 rounded-lg border border-border">
                                        <span className="text-xs font-bold text-text-main">{f.name} <span className="text-[9px] text-text-muted bg-bg px-1.5 py-0.5 rounded ml-1 border border-border">{f.type === 'text' ? 'نص' : f.type === 'number' ? 'رقم' : 'قائمة'}</span></span>
                                        <button onClick={() => setCatForm(prev => ({ ...prev, fields: prev.fields?.filter((_, idx) => idx !== i) }))} className="text-red-500 hover:bg-red-500/10 p-1 rounded transition-all" aria-label="Delete Field"><Trash2 size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-4 flex gap-3 border-t border-border">
                    {editingCategory && (
                        <button
                            onClick={onCancelEdit}
                            className="px-6 bg-surface hover:bg-surface-hover text-text-muted border border-border rounded-xl py-3 font-bold text-sm transition-all"
                        >
                            إلغاء
                        </button>
                    )}
                    <button onClick={onSaveCategory} disabled={!catForm.name} className="flex-1 bg-primary text-primary-fg font-black py-3 rounded-xl hover:brightness-110 disabled:opacity-50 transition-all text-sm shadow-lg shadow-primary/20">
                        {editingCategory ? 'حفظ التعديلات' : 'إضافة الفئة'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
