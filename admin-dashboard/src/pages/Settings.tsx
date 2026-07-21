import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw, Copy } from 'lucide-react';
import { supabase } from '../supabase';

interface SettingsProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  setLoadingGlobal: (loading: boolean) => void;
  logAdminAction: (action: string, targetLicense: string, details: string) => Promise<void>;
}

export const Settings: React.FC<SettingsProps> = ({
  showToast,
  setLoadingGlobal,
  logAdminAction,
}) => {
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [newKey, setNewKey] = useState('');
  const [groqKeys, setGroqKeys] = useState<string[]>([]);
  const [newGroqKey, setNewGroqKey] = useState('');
  const [keyStatuses, setKeyStatuses] = useState<Record<string, 'checking' | 'active' | 'error'>>({});

  const maskKey = (key: string) => {
    if (key.length <= 12) return key;
    return `${key.slice(0, 8)}...${key.slice(-6)}`;
  };

  const fetchAIKeys = async () => {
    setLoadingGlobal(true);
    try {
      const { data, error } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'ai_keys')
        .maybeSingle();

      if (error) throw error;
      const val = data?.value;
      if (val && !Array.isArray(val) && typeof val === 'object') {
        setApiKeys(val.gemini_keys || []);
        setGroqKeys(val.groq_keys || []);
      } else {
        setApiKeys(Array.isArray(val) ? val : []);
        setGroqKeys([]);
      }
    } catch (err: any) {
      showToast('خطأ في تحميل مفاتيح الذكاء الاصطناعي: ' + (err.message || ''), 'error');
    } finally {
      setLoadingGlobal(false);
    }
  };

  useEffect(() => {
    fetchAIKeys();
  }, []);

  const saveAIKeys = async (gemini: string[], groq: string[]) => {
    setLoadingGlobal(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('global_settings')
        .select('*')
        .eq('key', 'ai_keys')
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const newValue = {
        gemini_keys: gemini,
        groq_keys: groq,
      };

      let error;
      if (data) {
        ({ error } = await supabase
          .from('global_settings')
          .update({ value: newValue, updated_at: new Date().toISOString() })
          .eq('key', 'ai_keys'));
      } else {
        ({ error } = await supabase.from('global_settings').insert({
          key: 'ai_keys',
          value: newValue,
        }));
      }

      if (error) throw error;

      await logAdminAction(
        'AI_KEYS_UPDATE',
        'GLOBAL_SETTINGS',
        `تم تعديل مفاتيح الذكاء الاصطناعي (Gemini: ${gemini.length}، Groq: ${groq.length})`
      );
      setApiKeys(gemini);
      setGroqKeys(groq);
      showToast('تم حفظ المفاتيح في السحابة بنجاح', 'success');
    } catch (err: any) {
      showToast('فشل تعديل المفاتيح: ' + (err.message || ''), 'error');
    } finally {
      setLoadingGlobal(false);
    }
  };

  const checkKeyHealth = async (key: string, provider: 'gemini' | 'groq') => {
    setKeyStatuses((prev) => ({ ...prev, [key]: 'checking' }));
    try {
      let url = '';
      let options: RequestInit = {};

      if (provider === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        options = { method: 'GET' };
      } else {
        url = 'https://api.groq.com/openai/v1/models';
        options = {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${key}`,
          },
        };
      }

      const resp = await fetch(url, options);
      if (resp.status === 200) {
        setKeyStatuses((prev) => ({ ...prev, [key]: 'active' }));
        showToast('مفتاح الذكاء الاصطناعي صالح ونشط!', 'success');
      } else {
        setKeyStatuses((prev) => ({ ...prev, [key]: 'error' }));
        showToast('فشل التحقق: المفتاح غير صالح أو منتهي!', 'error');
      }
    } catch (err) {
      setKeyStatuses((prev) => ({ ...prev, [key]: 'error' }));
      showToast('خطأ في الاتصال أثناء التحقق!', 'error');
    }
  };

  const addAIKey = () => {
    if (!newKey.trim()) return;
    const updated = [...apiKeys, newKey.trim()];
    setNewKey('');
    saveAIKeys(updated, groqKeys);
  };

  const removeAIKey = (index: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المفتاح؟')) return;
    const updated = apiKeys.filter((_, i) => i !== index);
    saveAIKeys(updated, groqKeys);
  };

  const addGroqKey = () => {
    if (!newGroqKey.trim()) return;
    const updated = [...groqKeys, newGroqKey.trim()];
    setNewGroqKey('');
    saveAIKeys(apiKeys, updated);
  };

  const removeGroqKey = (index: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المفتاح؟')) return;
    const updated = groqKeys.filter((_, i) => i !== index);
    saveAIKeys(apiKeys, updated);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('تم النسخ إلى الحافظة', 'success');
  };

  return (
    <div className="space-y-8 text-right p-6" dir="rtl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gemini Panel */}
        <div className="bg-surface border border-border p-8 rounded-3xl shadow-lg">
          <h3 className="text-xl font-black mb-2 text-text-main">مفاتيح Google Gemini API</h3>
          <p className="text-xs text-text-muted mb-6">
            إدارة مفاتيح Gemini السحابية لتشغيل ميزات الذكاء الاصطناعي في Beidar.
          </p>

          <div className="space-y-6">
            {/* Input form */}
            <div className="flex gap-2">
              <button
                onClick={addAIKey}
                className="px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md text-xs whitespace-nowrap"
              >
                إضافة مفتاح
              </button>
              <input
                type="password"
                placeholder="AIzaSy..."
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-border rounded-xl px-4 py-3 text-xs text-text-main outline-none focus:border-blue-500/50 transition-all font-mono text-left"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
            </div>

            {/* Key list */}
            <div>
              <label className="block text-xs font-bold text-text-muted mb-3">
                المفاتيح النشطة في السحابة ({apiKeys.length})
              </label>
              {apiKeys.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-900/30 border border-dashed border-border rounded-2xl p-6 text-center text-text-muted text-xs">
                  لا توجد مفاتيح محفوظة حالياً.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {apiKeys.map((k, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 border border-border rounded-xl p-3"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeAIKey(index)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                          title="حذف المفتاح"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={() => checkKeyHealth(k, 'gemini')}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600/20 transition-all flex items-center gap-1 shrink-0"
                          disabled={keyStatuses[k] === 'checking'}
                        >
                          {keyStatuses[k] === 'checking' && (
                            <RefreshCw size={10} className="animate-spin" />
                          )}
                          <span>فحص</span>
                        </button>
                        {keyStatuses[k] === 'active' && (
                          <span className="text-[10px] font-bold text-emerald-500 px-2 py-0.5 bg-emerald-500/10 rounded-full shrink-0">نشط</span>
                        )}
                        {keyStatuses[k] === 'error' && (
                          <span className="text-[10px] font-bold text-red-500 px-2 py-0.5 bg-red-500/10 rounded-full shrink-0">معطل</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 min-w-0 flex-1 justify-end">
                        <span className="font-mono text-xs text-text-main truncate max-w-[150px]" title={k}>
                          {maskKey(k)}
                        </span>
                        <button
                          onClick={() => copyText(k)}
                          className="text-slate-400 hover:text-text-main p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
                          title="نسخ"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Groq Panel */}
        <div className="bg-surface border border-border p-8 rounded-3xl shadow-lg">
          <h3 className="text-xl font-black mb-2 text-text-main">مفاتيح Groq / Grok API</h3>
          <p className="text-xs text-text-muted mb-6">
            إدارة مفاتيح Groq السحابية لتشغيل الموديلات البديلة مثل Llama و Allam.
          </p>

          <div className="space-y-6">
            {/* Input form */}
            <div className="flex gap-2">
              <button
                onClick={addGroqKey}
                className="px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold transition-all shadow-md text-xs whitespace-nowrap"
              >
                إضافة مفتاح
              </button>
              <input
                type="password"
                placeholder="gsk_..."
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-border rounded-xl px-4 py-3 text-xs text-text-main outline-none focus:border-violet-500/50 transition-all font-mono text-left"
                value={newGroqKey}
                onChange={(e) => setNewGroqKey(e.target.value)}
              />
            </div>

            {/* Key list */}
            <div>
              <label className="block text-xs font-bold text-text-muted mb-3">
                المفاتيح النشطة في السحابة ({groqKeys.length})
              </label>
              {groqKeys.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-900/30 border border-dashed border-border rounded-2xl p-6 text-center text-text-muted text-xs">
                  لا توجد مفاتيح محفوظة حالياً.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {groqKeys.map((k, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 border border-border rounded-xl p-3"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeGroqKey(index)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                          title="حذف المفتاح"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={() => checkKeyHealth(k, 'groq')}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-violet-600/10 text-violet-600 dark:text-violet-400 hover:bg-violet-600/20 transition-all flex items-center gap-1 shrink-0"
                          disabled={keyStatuses[k] === 'checking'}
                        >
                          {keyStatuses[k] === 'checking' && (
                            <RefreshCw size={10} className="animate-spin" />
                          )}
                          <span>فحص</span>
                        </button>
                        {keyStatuses[k] === 'active' && (
                          <span className="text-[10px] font-bold text-emerald-500 px-2 py-0.5 bg-emerald-500/10 rounded-full shrink-0">نشط</span>
                        )}
                        {keyStatuses[k] === 'error' && (
                          <span className="text-[10px] font-bold text-red-500 px-2 py-0.5 bg-red-500/10 rounded-full shrink-0">معطل</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 min-w-0 flex-1 justify-end">
                        <span className="font-mono text-xs text-text-main truncate max-w-[150px]" title={k}>
                          {maskKey(k)}
                        </span>
                        <button
                          onClick={() => copyText(k)}
                          className="text-slate-400 hover:text-text-main p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
                          title="نسخ"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
