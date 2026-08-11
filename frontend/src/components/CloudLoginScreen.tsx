import React, { useState } from 'react';
import { Lock, Mail, Key, User, ArrowRight, Loader2, Store, AlertTriangle, Server, Cloud, Shield, Zap } from 'lucide-react';
import { api, desktopApi } from '../core/api';

interface CloudLoginScreenProps {
    onSuccess: () => void;
}

// FloatingParticles removed for performance - was causing continuous GPU usage with animate-float infinite

// GridBackground removed for performance - was causing continuous GPU usage

const parseErrorMessage = (err: unknown, defaultMsg: string): string => {
    if (!err) return defaultMsg;
    if (typeof err === 'string') return err;
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'object') {
        const obj = err as Record<string, unknown>;
        if (typeof obj.message === 'string' && obj.message) return obj.message;
        if (typeof obj.error === 'string' && obj.error) return obj.error;
    }
    return String(err) || defaultMsg;
};

export const CloudLoginScreen: React.FC<CloudLoginScreenProps> = ({ onSuccess }) => {
    const [mode, setMode] = useState<'login' | 'register' | 'lan' | 'recovery'>('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [focusedField, setFocusedField] = useState<string | null>(null);

    // Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [storeName, setStoreName] = useState('');
    const [licenseKey, setLicenseKey] = useState('');
    const [serverIP, setServerIP] = useState('');
    const [serverSecret, setServerSecret] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await api.cloud.login(email, password);
            if (res && res.success) {
                const licStatus = await api.license.getUserLicenseStatus();
                if (licStatus && licStatus.licensed) {
                    onSuccess();
                } else {
                    setError(licStatus?.message || 'لا يوجد ترخيص نشط مرتبط بهذا الحساب');
                }
            } else {
                setError(res?.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
            }
        } catch (err: unknown) {
            console.error('Login Error:', err);
            setError(parseErrorMessage(err, 'فشل الاتصال بخادم تسجيل الدخول، يرجى التأكد من اتصال شبكة الإنترنت'));
        } finally {
            setLoading(false);
        }
    };

    const cleanupUnlicensedAccount = async (reason: string) => {
        try {
            await api.cloud.deleteAccount();
            setError(`فشل تفعيل الترخيص (${reason}). تم تصفية الحساب غير المفعل.`);
        } catch {
            setError(`فشل تفعيل الترخيص (${reason}). يرجى التواصل مع الدعم الفني.`);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            setError('البريد الإلكتروني مطلوب');
            return;
        }
        if (!password.trim()) {
            setError('كلمة المرور مطلوبة');
            return;
        }
        if (!licenseKey.trim()) {
            setError('مفتاح الترخيص مطلوب لإكمال التسجيل');
            return;
        }
        setLoading(true);
        setError('');

        try {
            const regRes = await api.cloud.register(email, password, storeName);
            if (!regRes || !regRes.success) {
                setError(regRes?.message || 'فشل إنشاء الحساب، يرجى التأكد من صحة البيانات وتوفر اتصال إنترنت');
                setLoading(false);
                return;
            }

            try {
                const actRes = await api.license.activate(licenseKey);
                if (actRes && actRes.licensed) {
                    onSuccess();
                } else {
                    const failReason = actRes?.message || 'مفتاح الترخيص غير صالح أو مستخدم مسبقاً';
                    await cleanupUnlicensedAccount(failReason);
                }
            } catch (actErr: unknown) {
                const failReason = parseErrorMessage(actErr, 'تعذر الاتصال بخادم التراخيص لتفعيل المفتاح');
                await cleanupUnlicensedAccount(failReason);
            }

        } catch (err: unknown) {
            console.error('Registration Error:', err);
            setError(parseErrorMessage(err, 'حدث خطأ أثناء التواصل مع خادم التسجيل السحابي'));
        } finally {
            setLoading(false);
        }
    };

    const handleLanConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await api.lan.connect(serverIP, 0, serverSecret);
            onSuccess();
        } catch (err: unknown) {
            console.error(err);
            setError(parseErrorMessage(err, 'فشل الاتصال بخادم الشبكة المحلية'));
        } finally {
            setLoading(false);
        }
    };

    const handleRecovery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError('البريد الإلكتروني مطلوب');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await api.cloud.recoverPassword(email);
            if (res && res.success) {
                setError(''); // clear error
                desktopApi.notifications.show("استعادة الحساب", res.message, "info");
                setMode('login'); // Return to login
            } else {
                setError(res?.message || 'فشل إرسال رابط الاستعادة');
            }
        } catch (err: unknown) {
            console.error(err);
            setError(parseErrorMessage(err, 'خطأ في الاتصال بخادم استعادة الحساب'));
        } finally {
            setLoading(false);
        }
    };

    const modes = [
        { id: 'login', label: 'تسجيل الدخول', icon: Lock },
        { id: 'register', label: 'حساب جديد', icon: User },
        { id: 'lan', label: 'شبكة محلية', icon: Server },
    ] as const;

    const getIcon = () => {
        if (mode === 'lan') return Server;
        if (mode === 'register') return User;
        return Cloud;
    };

    const Icon = getIcon();

    return (
        <div className="fixed inset-0 bg-bg flex items-center justify-center overflow-hidden" dir="rtl">
            {/* Main Content */}
            <div className="relative z-10 w-full max-w-md mx-4">
                {/* Hero Section - Compact */}
                <div className="text-center mb-4">
                    {/* Logo */}
                    <div className="relative inline-block mb-3">
                        <div className="relative w-14 h-14 bg-primary rounded-2xl flex items-center justify-center">
                            <Icon className="text-primary-fg" size={28} strokeWidth={2.5} />
                        </div>
                    </div>

                    <h1 className="text-2xl font-black mb-1">
                        <span className="text-primary">
                            {mode === 'login' ? 'سحابة بيدر' : mode === 'register' ? 'انضم إلينا' : mode === 'lan' ? 'الشبكة المحلية' : 'استعادة الحساب'}
                        </span>
                    </h1>
                    <p className="text-text-muted text-xs">
                        {mode === 'login' && 'سجل دخولك للوصول إلى بياناتك'}
                        {mode === 'register' && 'أنشئ حسابك وابدأ رحلة النجاح'}
                        {mode === 'lan' && 'اتصل بالخادم الرئيسي'}
                        {mode === 'recovery' && 'أدخل بريدك الإلكتروني لاستعادة كلمة المرور'}
                    </p>
                </div>

                {/* Mode Tabs - Compact */}
                <div className="flex justify-center mb-4">
                    <div className="inline-flex bg-surface  rounded-2xl p-1.5 border border-border">
                        {modes.map(({ id, label, icon: TabIcon }) => (
                            <button
                                key={id}
                                onClick={() => { setMode(id); setError(''); }}
                                className={`
                                    relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2
                                    ${mode === id
                                        ? 'bg-primary text-primary-fg shadow-lg shadow-primary/25'
                                        : 'text-text-muted hover:text-text hover:bg-surface-hover'
                                    }
                                `}
                            >
                                <TabIcon size={16} />
                                <span className="hidden sm:inline">{label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Card */}
                <div className="relative">
                    <div className="relative bg-surface  rounded-3xl border border-border overflow-hidden">
                        {/* Top accent line */}
                        <div className="absolute top-0 left-0 right-0 h-px bg-transparent" />

                        <div className="p-5">
                            {/* Error Message */}
                            {error && (
                                <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl flex items-center gap-2 animate-shake">
                                    <AlertTriangle className="text-danger flex-shrink-0" size={16} />
                                    <span className="text-danger text-xs">{error}</span>
                                </div>
                            )}

                            <form onSubmit={
                                mode === 'login' ? handleLogin :
                                    mode === 'register' ? handleRegister :
                                        mode === 'lan' ? handleLanConnect :
                                            handleRecovery
                            } className="space-y-3">

                                {mode === 'lan' ? (
                                    <>
                                        <InputField
                                            icon={Server}
                                            label="عنوان الخادم (IP)"
                                            type="text"
                                            value={serverIP}
                                            onChange={setServerIP}
                                            placeholder="192.168.1.xxx"
                                            hint="تأكد من تشغيل بث الشبكة على الجهاز الرئيسي"
                                            focused={focusedField === 'serverIP'}
                                            onFocus={() => setFocusedField('serverIP')}
                                            onBlur={() => setFocusedField(null)}
                                            mono
                                        />
                                        <InputField
                                            icon={Shield}
                                            label="رمز سر الخادم (اختياري)"
                                            type="password"
                                            value={serverSecret}
                                            onChange={setServerSecret}
                                            placeholder="أدخل الرمز السري"
                                            focused={focusedField === 'serverSecret'}
                                            onFocus={() => setFocusedField('serverSecret')}
                                            onBlur={() => setFocusedField(null)}
                                        />
                                    </>
                                ) : (
                                    <>
                                        {mode === 'register' && (
                                            <InputField
                                                icon={Store}
                                                label="اسم المتجر"
                                                type="text"
                                                value={storeName}
                                                onChange={setStoreName}
                                                placeholder="مثال: سوبر ماركت النور"
                                                focused={focusedField === 'storeName'}
                                                onFocus={() => setFocusedField('storeName')}
                                                onBlur={() => setFocusedField(null)}
                                            />
                                        )}

                                        <InputField
                                            icon={Mail}
                                            label="البريد الإلكتروني"
                                            type="email"
                                            value={email}
                                            onChange={setEmail}
                                            placeholder="example@email.com"
                                            focused={focusedField === 'email'}
                                            onFocus={() => setFocusedField('email')}
                                            onBlur={() => setFocusedField(null)}
                                        />

                                        {mode !== 'recovery' && (
                                            <div className="space-y-1">
                                                <InputField
                                                    icon={Key}
                                                    label="كلمة المرور"
                                                    type="password"
                                                    value={password}
                                                    onChange={setPassword}
                                                    placeholder="••••••••"
                                                    minLength={6}
                                                    focused={focusedField === 'password'}
                                                    onFocus={() => setFocusedField('password')}
                                                    onBlur={() => setFocusedField(null)}
                                                />
                                                {mode === 'login' && (
                                                    <div className="flex justify-end px-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => { setMode('recovery'); setError(''); }}
                                                            className="text-[10px] text-primary/80 hover:text-primary transition-colors cursor-pointer"
                                                        >
                                                            نسيت كلمة المرور؟
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {mode === 'recovery' && (
                                            <div className="flex justify-end px-1">
                                                <button
                                                    type="button"
                                                    onClick={() => { setMode('login'); setError(''); }}
                                                    className="text-[10px] text-text-muted hover:text-text-main transition-colors cursor-pointer"
                                                >
                                                    العودة لتسجيل الدخول
                                                </button>
                                            </div>
                                        )}

                                        {mode === 'register' && (
                                            <div className="pt-2">
                                                <InputField
                                                    icon={Shield}
                                                    label="مفتاح الترخيص"
                                                    type="text"
                                                    value={licenseKey}
                                                    onChange={setLicenseKey}
                                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                                    hint="سيتم ربط الترخيص بحسابك بشكل دائم"
                                                    focused={focusedField === 'licenseKey'}
                                                    onFocus={() => setFocusedField('licenseKey')}
                                                    onBlur={() => setFocusedField(null)}
                                                    highlighted
                                                    mono
                                                />
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="relative w-full h-11 mt-4 rounded-xl bg-primary text-primary-fg font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <Loader2 className="animate-spin" size={20} />
                                    ) : (
                                        <>
                                            <span>
                                                {mode === 'login' ? 'تسجيل الدخول' : mode === 'register' ? 'إنشاء الحساب' : mode === 'lan' ? 'اتصال' : 'إرسال رابط الاستعادة'}
                                            </span>
                                            <ArrowRight size={18} />
                                        </>
                                    )}
                                </button>
                            </form>

                            {mode === 'login' && (
                                <div className="mt-8 pt-6 border-t border-border">
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        {[
                                            { icon: Cloud, label: 'نسخ احتياطي' },
                                            { icon: Shield, label: 'حماية متقدمة' },
                                            { icon: Zap, label: 'سرعة فائقة' },
                                        ].map(({ icon: FeatureIcon, label }) => (
                                            <div key={label} className="flex flex-col items-center gap-2 text-text-muted">
                                                <div className="w-10 h-10 bg-surface-hover rounded-xl flex items-center justify-center">
                                                    <FeatureIcon size={18} />
                                                </div>
                                                <span className="text-xs">{label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-text-muted text-xs mt-6">
                    بالتسجيل، أنت توافق على شروط الاستخدام وسياسة الخصوصية
                </p>
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
                    50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
                }
                @keyframes gridMove {
                    0% { transform: translate(0, 0); }
                    100% { transform: translate(50px, 50px); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                    20%, 40%, 60%, 80% { transform: translateX(5px); }
                }
                .animate-float { animation: float linear infinite; }
                .animate-shake { animation: shake 0.5s ease-in-out; }
            `}</style>
        </div>
    );
};

// Reusable Input Field Component
interface InputFieldProps {
    icon: typeof Lock;
    label: string;
    type: string;
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    hint?: string;
    minLength?: number;
    focused?: boolean;
    onFocus?: () => void;
    onBlur?: () => void;
    highlighted?: boolean;
    mono?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({
    icon: Icon,
    label,
    type,
    value,
    onChange,
    placeholder,
    hint,
    minLength,
    focused,
    onFocus,
    onBlur,
    highlighted,
    mono,
}) => (
    <div className="space-y-1.5">
        {/* Label with Icon */}
        <div className="flex items-center gap-2 px-1">
            <div className={`
                w-6 h-6 rounded-md flex items-center justify-center transition-colors duration-200
                ${focused ? 'bg-primary-dim text-primary' : 'bg-surface-hover text-text-muted'}
                ${highlighted ? 'bg-primary-dim text-primary' : ''}
            `}>
                <Icon size={14} />
            </div>
            <label className={`text-xs font-medium ${highlighted ? 'text-primary' : 'text-text-muted'}`}>
                {label}
            </label>
        </div>

        {/* Input Field */}
        <div className={`
            relative rounded-lg transition-all duration-200
            ${focused ? 'ring-2 ring-primary/40' : ''}
        `}>
            <input
                type={type}
                required
                value={value}
                onChange={e => onChange(e.target.value)}
                onFocus={onFocus}
                onBlur={onBlur}
                minLength={minLength}
                className={`
                    w-full bg-input-bg border border-border rounded-lg py-2.5 px-3 text-sm text-text
                    focus:border-primary focus:bg-surface outline-none transition-all duration-200
                    placeholder:text-text-muted/60
                    ${highlighted ? 'border-primary/40 bg-primary-dim' : ''}
                    ${mono ? 'font-mono tracking-wider' : ''}
                `}
                placeholder={placeholder}
            />
        </div>

        {/* Hint */}
        {hint && (
            <p className="text-[10px] text-text-muted px-1 mr-8">{hint}</p>
        )}
    </div>
);
