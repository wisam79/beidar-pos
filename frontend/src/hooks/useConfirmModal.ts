import { useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔔 useConfirmModal - Reusable confirm dialog state management
// Replaces duplicated useState+ConfirmModal boilerplate across pages
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConfirmModalState {
    open: boolean;
    title: string;
    message: string;
    type?: 'confirm' | 'warning' | 'error' | 'info';
    confirmText?: string;
    onConfirm: () => void;
}

export interface OpenConfirmOptions {
    title: string;
    message: string;
    type?: 'confirm' | 'warning' | 'error' | 'info';
    confirmText?: string;
    onConfirm: () => void;
}

const initialState: ConfirmModalState = {
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
};

/**
 * Hook to manage ConfirmModal state.
 * 
 * Usage:
 * ```tsx
 * const { confirmState, openConfirm, closeConfirm } = useConfirmModal();
 * 
 * // Open:
 * openConfirm({
 *     title: 'حذف؟',
 *     message: 'هل أنت متأكد؟',
 *     type: 'warning',
 *     onConfirm: () => { deleteItem(); closeConfirm(); }
 * });
 * 
 * // Render:
 * <ConfirmModal
 *     isOpen={confirmState.open}
 *     title={confirmState.title}
 *     message={confirmState.message}
 *     type={confirmState.type}
 *     confirmText={confirmState.confirmText}
 *     onConfirm={confirmState.onConfirm}
 *     onCancel={closeConfirm}
 * />
 * ```
 */
export function useConfirmModal() {
    const [confirmState, setConfirmState] = useState<ConfirmModalState>(initialState);

    const openConfirm = useCallback((options: OpenConfirmOptions) => {
        setConfirmState({
            open: true,
            ...options,
        });
    }, []);

    const closeConfirm = useCallback(() => {
        setConfirmState(prev => ({ ...prev, open: false }));
    }, []);

    return { confirmState, openConfirm, closeConfirm } as const;
}
