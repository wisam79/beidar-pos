import React, { useState, useEffect, useMemo } from 'react';
import { Shield, CheckCircle, Clock, Ban, CreditCard, Zap, Search } from 'lucide-react';
import { supabase } from '../supabase';
import { StatCard, FilterButton } from '../components';
import { LicenseCard } from '../LicenseCard';
import type { License } from '../LicenseCard';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { ExtendLicenseModal } from '../components/modals/ExtendLicenseModal';
import { DetailsModal } from '../components/modals/DetailsModal';

interface LicensesProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  setLoadingGlobal: (loading: boolean) => void;
  logAdminAction: (action: string, targetLicense: string, details: string) => Promise<void>;
}

export const Licenses: React.FC<LicensesProps> = ({
  showToast,
  setLoadingGlobal,
  logAdminAction,
}) => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned' | 'expired'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'expiry_soon' | 'expiry_late'>('newest');

  // Modals & Action confirmations
  const [detailsModal, setDetailsModal] = useState<License | null>(null);
  const [extendModal, setExtendModal] = useState<License | null>(null);

  const [statusConfirm, setStatusConfirm] = useState<{ id: number; status: string; key: string } | null>(null);
  const [resetConfirm, setResetConfirm] = useState<{ id: number; key: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; key: string } | null>(null);

  const fetchLicenses = async () => {
    setLoadingGlobal(true);
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLicenses(data || []);
    } catch (err: any) {
      showToast('خطأ في تحميل التراخيص: ' + (err.message || ''), 'error');
    } finally {
      setLoadingGlobal(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const stats = useMemo(() => {
    const total = licenses.length;
    const active = licenses.filter(
      (l) => l.status === 'active' && new Date(l.expires_at) > new Date()
    ).length;
    const banned = licenses.filter((l) => l.status === 'banned').length;
    const expired = licenses.filter(
      (l) => l.status !== 'banned' && new Date(l.expires_at) < new Date()
    ).length;

    const paidCount = licenses.filter((l) => l.is_paid).length;
    const unpaidCount = total - paidCount;

    const activeAI = licenses.filter((l) => l.features?.ai_features).length;
    const activeCloud = licenses.filter((l) => l.features?.cloud_sync).length;
    const activeWhatsApp = licenses.filter((l) => l.features?.whatsapp_integration).length;

    const estimatedValue = paidCount * 250000;
    const unpaidValue = unpaidCount * 250000;

    return {
      total,
      active,
      banned,
      expired,
      paidCount,
      unpaidCount,
      activeAI,
      activeCloud,
      activeWhatsApp,
      estimatedValue,
      unpaidValue,
    };
  }, [licenses]);

  const filteredLicenses = useMemo(() => {
    const result = licenses.filter((l) => {
      const matchText = [
        l.customer_name,
        l.customer_phone,
        l.store_name,
        l.license_key,
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = matchText.includes(searchTerm.toLowerCase());
      const isExpired = new Date(l.expires_at) < new Date();

      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = l.status === 'active' && !isExpired;
      else if (statusFilter === 'banned') matchesStatus = l.status === 'banned';
      else if (statusFilter === 'expired') matchesStatus = isExpired && l.status !== 'banned';

      let matchesPayment = true;
      if (paymentFilter === 'paid') matchesPayment = l.is_paid;
      else if (paymentFilter === 'unpaid') matchesPayment = !l.is_paid;

      return matchesSearch && matchesStatus && matchesPayment;
    });

    return result.sort((a, b) => {
      if (sortOption === 'newest')
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOption === 'oldest')
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortOption === 'expiry_soon')
        return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      if (sortOption === 'expiry_late')
        return new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime();
      return 0;
    });
  }, [licenses, searchTerm, statusFilter, paymentFilter, sortOption]);

  const togglePaymentStatus = async (id: number, currentStatus: boolean, key: string) => {
    setLoadingGlobal(true);
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ is_paid: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      await logAdminAction(
        'UPDATE_PAYMENT',
        key,
        `تغيير حالة الدفع إلى: ${!currentStatus ? 'مدفوع' : 'غير مدفوع'}`
      );

      showToast(
        !currentStatus ? 'تم تسجيل تسديد الترخيص بنجاح' : 'تم تعليق دفع الترخيص',
        'success'
      );
      fetchLicenses();
    } catch (err: any) {
      showToast('فشل تعديل حالة الدفع: ' + (err.message || ''), 'error');
    } finally {
      setLoadingGlobal(false);
    }
  };

  const confirmResetToTrial = async () => {
    if (!resetConfirm) return;
    const { id, key } = resetConfirm;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);

    setLoadingGlobal(true);
    try {
      const { error } = await supabase
        .from('licenses')
        .update({
          expires_at: expiry.toISOString(),
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      await logAdminAction(
        'RESET_TO_TRIAL',
        key,
        'إعادة ضبط الرخصة لفترة تجريبية (7 أيام)'
      );

      showToast('تمت إعادة ضبط الترخيص لفترة تجريبية 7 أيام', 'success');
      fetchLicenses();
    } catch (err: any) {
      showToast('فشل إعادة ضبط الترخيص: ' + (err.message || ''), 'error');
    } finally {
      setResetConfirm(null);
      setLoadingGlobal(false);
    }
  };

  const confirmStatusUpdate = async () => {
    if (!statusConfirm) return;
    const { id, status, key } = statusConfirm;

    setLoadingGlobal(true);
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      await logAdminAction(
        'UPDATE_STATUS',
        key,
        `تغيير حالة الترخيص إلى: ${status === 'active' ? 'نشط' : 'محظور'}`
      );

      showToast(status === 'active' ? 'تم تفعيل الترخيص' : 'تم حظر الترخيص بنجاح', 'success');
      fetchLicenses();
    } catch (err: any) {
      showToast('فشل تحديث الحالة: ' + (err.message || ''), 'error');
    } finally {
      setStatusConfirm(null);
      setLoadingGlobal(false);
    }
  };

  const confirmExtendLicense = async (months: number) => {
    if (!extendModal) return;
    const expiry = new Date(extendModal.expires_at);
    expiry.setMonth(expiry.getMonth() + months);

    setLoadingGlobal(true);
    try {
      const { error } = await supabase
        .from('licenses')
        .update({
          expires_at: expiry.toISOString(),
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', extendModal.id);

      if (error) throw error;

      await logAdminAction(
        'EXTEND_LICENSE',
        extendModal.license_key,
        `تمديد الصلاحية لـ ${months} أشهر`
      );

      showToast('تم تمديد صلاحية الترخيص بنجاح', 'success');
      fetchLicenses();
    } catch (err: any) {
      showToast('فشل تمديد الترخيص: ' + (err.message || ''), 'error');
    } finally {
      setExtendModal(null);
      setLoadingGlobal(false);
    }
  };

  const confirmDeleteLicense = async () => {
    if (!deleteConfirm) return;
    const { id, key } = deleteConfirm;

    setLoadingGlobal(true);
    try {
      const { error } = await supabase.from('licenses').delete().eq('id', id);
      if (error) throw error;

      await logAdminAction('DELETE_LICENSE', key, 'حذف الترخيص بشكل نهائي');

      showToast('تم حذف الترخيص بنجاح', 'success');
      fetchLicenses();
    } catch (err: any) {
      showToast('فشل الحذف: ' + (err.message || ''), 'error');
    } finally {
      setDeleteConfirm(null);
      setLoadingGlobal(false);
    }
  };

  const toggleFeature = async (
    license: License,
    featureKey: string,
    featureLabel: string,
    newValue: boolean
  ) => {
    const updatedFeatures = { ...license.features, [featureKey]: newValue };
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ features: updatedFeatures, updated_at: new Date().toISOString() })
        .eq('id', license.id);

      if (error) throw error;

      await logAdminAction(
        'TOGGLE_FEATURE',
        license.license_key,
        `ميزة [${featureLabel}]: ${newValue ? 'تفعيل' : 'تعطيل'}`
      );

      showToast(`تم تعديل ميزة ${featureLabel} بنجاح`, 'success');

      const updatedLicense = { ...license, features: updatedFeatures };
      setLicenses((prev) => prev.map((l) => (l.id === license.id ? updatedLicense : l)));
      if (detailsModal?.id === license.id) {
        setDetailsModal(updatedLicense);
      }
    } catch (err: any) {
      showToast('فشل تعديل الميزة: ' + (err.message || ''), 'error');
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('تم نسخ النص للمحافظة', 'success');
  };

  return (
    <div className="space-y-6 text-right p-6" dir="rtl">
      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        <StatCard
          icon={<Shield size={20} className="text-blue-500" />}
          label="إجمالي التراخيص"
          value={stats.total}
          color="bg-blue-600/10"
        />
        <StatCard
          icon={<CheckCircle size={20} className="text-emerald-500" />}
          label="التراخيص النشطة"
          value={stats.active}
          color="bg-emerald-500/10"
        />
        <StatCard
          icon={<Clock size={20} className="text-amber-500" />}
          label="التراخيص المنتهية"
          value={stats.expired}
          color="bg-amber-500/10"
        />
        <StatCard
          icon={<Ban size={20} className="text-red-500" />}
          label="التراخيص المحظورة"
          value={stats.banned}
          color="bg-red-500/10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
        {/* Financial & Subscription Analytics */}
        <div className="bg-surface border border-border rounded-3xl p-6 shadow-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
          <h4 className="text-sm font-black text-text-main mb-4 flex items-center gap-2">
            <CreditCard className="text-emerald-500" size={16} />
            إحصائيات الاشتراكات والدفع السحابي
          </h4>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-muted">التراخيص المدفوعة:</span>
              <span className="font-mono font-bold text-emerald-500">{stats.paidCount} / {stats.total}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.total > 0 ? (stats.paidCount / stats.total) * 100 : 0}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-border">
                <p className="text-[10px] text-text-muted font-bold mb-1">الإيرادات المقدرة (IQD)</p>
                <p className="text-sm font-black text-emerald-500 tabular-nums">
                  {stats.estimatedValue.toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-border">
                <p className="text-[10px] text-text-muted font-bold mb-1">المستحقات المعلقة (IQD)</p>
                <p className="text-sm font-black text-amber-500 tabular-nums">
                  {stats.unpaidValue.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Core Features Adoption */}
        <div className="bg-surface border border-border rounded-3xl p-6 shadow-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl" />
          <h4 className="text-sm font-black text-text-main mb-4 flex items-center gap-2">
            <Zap className="text-blue-500" size={16} />
            معدل اعتماد وتفعيل الميزات الإضافية
          </h4>
          <div className="space-y-3.5">
            {/* AI Features Adoption */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-text-muted font-semibold">ميزات الذكاء الاصطناعي (AI Features):</span>
                <span className="font-mono font-bold text-blue-500">
                  {stats.total > 0 ? Math.round((stats.activeAI / stats.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.activeAI / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            {/* Cloud Sync Adoption */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-text-muted font-semibold">النسخ السحابي (Cloud Sync / LAN):</span>
                <span className="font-mono font-bold text-violet-500">
                  {stats.total > 0 ? Math.round((stats.activeCloud / stats.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-violet-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.activeCloud / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            {/* WhatsApp Integration Adoption */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-text-muted font-semibold">إشعارات الواتساب (WhatsApp Notification):</span>
                <span className="font-mono font-bold text-teal-500">
                  {stats.total > 0 ? Math.round((stats.activeWhatsApp / stats.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-teal-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.activeWhatsApp / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 animate-fade-in">
        {/* Filter and Search Bar */}
        <div className="flex flex-col lg:flex-row gap-3 bg-surface p-4 rounded-2xl border border-border shadow-sm">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-3.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="ابحث باسم المشترك، الهاتف، الكود، أو المحل..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-xl pr-10 pl-4 py-2.5 text-xs text-text-main outline-none focus:border-blue-500/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterButton
              active={statusFilter === 'all'}
              label="كل الحالات"
              count={stats.total}
              onClick={() => setStatusFilter('all')}
            />
            <FilterButton
              active={statusFilter === 'active'}
              label="نشط"
              count={stats.active}
              onClick={() => setStatusFilter('active')}
            />
            <FilterButton
              active={statusFilter === 'expired'}
              label="منتهي"
              count={stats.expired}
              onClick={() => setStatusFilter('expired')}
            />
            <FilterButton
              active={statusFilter === 'banned'}
              label="محظور"
              count={stats.banned}
              onClick={() => setStatusFilter('banned')}
            />

            <div className="h-6 w-px bg-border mx-1" />

            {/* Payment Filters */}
            <select
              value={paymentFilter}
              onChange={(e: any) => setPaymentFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs font-semibold text-text-main focus:outline-none"
            >
              <option value="all">كل الاشتراكات</option>
              <option value="paid">مدفوع</option>
              <option value="unpaid">غير مدفوع</option>
            </select>

            {/* Sorting */}
            <select
              value={sortOption}
              onChange={(e: any) => setSortOption(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs font-semibold text-text-main focus:outline-none"
            >
              <option value="newest">الأحدث إنشائاً</option>
              <option value="oldest">الأقدم إنشائاً</option>
              <option value="expiry_soon">الأقرب انتهاءً</option>
              <option value="expiry_late">الأبعد انتهاءً</option>
            </select>
          </div>
        </div>

        {/* Grid List */}
        {filteredLicenses.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Search size={32} />
            </div>
            <h3 className="text-lg font-bold text-text-main mb-1">
              لم نجد أي تراخيص مطابقة
            </h3>
            <p className="text-text-muted text-sm max-w-sm mx-auto">
              تأكد من كتابة مصطلح البحث بشكل صحيح أو تغيير خيارات التصفية النشطة.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLicenses.map((license) => (
              <LicenseCard
                key={license.id}
                license={license}
                onCopyKey={copyText}
                onExtend={setExtendModal}
                onResetToTrial={(id, key) => setResetConfirm({ id, key })}
                onTogglePayment={togglePaymentStatus}
                onUpdateStatus={(id, status, key) => setStatusConfirm({ id, status, key })}
                onDelete={(id, key) => setDeleteConfirm({ id, key })}
                onViewDetails={setDetailsModal}
              />
            ))}
          </div>
        )}
      </div>

      {/* License Details Modal */}
      {detailsModal && (
        <DetailsModal
          license={detailsModal}
          onClose={() => setDetailsModal(null)}
          onCopyText={copyText}
          showToast={showToast}
          onToggleFeature={toggleFeature}
        />
      )}

      {/* Renew Modal */}
      {extendModal && (
        <ExtendLicenseModal
          license={extendModal}
          onClose={() => setExtendModal(null)}
          onConfirm={confirmExtendLicense}
        />
      )}

      {/* Reset Confirmation */}
      {resetConfirm && (
        <ConfirmModal
          title="إعادة ضبط الترخيص"
          message={`هل أنت متأكد من إعادة ضبط الترخيص ${resetConfirm.key} إلى فترة تجريبية (7 أيام)؟ سيتم إلغاء مدة الصلاحية الحالية.`}
          confirmText="تأكيد إعادة الضبط"
          cancelText="تراجع"
          onConfirm={confirmResetToTrial}
          onCancel={() => setResetConfirm(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmModal
          title="حذف الترخيص نهائياً"
          message={`تحذير: هل أنت متأكد من حذف الترخيص ${deleteConfirm.key} بشكل نهائي؟ هذا الإجراء لا يمكن التراجع عنه وسيعطل كاشير المستخدم فوراً.`}
          confirmText="حذف نهائي"
          cancelText="تراجع"
          isDestructive
          onConfirm={confirmDeleteLicense}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Ban / Active Confirmation */}
      {statusConfirm && (
        <ConfirmModal
          title={statusConfirm.status === 'active' ? 'تفعيل الترخيص' : 'حظر الترخيص'}
          message={`هل تريد بالتأكيد ${
            statusConfirm.status === 'active' ? 'تفعيل' : 'حظر'
          } الترخيص رقم ${statusConfirm.key}؟`}
          confirmText="تأكيد الإجراء"
          cancelText="تراجع"
          isDestructive={statusConfirm.status === 'banned'}
          onConfirm={confirmStatusUpdate}
          onCancel={() => setStatusConfirm(null)}
        />
      )}
    </div>
  );
};
