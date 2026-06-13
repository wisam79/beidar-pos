import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, Server, Monitor, RefreshCw, Power, PowerOff, Copy, Check, AlertTriangle, Ban, Play, UserX, Users, Shield, Trash2, Terminal } from 'lucide-react';
import { usePageVisibility } from '../hooks/usePageVisibility';
import * as LanHandler from '../../wailsjs/go/handlers/LanHandler';

const api = {
    lan: {
        startServer: () => LanHandler.StartLanServer(),
        stopServer: () => LanHandler.StopLanServer(),
        getServerStatus: () => LanHandler.GetLanServerStatus(),
        connect: (ip: string, port: number) => LanHandler.ConnectToLanServer(ip, port),
        disconnect: () => LanHandler.DisconnectFromLanServer(),
        getClientStatus: () => LanHandler.GetLanClientStatus(),
        getLocalIP: () => LanHandler.GetLocalIP(),
        discoverServers: () => LanHandler.DiscoverServers(),
        testConnection: () => LanHandler.TestLanConnection(),
        getConnectedClients: () => LanHandler.GetConnectedClients(),
        disconnectClient: (id: string) => LanHandler.DisconnectLanClient(id),
        suspendClient: (id: string) => LanHandler.SuspendLanClient(id),
        resumeClient: (id: string) => LanHandler.ResumeLanClient(id),
        blockDevice: (id: string, name: string, reason: string) => LanHandler.BlockLanDevice(id, name, reason),
        getBlockedDevices: () => LanHandler.GetBlockedDevices(),
        unblockDevice: (id: number) => LanHandler.UnblockLanDevice(id),
    }
};

interface LanSyncPanelProps {
    notify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface ServerStatus {
    running: boolean;
    localIP: string;
    port: number;
    clientCount: number;
    clients: string[];
}

interface ClientStatus {
    connected: boolean;
    serverAddress: string;
    mode: string;
}

interface ConnectedClient {
    deviceId: string;
    deviceName: string;
    ipAddress: string;
    connectedAt: number;
    lastActivity: number;
    status: string;
}

interface BlockedDevice {
    id: number;
    deviceId: string;
    deviceName: string;
    blockedAt: number;
    reason: string;
}

interface DiscoveredServer {
    serverName: string;
    serverIP: string;
    port: number;
}

export const LanSyncPanel: React.FC<LanSyncPanelProps> = ({ notify }) => {
    const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
    const [clientStatus, setClientStatus] = useState<ClientStatus | null>(null);
    const [connectedClients, setConnectedClients] = useState<ConnectedClient[]>([]);
    const [blockedDevices, setBlockedDevices] = useState<BlockedDevice[]>([]);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'clients' | 'blocked'>('clients');

    // Client connection states
    const [showConnectForm, setShowConnectForm] = useState(false);
    const [discoveredServers, setDiscoveredServers] = useState<DiscoveredServer[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [selectedServer, setSelectedServer] = useState<DiscoveredServer | null>(null);
    const [manualIp, setManualIp] = useState('');

    const fetchStatus = useCallback(async () => {
        try {
            const [server, client] = await Promise.all([
                api.lan.getServerStatus(),
                api.lan.getClientStatus()
            ]);
            setServerStatus(server);
            setClientStatus(client);

            if (server?.running) {
                const [clients, blocked] = await Promise.all([
                    api.lan.getConnectedClients(),
                    api.lan.getBlockedDevices()
                ]);
                setConnectedClients(clients || []);
                setBlockedDevices(blocked || []);
            }
        } catch (e) {
            console.error('Failed to fetch LAN status', e);
        }
    }, []);

    const isVisible = usePageVisibility();

    // Only poll when page is visible - saves CPU when tab is hidden
    useEffect(() => {
        if (!isVisible) return; // Don't poll when tab is hidden

        fetchStatus();
        const interval = setInterval(fetchStatus, 15000); // 15 seconds instead of 10
        return () => clearInterval(interval);
    }, [fetchStatus, isVisible]);

    const handleScanServers = async () => {
        setIsScanning(true);
        setDiscoveredServers([]);
        try {
            const servers = await api.lan.discoverServers();
            setDiscoveredServers(servers || []);
            if (servers && servers.length === 1) {
                setSelectedServer(servers[0]);
            }
        } catch (e) {
            console.error('Scan failed:', e);
        }
        setIsScanning(false);
    };

    const handleConnectToServer = async () => {
        const ip = selectedServer?.serverIP || manualIp.trim();
        const port = selectedServer?.port || 0;

        if (!ip) {
            notify('اختر سيرفر أو أدخل عنوان IP', 'error');
            return;
        }

        setLoading(true);
        try {
            await api.lan.connect(ip, port);
            notify('تم الاتصال بالسيرفر بنجاح! جاري التحديث...', 'success');
            // Reload to clear cache and fetch fresh data from server
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            notify('فشل الاتصال: ' + msg, 'error');
            setLoading(false);
        }
    };

    const handleStartServer = async () => {
        setLoading(true);
        try {
            await api.lan.startServer();
            notify('تم تشغيل الخادم بنجاح', 'success');
            await fetchStatus();
        } catch (e: unknown) {
            notify('فشل تشغيل الخادم: ' + String(e), 'error');
        }
        setLoading(false);
    };

    const handleStopServer = async () => {
        setLoading(true);
        try {
            await api.lan.stopServer();
            notify('تم إيقاف الخادم', 'info');
            await fetchStatus();
        } catch (e: unknown) {
            notify('فشل إيقاف الخادم: ' + String(e), 'error');
        }
        setLoading(false);
    };

    const handleDisconnectClient = async (deviceId: string) => {
        try {
            await api.lan.disconnectClient(deviceId);
            notify('تم فصل الجهاز', 'success');
            await fetchStatus();
        } catch (e: unknown) {
            notify('خطأ: ' + String(e), 'error');
        }
    };

    const handleSuspendClient = async (deviceId: string) => {
        try {
            await api.lan.suspendClient(deviceId);
            notify('تم تعليق الجهاز', 'info');
            await fetchStatus();
        } catch (e: unknown) {
            notify('خطأ: ' + String(e), 'error');
        }
    };

    const handleResumeClient = async (deviceId: string) => {
        try {
            await api.lan.resumeClient(deviceId);
            notify('تم استئناف الجهاز', 'success');
            await fetchStatus();
        } catch (e: unknown) {
            notify('خطأ: ' + String(e), 'error');
        }
    };

    const handleBlockDevice = async (deviceId: string, deviceName: string) => {
        try {
            await api.lan.blockDevice(deviceId, deviceName, 'حظر يدوي');
            notify('تم حظر الجهاز', 'info');
            await fetchStatus();
        } catch (e: unknown) {
            notify('خطأ: ' + String(e), 'error');
        }
    };

    const handleUnblockDevice = async (id: number) => {
        try {
            await api.lan.unblockDevice(id);
            notify('تم إلغاء الحظر', 'success');
            await fetchStatus();
        } catch (e: unknown) {
            notify('خطأ: ' + String(e), 'error');
        }
    };

    const handleDisconnect = async () => {
        setLoading(true);
        try {
            await api.lan.disconnect();
            notify('تم قطع الاتصال', 'info');
            await fetchStatus();
        } catch (e: unknown) {
            notify('خطأ: ' + String(e), 'error');
        }
        setLoading(false);
    };

    const copyAddress = () => {
        if (serverStatus?.localIP) {
            navigator.clipboard.writeText(serverStatus.localIP);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    };

    const mode = clientStatus?.mode || 'standalone';

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Hero Header - Ultra Compact */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-3 text-text-main shadow-sm">
                <div className="absolute top-0 right-0 p-1 opacity-10">
                    <Wifi size={50} className="text-primary" />
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 dark:bg-white/5 rounded-lg border border-primary/20 dark:border-white/10 text-primary">
                        <Server size={18} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold tracking-tight">الربط الشبكي</h2>
                        <p className="text-text-muted text-[10px] opacity-90">إدارة الخادم والاتصال بالأجهزة المتعددة</p>
                    </div>
                </div>
            </div>

            {/* Current Mode Status Card */}
            <div className={`p-6 rounded-3xl border shadow-sm transition-all ${mode === 'server' ? 'bg-gradient-to-br from-primary/10 to-transparent border-primary/20 shadow-primary/5' :
                mode === 'client' ? 'bg-surface-active/50 border-border' :
                    'bg-surface/50 border-border'
                }`}>
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${mode === 'server' ? 'bg-primary text-black shadow-primary/30' :
                        mode === 'client' ? 'bg-surface-active border border-border text-text-main' :
                            'bg-surface-active text-text-muted'
                        }`}>
                        {mode === 'server' ? <Server size={28} /> : mode === 'client' ? <Monitor size={28} /> : <WifiOff size={28} />}
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-text-main mb-1">
                            {mode === 'server' ? 'الجهاز يعمل كخادم 🟢' : mode === 'client' ? 'الجهاز متصل كعميل 🔵' : 'الوضع المستقل ⚪'}
                        </h4>
                        <p className="text-sm font-medium opacity-80">
                            {mode === 'server' ? `${connectedClients.length} أجهزة متصلة حالياً` :
                                mode === 'client' ? `متصل بالخادم: ${clientStatus?.serverAddress}` :
                                    'الجهاز غير مرتبط بأي شبكة (يعمل محلياً فقط)'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Server Section */}
            {mode !== 'client' && (
                <div className="bg-surface/50 border border-border rounded-3xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-text-main mb-6 flex items-center gap-2">
                        <Server size={20} className="text-primary" />
                        إعادة تشغيل الخادم (للجهاز الرئيسي)
                    </h3>

                    {serverStatus?.running ? (
                        <div className="space-y-6">
                            {/* Server Address Box */}
                            <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-bold text-text-muted mb-2">عنوان IP للاتصال (اعطه للكاشير)</p>
                                    <div className="flex items-center gap-3">
                                        <code className="bg-black/80 text-emerald-400 px-4 py-2 rounded-lg text-lg font-mono tracking-wider shadow-inner" dir="ltr">
                                            {serverStatus.localIP}
                                        </code>
                                        <div className="h-8 w-px bg-border mx-2" />
                                        <span className="text-sm font-mono text-text-muted">Port: {serverStatus.port}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={copyAddress}
                                    className="p-3 bg-surface-active hover:bg-emerald-500 hover:text-white rounded-xl transition-all group border border-border"
                                    title="نسخ العنوان"
                                >
                                    {copied ? <Check size={20} /> : <Copy size={20} />}
                                </button>
                            </div>

                            {/* Connected Clients Panel */}
                            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                                <div className="flex border-b border-border bg-surface-active/30">
                                    <button
                                        onClick={() => setActiveTab('clients')}
                                        className={`flex-1 py-3 text-sm font-bold transition-all ${activeTab === 'clients' ? 'bg-surface text-primary border-t-2 border-primary' : 'text-text-muted hover:bg-surface/50'}`}
                                    >
                                        <Users size={14} className="inline ml-2" /> المتصلون ({connectedClients.length})
                                    </button>
                                    <div className="w-px bg-border" />
                                    <button
                                        onClick={() => setActiveTab('blocked')}
                                        className={`flex-1 py-3 text-sm font-bold transition-all ${activeTab === 'blocked' ? 'bg-surface text-red-500 border-t-2 border-red-500' : 'text-text-muted hover:bg-surface/50'}`}
                                    >
                                        <Shield size={14} className="inline ml-2" /> المحظورون ({blockedDevices.length})
                                    </button>
                                </div>

                                <div className="p-4 min-h-[200px] max-h-[300px] overflow-y-auto custom-scrollbar bg-surface/30">
                                    {activeTab === 'clients' ? (
                                        connectedClients.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-48 text-text-muted opacity-50">
                                                <Users size={32} className="mb-2" />
                                                <p>لا توجد أجهزة متصلة حالياً</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {connectedClients.map((client) => (
                                                    <div key={client.deviceId} className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border hover:border-border/80 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${client.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                                <Monitor size={20} />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-text-main text-sm">{client.deviceName || 'جهاز غير معروف'}</p>
                                                                <div className="flex items-center gap-2 text-[10px] text-text-muted">
                                                                    <span className="font-mono bg-surface-active px-1.5 rounded">{client.ipAddress}</span>
                                                                    <span>•</span>
                                                                    <span>منذ {formatTime(client.connectedAt)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {client.status === 'suspended' ? (
                                                                <button onClick={() => handleResumeClient(client.deviceId)} className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg transition-colors" title="استئناف"><Play size={14} /></button>
                                                            ) : (
                                                                <button onClick={() => handleSuspendClient(client.deviceId)} className="p-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white rounded-lg transition-colors" title="تعليق مؤقت"><Ban size={14} /></button>
                                                            )}
                                                            <button onClick={() => handleDisconnectClient(client.deviceId)} className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors" title="فصل"><UserX size={14} /></button>
                                                            <button onClick={() => handleBlockDevice(client.deviceId, client.deviceName)} className="p-2 bg-slate-500/10 hover:bg-slate-800 text-slate-500 hover:text-white rounded-lg transition-colors" title="حظر دائم"><Shield size={14} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    ) : (
                                        blockedDevices.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-48 text-text-muted opacity-50">
                                                <Shield size={32} className="mb-2" />
                                                <p>لا توجد أجهزة محظورة</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {blockedDevices.map((device) => (
                                                    <div key={device.id} className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                                                                <Ban size={20} />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-text-main text-sm">{device.deviceName}</p>
                                                                <p className="text-[10px] text-red-400">محظور: {formatTime(device.blockedAt)}</p>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => handleUnblockDevice(device.id)} className="p-2 bg-white/50 hover:bg-emerald-500 hover:text-white text-text-muted rounded-lg transition-colors" title="إلغاء الحظر"><Trash2 size={14} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={handleStopServer}
                                disabled={loading}
                                className="w-full py-4 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 border border-red-500/20 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                            >
                                <PowerOff size={18} /> إيقاف خدمة الخادم
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-text-muted mb-6 max-w-md mx-auto">
                                قم بتحويل هذا الجهاز إلى خادم رئيسي للسماح للأجهزة الأخرى (الكاشير، المطبخ) بالاتصال به ومزامنة البيانات وتلقي الطلبات.
                            </p>
                            <button
                                onClick={handleStartServer}
                                disabled={loading || clientStatus?.connected}
                                className="px-8 py-4 bg-gradient-to-r from-primary to-emerald-400 text-black rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.01] transition-all flex items-center justify-center gap-3 mx-auto disabled:opacity-50 disabled:transform-none disabled:shadow-none"
                            >
                                {loading ? <RefreshCw size={20} className="animate-spin" /> : <Power size={20} />}
                                تشغيل كخادم رئيسي
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Divider if standalone */}
            {mode === 'standalone' && (
                <div className="flex items-center gap-4 px-8 opacity-50">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                    <span className="text-xs font-bold text-text-muted uppercase tracking-widest">خيارات الاتصال</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                </div>
            )}

            {/* Client Section */}
            {mode !== 'server' && (
                <div className="bg-surface/50 border border-border rounded-3xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-text-main mb-6 flex items-center gap-2">
                        <Monitor size={20} className="text-primary" />
                        وضع العميل (للأجهزة الفرعية)
                    </h3>

                    {mode === 'client' ? (
                        <div className="space-y-6">
                            <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                        <Wifi size={24} className="text-blue-500 animate-pulse" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-text-muted mb-1">متصل بالخادم:</p>
                                        <code className="text-xl font-mono font-bold text-blue-500 tracking-wider" dir="ltr">{clientStatus?.serverAddress}</code>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleDisconnect}
                                disabled={loading}
                                className="w-full py-4 bg-surface hover:bg-red-500 hover:text-white text-text-muted border border-border rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                            >
                                <WifiOff size={18} /> قطع الاتصال بالخادم
                            </button>
                        </div>
                    ) : showConnectForm ? (
                        <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-bold text-text-main">اكتشاف الخوادم المتاحة</h4>
                                <button
                                    onClick={handleScanServers}
                                    disabled={isScanning}
                                    className="px-3 py-1.5 bg-surface-active hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                >
                                    {isScanning ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                    تحديث
                                </button>
                            </div>

                            {/* Server List */}
                            <div className="min-h-[100px] max-h-[200px] overflow-y-auto custom-scrollbar space-y-2">
                                {isScanning ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-text-muted">
                                        <RefreshCw size={24} className="animate-spin mb-2 text-primary" />
                                        <p className="text-xs">جاري البحث عن الخوادم...</p>
                                    </div>
                                ) : discoveredServers.length > 0 ? (
                                    discoveredServers.map((server, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => { setSelectedServer(server); setManualIp(''); }}
                                            className={`w-full p-4 rounded-xl border text-right transition-all group ${selectedServer?.serverIP === server.serverIP
                                                ? 'bg-primary/10 border-primary shadow-md shadow-primary/10'
                                                : 'bg-bg border-border hover:border-primary/50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full ${selectedServer?.serverIP === server.serverIP ? 'bg-primary ring-2 ring-primary/30' : 'bg-emerald-400'}`} />
                                                    <div>
                                                        <span className={`font-bold text-sm block ${selectedServer?.serverIP === server.serverIP ? 'text-primary' : 'text-text-main'}`}>{server.serverName}</span>
                                                        <span className="text-[10px] text-text-muted">تم اكتشافه تلقائياً</span>
                                                    </div>
                                                </div>
                                                <code className="text-xs font-mono bg-surface-active px-2 py-1 rounded border border-border">{server.serverIP}</code>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="py-8 text-center bg-bg/50 rounded-xl border border-dashed border-border text-text-muted">
                                        <Ban size={24} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-xs">لم يتم العثور على خوادم. تأكد أن الخادم يعمل.</p>
                                    </div>
                                )}
                            </div>

                            <div className="h-px bg-border my-2" />

                            <div className="flex items-center gap-2 mb-2">
                                <Terminal size={14} className="text-text-muted" />
                                <span className="text-xs font-bold text-text-muted">أو أدخل العنوان يدوياً:</span>
                            </div>

                            <input
                                type="text"
                                value={manualIp}
                                onChange={(e) => { setManualIp(e.target.value); setSelectedServer(null); }}
                                placeholder="مثال: 192.168.1.100"
                                dir="ltr"
                                className="w-full p-3 bg-bg border border-border rounded-xl text-center font-mono text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            />

                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setShowConnectForm(false)}
                                    className="flex-1 py-3 bg-surface hover:bg-surface-active border border-border text-text-main rounded-xl font-bold transition-colors"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleConnectToServer}
                                    disabled={loading || (!selectedServer && !manualIp)}
                                    className="flex-[2] py-3 bg-primary hover:brightness-110 text-black rounded-xl font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                                >
                                    {loading ? <RefreshCw size={18} className="animate-spin" /> : <Wifi size={18} />}
                                    اتصال بالخادم
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-text-muted mb-6 max-w-md mx-auto">
                                اربط هذا الجهاز بشبكة المحل للعمل كنقطة بيع أو مطبخ متصل بالخادم الرئيسي.
                            </p>
                            <button
                                onClick={() => { setShowConnectForm(true); handleScanServers(); }}
                                className="px-8 py-4 bg-surface hover:bg-primary hover:text-black text-primary border-2 border-dashed border-primary/30 hover:border-primary rounded-xl font-bold transition-all flex items-center justify-center gap-3 mx-auto group shadow-md"
                            >
                                <Wifi size={20} className="group-hover:animate-pulse" />
                                الاتصال بسيرفر رئيسي
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Info Footer */}
            <div className="p-4 bg-primary-dim rounded-2xl border border-primary/20 flex items-start gap-3">
                <AlertTriangle size={20} className="text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-text-muted leading-relaxed">
                    <strong className="text-primary block mb-1">ملاحظات هامة للشبكة:</strong>
                    <ul className="list-disc list-inside space-y-1 opacity-80">
                        <li>يجب أن تكون جميع الأجهزة متصلة بنفس شبكة Wi-Fi أو الكايبل.</li>
                        <li>يفضل تثبيت IP ثابت (Static IP) للجهاز المضيف (الخادم) لمنع انقطاع الاتصال عند إعادة تشغيل الراوتر.</li>
                        <li>لا حاجة لإعدادات معقدة، الاتصال يتم تلقائياً عبر المنفذ الافتراضي للتطبيق.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
