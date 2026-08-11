import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, Wifi, QrCode, CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '../../../core/api';
import { NotifyFunction } from '../../../core/types';

interface MobileScannerSettingsProps {
    notify: NotifyFunction;
}

export const MobileScannerSettings: React.FC<MobileScannerSettingsProps> = ({ notify }) => {
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
        const payload = {
            ip: ip,
            port: port,
            type: 'beidar-scanner',
            name: 'Desktop POS'
        };
        try {
            const url = await QRCode.toDataURL(JSON.stringify(payload), { width: 280, margin: 2 });
            setQrData(url);
        } catch (e) {
            console.error(e);
        }
    };

    const startServer = async () => {
        setIsLoading(true);
        try {
            await api.lan.startServer();
            await new Promise(r => setTimeout(r, 1000));
            notify('تم تشغيل سيرفر الاتصال بنجاح', 'success');
            fetchStatus();
        } catch {
            notify('فشل تشغيل السيرفر', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    return (
        <div className="space-y-5 animate-in fade-in duration-300 pb-8 select-none">
            {/* Header Banner */}
            <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-success/10 text-success border border-success/20">
                        <Smartphone size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-text-main">الماسح الضوئي بالجوال (Mobile Barcode)</h2>
                        <p className="text-text-muted text-xs font-semibold">تحويل كاميرا الهاتف إلى قارئ باركود لاسلكي متصل بالنظام</p>
                    </div>
                </div>
                <button
                    onClick={fetchStatus}
                    disabled={isLoading}
                    title="تحديث الحالة"
                    aria-label="تحديث الحالة"
                    className="p-2.5 text-text-muted hover:text-success hover:bg-surface-hover border border-border/60 rounded-xl transition-colors cursor-pointer"
                >
                    <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Instructions & Status */}
                <div className="space-y-5">
                    <div className={`p-5 rounded-2xl border ${serverStatus.running
                        ? 'bg-success/10 border-success/30'
                        : 'bg-surface border-border/80'
                        }`}>
                        <div className="flex items-start gap-3.5">
                            <div className={`p-2.5 rounded-xl border ${serverStatus.running ? 'bg-success/20 border-success/30 text-success' : 'bg-surface-hover border-border/60 text-text-muted'}`}>
                                <Wifi size={22} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-black text-base text-text-main mb-1">
                                    {serverStatus.running ? 'خدمة الاتصال اللاسلكي متصلة' : 'خدمة الاتصال متوقفة حالياً'}
                                </h3>
                                <p className="text-xs text-text-muted font-medium mb-3 leading-relaxed">
                                    {serverStatus.running
                                        ? `عنوان خادم الباركود: ${serverStatus.ip}`
                                        : 'يجب تشغيل خدمة الشبكة المحلية (LAN) ليتمكن هاتفك المحمول من الاقتران بالنظام.'}
                                </p>

                                {!serverStatus.running && (
                                    <button
                                        onClick={startServer}
                                        disabled={isLoading}
                                        className="bg-success text-primary-fg px-5 py-2.5 min-h-[44px] rounded-xl font-black text-xs hover:bg-success active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 border border-success"
                                    >
                                        تشغيل الخدمة الآن
                                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface rounded-2xl p-5 sm:p-6 border border-border/80">
                        <h4 className="font-black text-sm text-text-main flex items-center gap-2 mb-4">
                            <span className="w-6 h-6 rounded-lg bg-success/10 border border-success/20 text-success flex items-center justify-center text-xs font-mono font-black">1</span>
                            خطوات ربط القارئ بالجوال
                        </h4>
                        <ul className="space-y-3.5 text-xs font-semibold text-text-muted">
                            <li className="flex gap-3 items-center">
                                <CheckCircle2 size={18} className="text-success shrink-0" />
                                <span>تأكد من فتح تطبيق <b>Beidar Scanner</b> على الهاتف المحمول.</span>
                            </li>
                            <li className="flex gap-3 items-center">
                                <CheckCircle2 size={18} className="text-success shrink-0" />
                                <span>تأكد من اتصال الكمبيوتر والهاتف بنفس شبكة الواي فاي المحلية.</span>
                            </li>
                            <li className="flex gap-3 items-center">
                                <CheckCircle2 size={18} className="text-success shrink-0" />
                                <span>امسح كود QR الظاهر في اللوحة المقابلة بواسطة كاميرا التطبيق.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Left: QR Code Display */}
                <div className="flex flex-col items-center justify-center p-6 bg-surface rounded-2xl border border-border/80 text-center">
                    {serverStatus.running && qrData ? (
                        <>
                            <div className="bg-white p-4 rounded-xl border border-gray-200">
                                <img src={qrData} alt="Pairing QR" className="w-56 h-56 object-contain" />
                            </div>
                            <p className="mt-4 text-success font-mono text-xs font-black bg-success/10 border border-success/20 px-3.5 py-1.5 rounded-xl dir-ltr">
                                {serverStatus.ip}:{serverStatus.port}
                            </p>
                        </>
                    ) : (
                        <div className="text-center py-10">
                            <div className="w-16 h-16 bg-surface-hover rounded-2xl border border-border/60 flex items-center justify-center mx-auto mb-3 text-text-muted">
                                <QrCode size={32} />
                            </div>
                            <p className="text-text-muted text-xs font-bold">سيظهر رمز QR بمجرد تفعيل خدمة الاتصال</p>
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
