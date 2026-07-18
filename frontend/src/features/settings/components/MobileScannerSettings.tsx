import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, RefreshCw, Wifi, QrCode, CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '../../../core/api';
import { NotifyFunction } from '../../../core/types';

interface MobileScannerSettingsProps {
    notify: NotifyFunction;
}

export const MobileScannerSettings: React.FC<MobileScannerSettingsProps> = ({ notify }) => {
    const { t } = useTranslation();
    const [qrData, setQrData] = useState<string>('');
    const [serverStatus, setServerStatus] = useState<{ running: boolean; ip: string; port: number }>({
        running: false,
        ip: '',
        port: 0
    });
    const [isLoading, setIsLoading] = useState(false);

    const fetchStatus = async () => {
        setIsLoading(true);
        try {
            // Check if LAN server is running
            const status = await api.lan.getServerStatus();
            if (status.running) {
                setServerStatus({ running: true, ip: status.localIP, port: status.port });
                generateQR(status.localIP, status.port);
            } else {
                setServerStatus({ running: false, ip: '', port: 0 });
            }
        } catch (e) {
            console.error(e);
            notify('فشل في جلب حالة السيرفر', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const generateQR = async (ip: string, port: number) => {
        // Payload for the mobile app
        const payload = {
            ip: ip,
            port: port,
            type: 'beidar-scanner',
            name: 'Desktop POS'
        };
        try {
            const url = await QRCode.toDataURL(JSON.stringify(payload), { width: 300, margin: 2 });
            setQrData(url);
        } catch (e) {
            console.error(e);
        }
    };

    const startServer = async () => {
        setIsLoading(true);
        try {
            await api.lan.startServer();
            await new Promise(r => setTimeout(r, 1000)); // Wait for start
            notify('تم تشغيل سيرفر الاتصال بنجاح', 'success');
            fetchStatus();
        } catch (e) {
            notify('فشل تشغيل السيرفر', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <span className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Smartphone size={24} />
                        </span>
                        الماسح الضوئي بالجوال
                    </h2>
                    <p className="text-text-muted mt-1 text-sm">اجعل هاتفك قارئ باركود لاسلكي متصل بالنظام</p>
                </div>
                <button
                    onClick={fetchStatus}
                    disabled={isLoading}
                    title="تحديث الحالة"
                    aria-label="تحديث الحالة"
                    className="p-2 text-text-muted hover:text-primary hover:bg-surface rounded-lg transition-all"
                >
                    <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Right: Instructions & Controls */}
                <div className="space-y-6">
                    <div className={`p-6 rounded-lg border transition-all ${serverStatus.running
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-surface border-border'
                        }`}>
                        <div className="flex items-start gap-4">
                            <div className={`mt-1 p-2 rounded-full ${serverStatus.running ? 'bg-green-500/20 text-green-500' : 'bg-text-muted/10 text-text-muted'}`}>
                                <Wifi size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-lg mb-1">
                                    {serverStatus.running ? 'الاتصال جاهز' : 'الخدمة متوقفة'}
                                </h3>
                                <p className="text-sm text-text-muted mb-4 opacity-90 leading-relaxed">
                                    {serverStatus.running
                                        ? `النظام جاهز لاستقبال المسح. IP: ${serverStatus.ip}`
                                        : 'يجب تشغيل خدمة الاتصال (LAN) أولاً لكي يتمكن الهاتف من العثور على الكمبيوتر.'}
                                </p>

                                {!serverStatus.running && (
                                    <button
                                        onClick={startServer}
                                        disabled={isLoading}
                                        className="bg-primary text-black px-6 py-2.5 rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                                    >
                                        تشغيل الخدمة
                                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface rounded-lg p-6 border border-border">
                        <h4 className="font-bold flex items-center gap-2 mb-4">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">1</span>
                            خطوات الربط
                        </h4>
                        <ul className="space-y-4 text-sm text-text-muted">
                            <li className="flex gap-3">
                                <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
                                <span>حمل تطبيق <b>Beidar Scanner</b> على هاتفك.</span>
                            </li>
                            <li className="flex gap-3">
                                <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
                                <span>تأكد أن الهاتف والكمبيوتر متصلان بنفس شبكة الواي فاي.</span>
                            </li>
                            <li className="flex gap-3">
                                <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
                                <span>افتح التطبيق وامسح رمز QR الظاهر على اليسار.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Left: QR Code */}
                <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg border-4 border-gray-100 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-emerald-400"></div>

                    {serverStatus.running && qrData ? (
                        <>
                            <div className="relative">
                                <img src={qrData} alt="Pairing QR" className="w-64 h-64 object-contain mix-blend-multiply opacity-90 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <Smartphone className="text-primary opacity-10 w-24 h-24" />
                                </div>
                            </div>
                            <p className="mt-6 text-gray-500 font-mono text-xs bg-gray-100 px-3 py-1 rounded-full">
                                {serverStatus.ip}:{serverStatus.port}
                            </p>
                        </>
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                <QrCode size={40} />
                            </div>
                            <p className="text-gray-400 font-medium">رمز QR سيظهر هنا عند تشغيل الخدمة</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

// Simple loader helper
const Loader2 = ({ size, className }: { size?: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);
