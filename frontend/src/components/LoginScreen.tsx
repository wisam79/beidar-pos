import React, { useState, useEffect, useRef } from 'react';
import { Lock, User, Eye, EyeOff, LogIn, Hash, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../core/AuthContext';
import { api, Staff } from '../core/api';
import { NativeTitleBar } from './NativeTitleBar';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 LOGIN SCREEN - Beautiful Authentication Interface
// ═══════════════════════════════════════════════════════════════════════════════

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

export const LoginScreen = ({ onLoginSuccess }: LoginScreenProps) => {
    const { login, loginWithPIN } = useAuth();
    const [mode, setMode] = useState<'select' | 'password' | 'pin'>('select');
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [pin, setPin] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingStaff, setLoadingStaff] = useState(true);
    const [quickLoginMode, setQuickLoginMode] = useState(false); // True when returning user detected

    const pinInputRef = useRef<HTMLInputElement>(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    // Load active staff on mount
    useEffect(() => {
        const loadStaff = async () => {
            try {
                const staff = await api.staff.listActive();
                setStaffList(staff || []);

                // Check for saved staff ID (quick login on restart)
                const lastStaffId = localStorage.getItem('beidar_last_staff_id');
                if (lastStaffId && staff && staff.length > 0) {
                    const savedUser = staff.find(s => s.id === lastStaffId && s.active);
                    if (savedUser) {
                        // Found saved staff - go directly to PIN entry
                        setSelectedStaff(savedUser);
                        setUsername(savedUser.username);
                        setQuickLoginMode(true);
                        setMode('password');
                        setLoadingStaff(false);
                        return; // Skip auto-admin creation logic
                    }
                }

                // If no staff exists, create a default admin
                if (!staff || staff.length === 0) {
                    try {
                        // Create default admin
                        // @ts-expect-error - Partial staff object for creation
                        const newAdmin: Staff = {
                            name: 'Admin',
                            username: 'admin',
                            role: 'admin',
                            active: true,
                            permissions: [],
                            mustChangePin: true
                        };

                        // Pass password '0000' (admin role uses 4-digit PIN)
                        const created = await api.staff.create(newAdmin, '0000');

                        if (created) {
                            // Refresh staff list so the new admin appears
                            const refreshedStaff = await api.staff.listActive();
                            setStaffList(refreshedStaff || []);
                        }
                    } catch (err) {
                        console.error('Failed to auto-create admin:', err);
                        setError('فشل في تكوين حساب المسؤول الأولي. يرجى إعادة التشغيل.');
                    }
                }
            } catch (e) {
                console.error('Failed to load staff:', e);
                // SECURITY FIX: Show error instead of allowing access
                setError('خطأ في الاتصال بالخادم. الرجاء المحاولة مرة أخرى.');
            } finally {
                setLoadingStaff(false);
            }
        };
        loadStaff();
    }, []);

    // Focus inputs when mode changes
    useEffect(() => {
        if (mode === 'pin') {
            pinInputRef.current?.focus();
        } else if (mode === 'password') {
            passwordInputRef.current?.focus();
        }
    }, [mode]);

    // Handle staff selection
    const handleSelectStaff = (staff: Staff) => {
        setSelectedStaff(staff);
        setUsername(staff.username);
        setError('');
        setMode('password');
    };

    // Handle PIN input
    const handlePinChange = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 4);
        setPin(digits);
        setError('');

        // Auto-submit when 4 digits entered
        if (digits.length === 4) {
            handlePINLogin(digits);
        }
    };

    // Login with password
    const handlePasswordLogin = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!username.trim() || !password.trim()) {
            setError('الرجاء إدخال اسم المستخدم وكلمة المرور');
            return;
        }

        setLoading(true);
        setError('');

        const result = await login(username, password);

        if (result.success) {
            onLoginSuccess();
        } else {
            setError(result.message || 'فشل تسجيل الدخول');
        }

        setLoading(false);
    };

    // Login with PIN
    const handlePINLogin = async (pinValue: string) => {
        setLoading(true);
        setError('');

        const result = await loginWithPIN(pinValue);

        if (result.success) {
            onLoginSuccess();
        } else {
            setError(result.message || 'رمز PIN غير صحيح');
            setPin('');
            pinInputRef.current?.focus();
        }

        setLoading(false);
    };

    // Role badge colors
    const getRoleBadge = (role: string) => {
        const badges: Record<string, { bg: string; text: string; label: string }> = {
            admin: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'مدير' },
            manager: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'مشرف' },
            cashier: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'كاشير' },
            viewer: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'مشاهد' },
        };
        return badges[role] || badges.viewer;
    };

    if (loadingStaff) {
        return (
            <div className="fixed inset-0 bg-bg flex items-center justify-center" data-theme="dark">
                <Loader2 size={48} className="text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-bg flex flex-col overflow-hidden" data-theme="dark">
            {/* Title Bar */}
            <NativeTitleBar theme="dark" />

            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-mesh z-0">
                <div className="absolute top-1/4 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
            </div>

            {/* Main Content Area - Centered */}
            <div className="flex-1 flex items-center justify-center relative z-10 w-full p-4">
                {/* Login Card */}
                <div className="w-full max-w-md">
                    {/* Logo/Brand */}
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-primary via-emerald-400 to-cyan-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-[0_20px_60px_-20px_var(--color-primary)]">
                            <Lock size={40} className="text-black" />
                        </div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-400 to-cyan-400">
                            Baidar POS
                        </h1>
                        <p className="text-text-muted mt-2">تسجيل الدخول للمتابعة</p>
                    </div>

                    {/* Card */}
                    <div className="bg-surface/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">

                        {/* Staff Selection Mode */}
                        {mode === 'select' && (
                            <div className="p-6">
                                <h2 className="text-lg font-bold text-text-main mb-4 text-center">اختر حسابك</h2>

                                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {staffList.map((staff) => {
                                        const badge = getRoleBadge(staff.role);
                                        return (
                                            <button
                                                key={staff.id}
                                                onClick={() => handleSelectStaff(staff)}
                                                className="w-full flex items-center gap-4 p-4 bg-bg/50 rounded-2xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                                            >
                                                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                                                    {staff.name.charAt(0)}
                                                </div>
                                                <div className="flex-1 text-right">
                                                    <h3 className="font-bold text-text-main">{staff.name}</h3>
                                                    <p className="text-[11px] text-text-muted">@{staff.username}</p>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                                                    {badge.label}
                                                </span>
                                                <ChevronRight size={18} className="text-text-muted group-hover:text-primary group-hover:-translate-x-1 transition-all" />
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* PIN Login Option Removed as per user request */}
                            </div>
                        )}

                        {/* Password Login Mode */}
                        {mode === 'password' && (
                            <div className="p-6">
                                {/* Back button */}
                                <button
                                    type="button"
                                    onClick={() => { setMode('select'); setError(''); setPassword(''); setQuickLoginMode(false); }}
                                    className="text-text-muted hover:text-primary text-sm mb-4 flex items-center gap-1"
                                >
                                    <ChevronRight size={16} className="rotate-180" />
                                    {quickLoginMode ? 'تغيير الحساب' : 'رجوع'}
                                </button>

                                {/* Selected User */}
                                {selectedStaff && (
                                    <div className="flex flex-col items-center mb-6">
                                        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl mb-2 shadow-lg shadow-primary/10">
                                            {selectedStaff.name.charAt(0)}
                                        </div>
                                        <h3 className="font-bold text-text-main text-lg">{selectedStaff.name}</h3>
                                        <p className="text-xs text-text-muted">@{selectedStaff.username}</p>
                                    </div>
                                )}

                                {/* Password Display Dots with shake */}
                                <div className={`flex justify-center gap-3 mb-6 ${error ? 'animate-shake' : ''}`}>
                                    {[0, 1, 2, 3].map((i) => (
                                        <div
                                            key={i}
                                            className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-all duration-200 ${password.length > i
                                                ? 'border-primary bg-primary/20 text-primary scale-110'
                                                : 'border-border bg-bg text-text-muted'
                                                }`}
                                        >
                                            {password[i] ? '●' : ''}
                                        </div>
                                    ))}
                                </div>

                                {/* First-time login hint (Redesigned) */}
                                {selectedStaff?.username === 'admin' && selectedStaff?.lastLogin === 0 && (
                                    <div className="mb-4 flex justify-center animate-pulse">
                                        <span className="text-[10px] text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-full border border-amber-400/20 shadow-sm flex items-center gap-2">
                                            <span>🔑 الرمز الافتراضي:</span>
                                            <span className="font-mono font-bold tracking-widest">0000</span>
                                        </span>
                                    </div>
                                )}

                                {/* Error */}
                                {error && (
                                    <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs mb-4 text-center">
                                        {error}
                                    </div>
                                )}

                                {/* Numpad for Password */}
                                <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => {
                                                if (password.length < 4 && !loading) {
                                                    const newPass = password + num;
                                                    setPassword(newPass);
                                                    setError('');
                                                    if (newPass.length === 4) {
                                                        // Trigger login manually since we aren't using a form submit
                                                        // We need to pass the password directly or wait for state update?
                                                        // Better to just call login wrapper function
                                                        const doLogin = async () => {
                                                            setLoading(true);
                                                            const result = await login(username, newPass);
                                                            if (result.success) {
                                                                onLoginSuccess();
                                                            } else {
                                                                setError(result.message || 'فشل تسجيل الدخول');
                                                                setPassword(''); // Clear on error
                                                            }
                                                            setLoading(false);
                                                        };
                                                        doLogin();
                                                    }
                                                }
                                            }}
                                            disabled={loading}
                                            className="h-14 rounded-xl bg-bg border border-border hover:border-primary hover:bg-primary/10 text-text-main text-xl font-bold transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {num}
                                        </button>
                                    ))}
                                    {/* Clear button */}
                                    <button
                                        type="button"
                                        onClick={() => { setPassword(''); setError(''); }}
                                        disabled={loading}
                                        className="h-14 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        مسح
                                    </button>
                                    {/* Zero */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (password.length < 4 && !loading) {
                                                const newPass = password + '0';
                                                setPassword(newPass);
                                                setError('');
                                                if (newPass.length === 4) {
                                                    const doLogin = async () => {
                                                        setLoading(true);
                                                        const result = await login(username, newPass);
                                                        if (result.success) {
                                                            onLoginSuccess();
                                                        } else {
                                                            setError(result.message || 'فشل تسجيل الدخول');
                                                            setPassword('');
                                                        }
                                                        setLoading(false);
                                                    };
                                                    doLogin();
                                                }
                                            }
                                        }}
                                        disabled={loading}
                                        className="h-14 rounded-xl bg-bg border border-border hover:border-primary hover:bg-primary/10 text-text-main text-xl font-bold transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        0
                                    </button>
                                    {/* Backspace */}
                                    <button
                                        type="button"
                                        onClick={() => setPassword(password.slice(0, -1))}
                                        disabled={loading}
                                        className="h-14 rounded-xl bg-surface border border-border hover:bg-surface-hover text-text-muted text-lg transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        ⌫
                                    </button>
                                </div>

                                {loading && (
                                    <div className="flex justify-center mt-4">
                                        <Loader2 size={24} className="text-primary animate-spin" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PIN Login Mode */}
                        {mode === 'pin' && (
                            <div className="p-6">
                                {/* Back button */}
                                <button
                                    type="button"
                                    onClick={() => { setMode('select'); setError(''); setPin(''); }}
                                    className="text-text-muted hover:text-primary text-sm mb-4 flex items-center gap-1"
                                >
                                    <ChevronRight size={16} className="rotate-180" />
                                    رجوع
                                </button>

                                <div className="text-center mb-4">
                                    <Hash size={40} className="text-primary mx-auto mb-2" />
                                    <h2 className="text-lg font-bold text-text-main">أدخل رمز PIN</h2>
                                </div>

                                {/* PIN Display Dots with shake animation */}
                                <div className={`flex justify-center gap-3 mb-6 ${error ? 'animate-shake' : ''}`}>
                                    {[0, 1, 2, 3].map((i) => (
                                        <div
                                            key={i}
                                            className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-all duration-200 ${pin.length > i
                                                ? 'border-primary bg-primary/20 text-primary scale-110'
                                                : 'border-border bg-bg text-text-muted'
                                                }`}
                                        >
                                            {pin[i] ? '●' : ''}
                                        </div>
                                    ))}
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs mb-4 text-center">
                                        {error}
                                    </div>
                                )}

                                {/* Numpad */}
                                <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => {
                                                if (pin.length < 4 && !loading) {
                                                    const newPin = pin + num;
                                                    setPin(newPin);
                                                    setError('');
                                                    if (newPin.length === 4) {
                                                        handlePINLogin(newPin);
                                                    }
                                                }
                                            }}
                                            disabled={loading}
                                            className="h-14 rounded-xl bg-bg border border-border hover:border-primary hover:bg-primary/10 text-text-main text-xl font-bold transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {num}
                                        </button>
                                    ))}
                                    {/* Clear button */}
                                    <button
                                        type="button"
                                        onClick={() => { setPin(''); setError(''); }}
                                        disabled={loading}
                                        className="h-14 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        مسح
                                    </button>
                                    {/* Zero */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (pin.length < 4 && !loading) {
                                                const newPin = pin + '0';
                                                setPin(newPin);
                                                setError('');
                                                if (newPin.length === 4) {
                                                    handlePINLogin(newPin);
                                                }
                                            }
                                        }}
                                        disabled={loading}
                                        className="h-14 rounded-xl bg-bg border border-border hover:border-primary hover:bg-primary/10 text-text-main text-xl font-bold transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        0
                                    </button>
                                    {/* Backspace */}
                                    <button
                                        type="button"
                                        onClick={() => setPin(pin.slice(0, -1))}
                                        disabled={loading}
                                        className="h-14 rounded-xl bg-surface border border-border hover:bg-surface-hover text-text-muted text-lg transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        ⌫
                                    </button>
                                </div>

                                {loading && (
                                    <div className="flex justify-center mt-4">
                                        <Loader2 size={24} className="text-primary animate-spin" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <p className="text-center text-text-muted text-xs mt-6">
                        Baidar POS v1.3.9 • نظام نقاط البيع
                    </p>
                </div>
            </div>
        </div>
    );
};
