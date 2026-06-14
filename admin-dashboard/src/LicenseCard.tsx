import React from 'react';
import {
  Smartphone,
  Clock,
  CreditCard,
  Users,
  Eye,
  RotateCcw,
  Ban,
  CheckCircle,
  Trash2,
  Copy,
} from 'lucide-react';

export interface License {
  id: number;
  license_key: string;
  status: string;
  user_id: string | null;
  bound_at: string | null;
  store_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  expires_at: string;
  features: Record<string, boolean>;
  last_check_in: string | null;
  app_version: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_paid: boolean;
}

export interface LicenseCardProps {
  license: License;
  onCopyKey: (key: string) => void;
  onExtend: (license: License) => void;
  onResetToTrial: (id: number, key: string) => void;
  onTogglePayment: (id: number, currentStatus: boolean, key: string) => void;
  onUpdateStatus: (id: number, status: string, key: string) => void;
  onDelete: (id: number, key: string) => void;
  onViewDetails: (license: License) => void;
}

export const LicenseCard: React.FC<LicenseCardProps> = ({
  license,
  onCopyKey,
  onExtend,
  onResetToTrial,
  onTogglePayment,
  onUpdateStatus,
  onDelete,
  onViewDetails,
}) => {
  const isExpired = new Date(license.expires_at) < new Date();
  const daysLeft = Math.ceil(
    (new Date(license.expires_at).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24)
  );

  // Status configuration
  const getStatusParams = () => {
    if (license.status === 'banned') {
      return {
        color: 'red',
        text: 'محظور',
        bg: 'bg-red-500/10 text-red-500 border-red-500/20',
      };
    }
    if (isExpired) {
      return {
        color: 'amber',
        text: 'منتهي',
        bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      };
    }
    if (license.status === 'active') {
      return {
        color: 'emerald',
        text: 'نشط',
        bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      };
    }
    return {
      color: 'slate',
      text: license.status,
      bg: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    };
  };

  const status = getStatusParams();

  return (
    <div className="group relative rounded-2xl border border-border bg-surface shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-slate-400/30 flex flex-col h-full animate-fade-in">
      {/* Top status indicator line */}
      <div
        className={`absolute top-0 left-0 w-full h-1 ${
          status.color === 'emerald'
            ? 'bg-emerald-500'
            : status.color === 'red'
              ? 'bg-red-500'
              : 'bg-amber-500'
        }`}
      />

      {/* Header Section */}
      <div className="p-4 pb-2">
        <div className="flex justify-between items-start gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-text-main text-base truncate leading-tight">
                {license.customer_name || 'عميل غير معروف'}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${status.bg}`}
              >
                {status.text}
              </span>
            </div>
            <p className="text-text-muted text-xs flex items-center gap-1 truncate">
              <Smartphone size={12} className="text-slate-400" />
              <span>{license.customer_phone || '-'}</span>
              {license.store_name && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300 mx-1" />
                  <span className="truncate">{license.store_name}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* License Key & Copy Action */}
        <div
          onClick={() => onCopyKey(license.license_key)}
          className="relative group/key bg-slate-50 dark:bg-slate-900/50 border border-border rounded-xl p-3 cursor-pointer hover:border-blue-500/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all mb-3"
        >
          <div className="flex items-center justify-between">
            <code className="text-xs font-mono text-blue-600 dark:text-blue-400 tracking-wider truncate mr-1 font-semibold">
              {license.license_key}
            </code>
            <div className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover/key:text-blue-500 transition-all">
              <Copy size={12} />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="px-4 py-2 grid grid-cols-2 gap-2 text-xs">
        {/* Expiry Status */}
        <div
          className={`rounded-xl p-3 border flex items-center justify-center gap-2 font-semibold ${
            isExpired
              ? 'bg-red-500/5 border-red-500/10 text-red-500'
              : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          }`}
          title="الصلاحية"
        >
          <Clock size={16} />
          <span className="font-mono text-xs">
            {daysLeft > 0
              ? daysLeft > 365
                ? `${Math.floor(daysLeft / 365)} سنة`
                : `${daysLeft} يوم`
              : 'منتهي'}
          </span>
        </div>

        {/* Payment Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePayment(license.id, license.is_paid, license.license_key);
          }}
          className={`rounded-xl p-3 border transition-all w-full flex items-center justify-center gap-2 font-semibold focus:outline-none ${
            license.is_paid
              ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
              : 'bg-red-500/5 border-red-500/10 text-red-500 hover:bg-red-500/10'
          }`}
          title="حالة الاشتراك (انقر للتغيير)"
        >
          <CreditCard size={16} />
          <span>{license.is_paid ? 'مدفوع' : 'غير مدفوع'}</span>
        </button>
      </div>

      {/* Badges / Binding Info */}
      <div className="px-4 py-2 flex items-center justify-between text-xs text-text-muted border-t border-border/50 mt-3">
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
              license.user_id
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            {license.user_id ? (
              <Users size={12} />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            )}
            {license.user_id ? 'مرتبط' : 'حر'}
          </span>
          {license.app_version && (
            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-500">
              v{license.app_version}
            </span>
          )}
        </div>
        <div className="font-mono text-[11px]">
          {new Date(license.created_at).toLocaleDateString('en-GB')}
        </div>
      </div>

      <div className="flex-grow" />

      {/* Action Bar */}
      <div className="p-3 border-t border-border bg-slate-50 dark:bg-slate-900/30 flex items-center gap-2">
        <button
          onClick={() => onViewDetails(license)}
          className="p-2 rounded-xl bg-surface hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-text-main border border-border transition-colors shadow-sm"
          title="تفاصيل المستخدم والنسخ الاحتياطية"
        >
          <Eye size={15} />
        </button>

        <div className="h-6 w-px bg-border mx-1" />

        <button
          onClick={() => onResetToTrial(license.id, license.license_key)}
          className="p-2 rounded-xl hover:bg-amber-500/10 text-slate-500 hover:text-amber-500 transition-colors"
          title="إعادة ضبط لفترة تجريبية (7 أيام)"
        >
          <RotateCcw size={15} />
        </button>

        <button
          onClick={() => onExtend(license)}
          className="flex-grow py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-sm text-xs"
        >
          تجديد
        </button>

        {license.status === 'active' ? (
          <button
            onClick={() => onUpdateStatus(license.id, 'banned', license.license_key)}
            className="p-2 rounded-xl hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-colors"
            title="حظر الترخيص"
          >
            <Ban size={15} />
          </button>
        ) : (
          <button
            onClick={() =>
              onUpdateStatus(license.id, 'active', license.license_key)
            }
            className="p-2 rounded-xl hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-500 transition-colors"
            title="تفعيل الترخيص"
          >
            <CheckCircle size={15} />
          </button>
        )}

        <button
          onClick={() => onDelete(license.id, license.license_key)}
          className="p-2 rounded-xl hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-colors"
          title="حذف نهائي"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};
