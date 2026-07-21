import React, { useState } from 'react';
import { Plus, Zap, Database, MessageCircle, Cloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

interface CreateLicenseProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  setLoadingGlobal: (loading: boolean) => void;
  logAdminAction: (action: string, targetLicense: string, details: string) => Promise<void>;
}

export const CreateLicense: React.FC<CreateLicenseProps> = ({
  showToast,
  setLoadingGlobal,
  logAdminAction,
}) => {
  const navigate = useNavigate();
  const [newLicenseName, setNewLicenseName] = useState('');
  const [newLicensePhone, setNewLicensePhone] = useState('');
  const [newLicenseMonths, setNewLicenseMonths] = useState(12);
  const [newLicenseFeatures, setNewLicenseFeatures] = useState({
    ai_features: true,
    inventory_pro: true,
    whatsapp_integration: false,
    cloud_sync: false,
  });

  const toggleFeatureForm = (key: string) => {
    setNewLicenseFeatures((prev) => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }));
  };

  const generateLicenseKey = () => {
    const chars = '0123456789ABCDEF';
    let hex = '';
    for (let i = 0; i < 16; i++) {
      hex += chars[Math.floor(Math.random() * 16)];
    }
    return `BIDAR-${hex}`;
  };

  const createLicense = async () => {
    if (!newLicenseName.trim()) {
      showToast('اسم العميل مطلوب.', 'error');
      return;
    }
    setLoadingGlobal(true);
    const key = generateLicenseKey();
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + newLicenseMonths);

    try {
      const { error } = await supabase
        .from('licenses')
        .insert({
          license_key: key,
          customer_name: newLicenseName.trim(),
          customer_phone: newLicensePhone.trim(),
          expires_at: expiry.toISOString(),
          features: newLicenseFeatures,
          status: 'active',
          is_paid: false,
        });

      if (error) throw error;

      await logAdminAction(
        'CREATE_LICENSE',
        key,
        `تم إنشاء رخصة للعميل ${newLicenseName} صالحة لمدة ${newLicenseMonths} شهر`
      );

      showToast(`تم إنشاء الرخصة بنجاح: ${key}`, 'success');
      navigator.clipboard.writeText(key);

      setNewLicenseName('');
      setNewLicensePhone('');
      navigate('/');
    } catch (err: any) {
      showToast('فشل إنشاء الترخيص: ' + (err.message || ''), 'error');
    } finally {
      setLoadingGlobal(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-surface border border-border p-8 rounded-3xl shadow-lg animate-fade-in text-right p-6" dir="rtl">
      <h3 className="text-xl font-black mb-6 text-text-main">تفاصيل ترخيص البيع</h3>
      <div className="space-y-6">
        <div>
          <label className="block text-xs font-bold text-text-muted mb-2">
            اسم العميل المشترك (المرخص له)
          </label>
          <input
            type="text"
            placeholder="مثال: شركة النخبة التجارية"
            className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-xl px-4 py-3 text-sm text-text-main outline-none focus:border-blue-500/50 transition-all text-right"
            value={newLicenseName}
            onChange={(e) => setNewLicenseName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-text-muted mb-2">
            رقم الهاتف أو وسيلة الاتصال
          </label>
          <input
            type="text"
            placeholder="مثال: 9647701234567"
            className="w-full bg-slate-50 dark:bg-slate-900 border border-border rounded-xl px-4 py-3 text-sm text-text-main outline-none focus:border-blue-500/50 transition-all text-left font-mono"
            value={newLicensePhone}
            onChange={(e) => setNewLicensePhone(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-text-muted mb-2">
            مدة الصلاحية للاشتراك
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 3, 6, 12].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setNewLicenseMonths(m)}
                className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                  newLicenseMonths === m
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                    : 'bg-slate-50 dark:bg-slate-900 border-border text-text-muted hover:border-slate-400'
                }`}
              >
                {m === 12 ? 'سنة واحدة' : `${m} أشهر`}
              </button>
            ))}
          </div>
        </div>

        {/* Features selectors */}
        <div>
          <label className="block text-xs font-bold text-text-muted mb-3">
            تخصيص باقات الميزات
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'ai_features', label: 'الذكاء الاصطناعي', icon: Zap },
              { key: 'inventory_pro', label: 'إدارة المخزون الاحترافية', icon: Database },
              { key: 'whatsapp_integration', label: 'ربط إشعارات واتساب', icon: MessageCircle },
              { key: 'cloud_sync', label: 'المزامنة السحابية (LAN)', icon: Cloud },
            ].map((f) => {
              const enabled = newLicenseFeatures[f.key as keyof typeof newLicenseFeatures];
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleFeatureForm(f.key)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    enabled
                      ? 'bg-blue-500/5 border-blue-500/30 text-blue-600 dark:text-blue-400'
                      : 'bg-slate-50 dark:bg-slate-900 border-border text-text-muted hover:border-slate-400'
                  }`}
                >
                  <span className="text-xs font-bold">{f.label}</span>
                  <f.icon size={16} />
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={createLicense}
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-500/20 text-sm flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          <span>توليد وإصدار مفتاح الترخيص</span>
        </button>
      </div>
    </div>
  );
};
