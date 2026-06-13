import React, { useState, useEffect } from 'react';
import { ExternalLink, Check, X, RefreshCw, Link2 } from 'lucide-react';
import { SetupZohoIntegration, GetZohoStatus, DisableZohoIntegration } from '../../../wailsjs/go/handlers/CloudHandler';

interface ZohoStatus {
    enabled: boolean;
    configured: boolean;
    organizationId?: string;
    queueLength?: number;
}

export const ZohoSettings: React.FC<{ notify: (msg: string, type: 'success' | 'error' | 'info') => void }> = ({ notify }) => {
    const [status, setStatus] = useState<ZohoStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const [form, setForm] = useState({
        clientId: '',
        clientSecret: '',
        authCode: ''
    });

    const loadStatus = async () => {
        try {
            const s = await GetZohoStatus();
            setStatus(s as ZohoStatus);
        } catch (e) {
            setStatus({ enabled: false, configured: false });
        }
        setLoading(false);
    };

    useEffect(() => {
        loadStatus();
    }, []);

    const handleConnect = async () => {
        if (!form.clientId || !form.clientSecret || !form.authCode) {
            notify('جميع الحقول مطلوبة', 'error');
            return;
        }

        setConnecting(true);
        try {
            await SetupZohoIntegration(form.clientId, form.clientSecret, form.authCode);
            notify('تم ربط Zoho Books بنجاح! ✅', 'success');
            setShowSetup(false);
            loadStatus();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            notify(`فشل الربط: ${msg}`, 'error');
        }
        setConnecting(false);
    };

    const handleDisconnect = async () => {
        try {
            await DisableZohoIntegration();
            notify('تم إلغاء ربط Zoho', 'info');
            loadStatus();
        } catch (e) {
            notify('فشل إلغاء الربط', 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <RefreshCw className="animate-spin text-primary" size={24} />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <img src="https://www.zoho.com/favicon.ico" alt="Zoho" className="w-6 h-6" onError={(e) => (e.currentTarget.src = '')} />
                    </div>
                    <div>
                        <h3 className="font-bold text-text-main">Zoho Books</h3>
                        <p className="text-xs text-text-muted">مزامنة الفواتير تلقائياً</p>
                    </div>
                </div>

                <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${status?.enabled ? 'bg-primary/10 text-primary' : 'bg-gray-500/10 text-gray-500'}`}>
                    {status?.enabled ? <><Check size={14} /> متصل</> : <><X size={14} /> غير متصل</>}
                </div>
            </div>

            {/* Connected State */}
            {status?.enabled && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-text-muted">Organization ID</span>
                        <span className="text-sm font-mono text-text-main">{status.organizationId || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-text-muted">قائمة الانتظار</span>
                        <span className="text-sm font-bold text-text-main">{status.queueLength || 0} فاتورة</span>
                    </div>
                    <button
                        onClick={handleDisconnect}
                        className="w-full mt-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-sm font-bold hover:bg-red-500/20 transition"
                    >
                        إلغاء الربط
                    </button>
                </div>
            )}

            {/* Setup Form */}
            {!status?.enabled && !showSetup && (
                <button
                    onClick={() => setShowSetup(true)}
                    className="w-full px-4 py-3 bg-primary text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition"
                >
                    <Link2 size={18} /> ربط مع Zoho Books
                </button>
            )}

            {showSetup && (
                <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-text-main">إعداد الربط</h4>
                        <a
                            href="https://api-console.zoho.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-1 hover:underline"
                        >
                            Zoho Console <ExternalLink size={12} />
                        </a>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-text-muted mb-1 block">Client ID</label>
                            <input
                                type="text"
                                value={form.clientId}
                                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                                placeholder="1000.XXXXXX..."
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-text-muted mb-1 block">Client Secret</label>
                            <input
                                type="password"
                                value={form.clientSecret}
                                onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                                placeholder="fa2b5989..."
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-text-muted mb-1 block">Authorization Code</label>
                            <input
                                type="text"
                                value={form.authCode}
                                onChange={(e) => setForm({ ...form, authCode: e.target.value })}
                                placeholder="1000.XXXXXX... (ينتهي خلال 3 دقائق)"
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowSetup(false)}
                            className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm font-bold"
                        >
                            إلغاء
                        </button>
                        <button
                            onClick={handleConnect}
                            disabled={connecting}
                            className="flex-1 px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90"
                        >
                            {connecting ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                            ربط
                        </button>
                    </div>

                    <p className="text-[10px] text-text-muted text-center">
                        💡 احصل على Client ID و Secret من Zoho API Console (اختر Self Client)
                    </p>
                </div>
            )}
        </div>
    );
};
