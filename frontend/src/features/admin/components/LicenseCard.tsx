// LicenseCard Component - Extracted from DeveloperDashboard.tsx

import React from 'react';
import {
    Smartphone, Clock, CreditCard, Users, Eye,
    RotateCcw, Ban, CheckCircle, Trash2, Copy
} from 'lucide-react';
import { AdminLicense } from '../../../core/api';

// ─────────────────────────────────────────────────────────────────────────────────
// License Card Component
// ─────────────────────────────────────────────────────────────────────────────────

export interface LicenseCardProps {
    license: AdminLicense;
    onCopyKey: (key: string) => void;
    onExtend: (license: AdminLicense) => void;
    onResetToTrial: (id: number, key: string) => void;
    onTogglePayment: (id: number, currentStatus: boolean, key: string) => void;
    onUpdateStatus: (id: number, status: string, key: string) => void;
    onDelete: (id: number, key: string) => void;
    onViewDetails: (license: AdminLicense) => void;
}

export const LicenseCard: React.FC<LicenseCardProps> = ({
    license, onCopyKey, onExtend, onResetToTrial,
    onTogglePayment, onUpdateStatus, onDelete, onViewDetails
}) => {
    const isExpired = new Date(license.expires_at) < new Date();
    const daysLeft = Math.ceil((new Date(license.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // Status config
    const getStatusParams = () => {
        if (license.status === 'banned') return { color: 'red', text: 'محظور', ring: 'ring-red-500/50', bg: 'bg-red-500/10' };
        if (isExpired) return { color: 'amber', text: 'منتهي', ring: 'ring-amber-500/50', bg: 'bg-amber-500/10' };
        if (license.status === 'active') return { color: 'emerald', text: 'نشط', ring: 'ring-emerald-500/50', bg: 'bg-emerald-500/10' };
        return { color: 'gray', text: license.status, ring: 'ring-gray-500/50', bg: 'bg-gray-500/10' };
    };
    const status = getStatusParams();

    return (
        <div className="group relative rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:border-white/10 flex flex-col h-full">
            {/* Top Highlight Line */}
            <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-${status.color}-500 to-transparent opacity-50`} />

            {/* Header Section */}
            <div className="p-3 pb-0">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <h3 className="font-bold text-white text-sm truncate leading-tight tracking-tight max-w-[70%]">
                                {license.customer_name || 'عميل غير معروف'}
                            </h3>
                            <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold tracking-wider uppercase border border-white/5 ${status.bg} text-${status.color}-400`}>
                                {status.text}
                            </span>
                        </div>
                        <p className="text-text-muted text-[10px] flex items-center gap-1 truncate">
                            <Smartphone size={9} />
                            {license.customer_phone || '-'}
                            {license.store_name && (
                                <>
                                    <span className="w-0.5 h-0.5 rounded-full bg-white/20 mx-0.5" />
                                    <span>{license.store_name}</span>
                                </>
                            )}
                        </p>
                    </div>
                </div>

                {/* License Key & Copy */}
                <div onClick={() => onCopyKey(license.license_key)}
                    className="relative group/key bg-black/20 border border-white/5 rounded-lg p-2 cursor-pointer hover:bg-black/30 transition-colors mb-2">
                    <div className="flex items-center justify-between">
                        <code className="text-[10px] font-mono text-emerald-400 tracking-wider truncate mr-1">
                            {license.license_key}
                        </code>
                        <div className="p-1 rounded bg-white/5 text-white/40 group-hover/key:text-white group-hover/key:bg-white/10 transition-all">
                            <Copy size={9} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="px-3 py-1 grid grid-cols-2 gap-1.5 text-[10px]">
                {/* Expiry */}
                <div className="bg-white/5 rounded-lg p-2 border border-white/5 flex items-center justify-center gap-2 group/expiry relative" title="الصلاحية">
                    <Clock size={14} className={isExpired ? 'text-red-400' : 'text-emerald-400'} />
                    <span className={`font-bold text-[10px] ${isExpired ? 'text-red-400' : 'text-white'}`}>
                        {daysLeft > 0 ? (daysLeft > 365 ? `${Math.floor(daysLeft / 365)} سنة` : `${daysLeft} يوم`) : 'منتهي'}
                    </span>
                </div>

                {/* Payment */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onTogglePayment(license.id, license.is_paid, license.license_key);
                    }}
                    className={`rounded-lg p-2 border transition-all w-full flex items-center justify-center gap-2 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-surface ${license.is_paid
                        ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 focus:ring-emerald-500'
                        : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20 focus:ring-red-500'
                        }`}
                    title="حالة الاشتراك (انقر للتغيير)"
                >
                    <CreditCard size={14} className={license.is_paid ? 'text-emerald-400' : 'text-red-400'} />
                    <span className={`font-bold text-[10px] ${license.is_paid ? 'text-emerald-400' : 'text-red-400'}`}>
                        {license.is_paid ? 'مدفوع' : 'غير مدفوع'}
                    </span>
                </button>
            </div>

            {/* Badges / Binding */}
            <div className="px-3 mt-1.5 flex items-center justify-between text-[9px] text-text-muted/70">
                <div className="flex items-center gap-1">
                    <span className={`flex items-center gap-0.5 px-1 py-0.5 rounded ${license.device_id ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5'}`}>
                        {license.device_id ? <Users size={9} /> : <div className="w-1.5 h-1.5 rounded-full border border-current opacity-50" />}
                        {license.device_id ? 'مرتبط' : 'حر'}
                    </span>
                    {license.app_version && (
                        <span className="bg-white/5 px-1 py-0.5 rounded font-mono text-[9px]">v{license.app_version}</span>
                    )}
                </div>
                <div className="font-mono text-[9px]">{new Date(license.created_at).toLocaleDateString('en-GB')}</div>
            </div>

            <div className="flex-1" />

            {/* Action Bar */}
            <div className="p-2 mt-1.5 border-t border-white/5 flex items-center gap-1.5 text-[10px]">
                <button onClick={() => onViewDetails(license)} className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-text-muted hover:text-white transition-colors" title="التفاصيل"><Eye size={14} /></button>

                <div className="h-3 w-px bg-white/10 mx-0.5" />

                <button onClick={() => onResetToTrial(license.id, license.license_key)} className="p-1.5 rounded-md hover:bg-amber-500/20 text-text-muted hover:text-amber-400 transition-colors" title="إعادة ضبط"><RotateCcw size={14} /></button>

                <button onClick={() => onExtend(license)} className="flex-1 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary-light font-bold transition-colors border border-primary/20 hover:border-primary/30">تجديد</button>

                {license.status === 'active' ? (
                    <button onClick={() => onUpdateStatus(license.id, 'banned', license.license_key)} className="p-1.5 rounded-md hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors" title="حظر"><Ban size={14} /></button>
                ) : (
                    <button onClick={() => onUpdateStatus(license.id, 'active', license.license_key)} className="p-1.5 rounded-md hover:bg-emerald-500/20 text-text-muted hover:text-emerald-400 transition-colors" title="تفعيل"><CheckCircle size={14} /></button>
                )}

                <button onClick={() => onDelete(license.id, license.license_key)} className="p-1.5 rounded-md hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors" title="حذف"><Trash2 size={14} /></button>
            </div>
        </div>
    );
};
