import React, { useState, useEffect } from 'react';
import { Lock, Mail, Key, User, ArrowRight, Loader2, Store, AlertTriangle, Server, Cloud, Sparkles, Shield, Zap } from 'lucide-react';
import { api } from '../core/api';

interface CloudLoginScreenProps {
    onSuccess: () => void;
}

// FloatingParticles removed for performance - was causing continuous GPU usage with animate-float infinite

// GridBackground removed for performance - was causing continuous GPU usage

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
                    onSuccess();
                }
            } else {
                setError(res?.message || 'فشل تسجيل الدخول');
            }
        } catch (err) {
            setError('خطأ في الاتصال');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!licenseKey) {
            setError('مفتاح الترخيص مطلوب للتسجيل');
            return;
        }
        setLoading(true);
        setError('');

        try {
            const check = await api.license.checkStatus(licenseKey);
            if (!check || !check.licensed) {
                setError(check?.message || 'مفتاح الترخيص غير صالح');
                setLoading(false);
                return;
            }

            const regRes = await api.cloud.register(email, password, storeName);
            if (!regRes || !regRes.success) {
                setError(regRes?.message || 'فشل إنشاء الحساب');
                setLoading(false);
                return;
            }

            const actRes = await api.license.activate(licenseKey);
            if (actRes && actRes.licensed) {
                onSuccess();
            } else {
                setError('فشل تفعيل الترخيص. جاري حذف الحساب...');
                try {
                    await api.cloud.deleteAccount();
                    setError('فشل تفعيل الترخيص. تم إلغاء العملية.');
                } catch (delErr) {
                    setError('فشل تفعيل الترخيص وفشل حذف الحساب. يرجى الاتصال بالدعم.');
                }
            }

        } catch (err) {
            setError('حدث خطأ غير متوقع');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLanConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await api.lan.connect(serverIP);
            onSuccess();
        } catch (err: unknown) {
            console.error(err);
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg || 'فشل الاتصال بالخادم');
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
                // Show success message (using error state for now with green color check or just alert)
                alert(res.message);
                setMode('login'); // Return to login
            } else {
                setError(res?.message || 'فشل إرسال رابط الاستعادة');
            }
        } catch (err) {
            console.error(err);
            setError('خطأ في الاتصال');
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
            {/* Background - Static gradient orbs (no animation for performance) */}
            <div className="absolute inset-0">
                {/* Primary gradient orbs */}
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-primary/20 via-emerald-500/10 to-transparent rounded-full blur-[150px]" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-cyan-500/15 via-blue-500/10 to-transparent rounded-full blur-[130px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-full blur-[100px]" />
            </div>

            {/* Main Content */}
            <div className="relative z-10 w-full max-w-md mx-4">
                {/* Hero Section - Compact */}
                <div className="text-center mb-4">
                    {/* Animated Logo - Smaller */}
                    <div className="relative inline-block mb-3">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 rounded-2xl blur-lg opacity-50" />
                        <div className="relative w-14 h-14 bg-gradient-to-br from-primary via-emerald-400 to-cyan-400 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30">
                            <Icon className="text-black" size={28} strokeWidth={2.5} />
                        </div>
                        <Sparkles className="absolute -top-1 -right-1 text-primary" size={14} />
                    </div>

                    <h1 className="text-2xl font-black mb-1">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-400 to-cyan-400">
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
                    <div className="inline-flex bg-surface backdrop-blur-xl rounded-2xl p-1.5 border border-border">
                        {modes.map(({ id, label, icon: TabIcon }) => (
                            <button
                                key={id}
                                onClick={() => { setMode(id); setError(''); }}
                                className={`
                                    relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2
                                    ${mode === id
                                        ? 'bg-gradient-to-r from-primary to-emerald-400 text-primary-fg shadow-lg shadow-primary/25'
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
                    {/* Card glow */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-emerald-400/20 to-cyan-400/20 rounded-[2rem] blur-xl opacity-50" />

                    <div className="relative bg-surface backdrop-blur-2xl rounded-3xl border border-border shadow-card overflow-hidden">
                        {/* Top accent line */}
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                        <div className="p-5">
                            {/* Error Message */}
                            {error && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 animate-shake">
                                    <AlertTriangle className="text-red-400 flex-shrink-0" size={16} />
                                    <span className="text-red-400 text-xs">{error}</span>
                                </div>
                            )}

                            <form onSubmit={
                                mode === 'login' ? handleLogin :
                                    mode === 'register' ? handleRegister :
                                        mode === 'lan' ? handleLanConnect :
                                            handleRecovery
                            } className="space-y-3">

                                {mode === 'lan' ? (
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
                                    className="relative w-full h-11 mt-4 group overflow-hidden rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {/* Button gradient background */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 transition-transform duration-300 group-hover:scale-105" />

                                    {/* Shine effect */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                                    </div>

                                    {/* Button content */}
                                    <div className="relative flex items-center justify-center gap-2 text-black font-bold">
                                        {loading ? (
                                            <Loader2 className="animate-spin" size={20} />
                                        ) : (
                                            <>
                                                <span>
                                                    {mode === 'login' ? 'تسجيل الدخول' : mode === 'register' ? 'إنشاء الحساب' : mode === 'lan' ? 'اتصال' : 'إرسال رابط الاستعادة'}
                                                </span>
                                                <ArrowRight size={18} className="group-hover:-translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </div>
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
