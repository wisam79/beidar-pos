import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import type { License } from '../../LicenseCard';

interface ExtendLicenseModalProps {
  license: License;
  onClose: () => void;
  onConfirm: (months: number) => void;
}

export const ExtendLicenseModal: React.FC<ExtendLicenseModalProps> = ({
  license,
  onClose,
  onConfirm,
}) => {
  const [months, setMonths] = useState(12);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div
        className="bg-surface border border-border rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-scale-in text-right"
        dir="rtl"
      >
        <h3 className="text-lg font-black mb-2 text-text-main flex items-center gap-2">
          <Calendar size={18} className="text-blue-500" />
          تجديد صلاحية الاشتراك
        </h3>
        <p className="text-xs text-text-muted mb-4">
          تمديد ترخيص العميل: <span className="font-bold text-text-main">{license.customer_name || 'عميل غير معروف'}</span>
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-text-muted mb-2">
              فترة التمديد الإضافية
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    months === m
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                      : 'bg-slate-50 dark:bg-slate-900 border-border text-text-muted hover:border-slate-400'
                  }`}
                >
                  {m === 12 ? 'سنة كاملة' : `${m} أشهر`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-text-muted hover:text-text-main font-semibold text-xs transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={() => onConfirm(months)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-md shadow-blue-500/25"
          >
            تأكيد التجديد
          </button>
        </div>
      </div>
    </div>
  );
};
