import React from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  isDestructive = false,
}) => (
  <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
    <div
      className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-in text-right"
      dir="rtl"
    >
      <h3
        className={`text-lg font-black mb-2 ${
          isDestructive ? 'text-red-500' : 'text-text-main'
        }`}
      >
        {title}
      </h3>
      <p className="text-sm text-text-muted mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-text-muted hover:text-text-main font-semibold text-xs transition-colors"
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 rounded-xl text-white font-bold text-xs transition-colors ${
            isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
);
