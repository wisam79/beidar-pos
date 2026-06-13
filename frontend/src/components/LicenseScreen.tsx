import React, { useState } from 'react';
import { Key, Lock, ArrowRight, Loader2, ShieldCheck, AlertTriangle, Code2, Wifi, Server, LogOut } from 'lucide-react';
import { BeidarLogo } from './ui';
import { activateLicense, getDeviceId } from '../core/license';
import { api } from '../core/api';

interface LicenseScreenProps {
  onSuccess: () => void;
}

export const LicenseScreen: React.FC<LicenseScreenProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'license' | 'lan'>('license');
  const [keyInput, setKeyInput] = useState('');
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [discoveredServers, setDiscoveredServers] = useState<{ serverName: string, serverIP: string, port: number }[]>([]);

  React.useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  // Auto-scan when switching to LAN mode
  React.useEffect(() => {
    if (mode === 'lan') {
      handleScanServers();
    }
  }, [mode]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;

    setIsLoading(true);
    setError('');

    // Backend handles everything: activation, device binding, storage
    const result = await activateLicense(keyInput.trim());

    if (result.success) {
      // License is now stored and cached by backend
      setTimeout(() => {
        onSuccess();
      }, 500);
    } else {
      setError(result.message || 'فشل التفعيل. تحقق من المفتاح.');
      setIsLoading(false);
    }
  };

  const handleScanServers = async () => {
    setIsScanning(true);
    setError('');
    setDiscoveredServers([]);

    try {
      const servers = await api.lan.discoverServers();
      setDiscoveredServers(servers || []);
      if (servers && servers.length === 1) {
        // Auto-select if only one server found
        setServerIp(servers[0].serverIP);
        setServerPort(servers[0].port);
      }
    } catch (err: unknown) {
      console.error('Scan error:', err);
    }
    setIsScanning(false);
  };

  const handleSelectServer = (server: { serverIP: string, port: number }) => {
    setServerIp(server.serverIP);
    setServerPort(server.port);
    setError('');
  };

  const handleLanConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverIp.trim()) {
      setError('اختر سيرفر أو أدخل عنوان IP');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.lan.connect(serverIp.trim(), serverPort);
      // Check status to confirm
      const status = await api.lan.getClientStatus();
      if (status.connected) {
        onSuccess(); // Proceed to login/app
      } else {
        setError('فشل التحقق من الاتصال.');
        setIsLoading(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'فشل الاتصال بالخادم');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg bg-mesh p-6 relative overflow-hidden select-none" data-theme="dark">
      {/* Background Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 animate-in zoom-in-95 duration-500 flex flex-col h-full justify-center">
        <div className="text-center mb-8">
          <div className="inline-block mb-6 relative group">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse group-hover:bg-primary/30 transition-all"></div>
            <BeidarLogo className="w-20 h-20 relative z-10 text-text-main group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h1 className="text-3xl font-black text-text-main mb-2 tracking-tight">
            {mode === 'license' ? 'تفعيل النظام' : 'ربط بجهاز رئيسي'}
          </h1>
          <p className="text-text-muted text-sm">
            {mode === 'license'
              ? 'نسخة محمية. يرجى إدخال مفتاح الترخيص للمتابعة.'
              : 'أدخل عنوان IP للجهاز الرئيسي للاتصال به.'}
          </p>
        </div>

        {/* Trial Expired Banner */}
        {mode === 'license' && (
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-5 mb-6 text-center">
            <div className="text-4xl mb-3">⏰</div>
            <h2 className="text-lg font-black text-amber-400 mb-2">انتهت الفترة التجريبية المجانية</h2>
            <p className="text-sm text-text-muted mb-4">
              للاستمرار في استخدام التطبيق، يرجى التواصل مع مطور التطبيق لشراء ترخيص
            </p>
            <div className="bg-surface/60 backdrop-blur rounded-xl p-4 border border-border">
              <p className="text-xs text-text-muted mb-2">للتواصل والشراء:</p>
              <a
                href="tel:07811942002"
                className="text-2xl font-black text-primary hover:text-primary/80 transition-colors tracking-wider"
                dir="ltr"
              >
                📞 07811942002
              </a>
              <p className="text-xs text-text-muted mt-2">وسام سمير - مطور التطبيق</p>
            </div>
          </div>
        )}

        <div className="bg-surface/80 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${mode === 'license' ? 'from-primary to-blue-600' : 'from-blue-500 to-cyan-500'}`}></div>

          {mode === 'license' ? (
            <form onSubmit={handleActivate} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-text-muted mb-2 uppercase tracking-wider">مفتاح الترخيص (License Key)</label>
                <div className="relative group/input">
                  <Key className="absolute right-4 top-3.5 text-text-muted group-focus-within/input:text-primary transition-colors" size={20} />
                  <input
                    type="text"
                    className="w-full bg-bg border border-border text-text-main rounded-xl py-3 pr-12 pl-4 outline-none focus:border-primary focus:bg-surface transition-all font-mono text-center tracking-widest uppercase text-lg placeholder:text-text-muted/50 font-bold"
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 text-red-400 text-xs font-bold animate-in slide-in-from-top-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !keyInput}
                className="w-full bg-gradient-to-r from-primary to-teal-600 text-black font-black py-4 rounded-xl hover:brightness-110 transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    جاري التحقق...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={20} />
                    تفعيل الترخيص
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLanConnect} className="space-y-5">
              {/* Discovered Servers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">السيرفرات المتاحة</label>
                  <button
                    type="button"
                    onClick={handleScanServers}
                    disabled={isScanning}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    {isScanning ? (
                      <><Loader2 size={12} className="animate-spin" /> جاري البحث...</>
                    ) : (
                      <><Wifi size={12} /> إعادة البحث</>
                    )}
                  </button>
                </div>

                {isScanning ? (
                  <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-xl text-center">
                    <Loader2 size={24} className="animate-spin mx-auto text-blue-400 mb-2" />
                    <p className="text-sm text-text-muted">جاري البحث عن سيرفرات بيدار...</p>
                    <p className="text-xs text-text-muted/50 mt-1">يستغرق حوالي 5 ثوان</p>
                  </div>
                ) : discoveredServers.length > 0 ? (
                  <div className="space-y-2">
                    {discoveredServers.map((server, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectServer(server)}
                        className={`w-full p-4 rounded-xl border text-right transition-all ${serverIp === server.serverIP
                          ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                          : 'bg-bg border-border hover:border-blue-500/50 text-text-main'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${serverIp === server.serverIP ? 'bg-blue-400' : 'bg-emerald-400'} animate-pulse`} />
                            <Server size={18} className={serverIp === server.serverIP ? 'text-blue-400' : 'text-emerald-400'} />
                            <span className="font-bold">{server.serverName}</span>
                          </div>
                          <code className="text-sm font-mono bg-surface px-2 py-1 rounded">{server.serverIP}</code>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-surface border border-border rounded-xl text-center">
                    <Wifi size={24} className="mx-auto text-text-muted/30 mb-2" />
                    <p className="text-sm text-text-muted">لم يتم العثور على سيرفرات</p>
                    <p className="text-xs text-text-muted/50 mt-1">تأكد أن السيرفر الرئيسي قيد التشغيل</p>
                  </div>
                )}
              </div>

              {/* Manual IP Input (collapsible) */}
              <details className="group">
                <summary className="text-xs text-text-muted cursor-pointer hover:text-text-main transition-colors flex items-center gap-1">
                  <span className="group-open:rotate-90 transition-transform">›</span>
                  إدخال العنوان يدوياً
                </summary>
                <div className="mt-3">
                  <div className="relative group/input">
                    <Server className="absolute right-4 top-3.5 text-text-muted group-focus-within/input:text-blue-400 transition-colors" size={20} />
                    <input
                      type="text"
                      className="w-full bg-bg border border-border text-text-main rounded-xl py-3 pr-12 pl-4 outline-none focus:border-blue-500 focus:bg-surface transition-all font-mono text-center ltr text-lg placeholder:text-text-muted/50 font-bold"
                      placeholder="192.168.1.X"
                      dir="ltr"
                      value={serverIp}
                      onChange={(e) => { setServerIp(e.target.value); setServerPort(0); }}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </details>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 text-red-400 text-xs font-bold animate-in slide-in-from-top-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !serverIp}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-black py-4 rounded-xl hover:brightness-110 transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    جاري الاتصال...
                  </>
                ) : (
                  <>
                    <Wifi size={20} />
                    اتصال بالسيرفر
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="mt-8 text-center space-y-4">
          <button
            onClick={() => { setMode(mode === 'license' ? 'lan' : 'license'); setError(''); }}
            className="text-sm font-bold text-text-muted hover:text-text-main transition-colors flex items-center justify-center gap-2 mx-auto py-2 px-4 rounded-lg hover:bg-surface/50"
          >
            {mode === 'license' ? (
              <>
                <Wifi size={16} />
                أنا موظف (نسخة فرعية)
              </>
            ) : (
              <>
                <Key size={16} />
                لدي مفتاح ترخيص (جهاز رئيسي)
              </>
            )}
          </button>

          {/* Logout Option - Safe escape hatch */}
          <button
            onClick={async () => {
              await api.cloud.logout();
              onSuccess(); // Trigger re-check which will redirect to login
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/40 text-red-400 font-bold text-sm transition-all"
          >
            <LogOut size={16} />
            تسجيل الخروج من الحساب
          </button>

          <div className="border-t border-border pt-6"></div>
          <p className="text-xs text-text-muted font-mono mb-2">Device ID: {deviceId?.substring(0, 20)}...</p>
          <div className="flex items-center justify-center gap-2 text-text-muted hover:text-text-main transition-colors cursor-default">
            <Code2 size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Developed by Wisam Samir</span>
          </div>
        </div>
      </div>
    </div>
  );
};

