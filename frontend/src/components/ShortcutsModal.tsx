
import React from 'react';
import { Modal } from './ui';

interface ShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ShortcutsModal = ({ isOpen, onClose }: ShortcutsModalProps) => {
    if (!isOpen) return null;
    const shortcuts = [
        { k: 'F1', d: 'لوحة التحكم' },
        { k: 'F2', d: 'نقطة البيع' },
        { k: 'F3', d: 'المنتجات' },
        { k: 'F4', d: 'المخزون' },
        { k: 'F5', d: 'سجل الفواتير' },
        { k: 'F6', d: 'العملاء' },
        { k: 'F7', d: 'المالية' },
        { k: 'F8', d: 'التقارير' },
        { k: 'Ctrl+K', d: 'البحث السريع' },
        { k: 'Escape', d: 'إغلاق النوافذ' },
        { k: '?', d: 'المساعدة' }
    ];
    return (
        <Modal title="اختصارات لوحة المفاتيح" onClose={onClose} size="sm">
            <div className="grid grid-cols-2 gap-3">
                {shortcuts.map(s => (
                    <div key={s.k} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-gray-300 text-sm font-bold">{s.d}</span>
                        <kbd className="bg-black/40 px-2 py-1 rounded-lg text-xs font-mono font-bold text-primary border border-white/10">{s.k}</kbd>
                    </div>
                ))}
            </div>
        </Modal>
    );
};
