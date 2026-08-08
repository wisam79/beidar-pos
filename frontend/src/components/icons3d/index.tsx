import React from 'react';

interface Icon3DProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    className?: string;
}

/**
 * 3D POS Register & Smart Terminal Icon
 */
export const Pos3DIcon: React.FC<Icon3DProps> = ({ size = 48, className = '', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <defs>
            <linearGradient id="pos_body" x1="12" y1="18" x2="52" y2="54" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <linearGradient id="pos_screen" x1="18" y1="12" x2="46" y2="34" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="pos_glass" x1="20" y1="14" x2="44" y2="28" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.05" />
            </linearGradient>
            <filter id="pos_shadow" x="4" y="6" width="56" height="56" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#047857" floodOpacity="0.35" />
            </filter>
        </defs>
        <g filter="url(#pos_shadow)">
            {/* Base Stand / Register Body */}
            <path d="M12 40L18 48H46L52 40L48 24H16L12 40Z" fill="url(#pos_body)" />
            {/* Screen Front / Stand */}
            <rect x="14" y="10" width="36" height="26" rx="5" fill="url(#pos_screen)" stroke="#A7F3D0" strokeWidth="1.5" />
            {/* Glass Glare */}
            <rect x="16" y="12" width="32" height="14" rx="3" fill="url(#pos_glass)" />
            {/* Cart / Item Icon on Screen */}
            <circle cx="32" cy="22" r="5" fill="#FFFFFF" fillOpacity="0.9" />
            <path d="M29 22L31 24L35 20" stroke="#047857" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Keypad Buttons Base */}
            <rect x="20" y="42" width="6" height="3" rx="1" fill="#A7F3D0" />
            <rect x="29" y="42" width="6" height="3" rx="1" fill="#A7F3D0" />
            <rect x="38" y="42" width="6" height="3" rx="1" fill="#A7F3D0" />
            {/* Card Reader Slot */}
            <path d="M48 28L54 26V34L48 36V28Z" fill="#FBBF24" />
            <rect x="49" y="27" width="4" height="2" rx="0.5" fill="#F59E0B" />
        </g>
    </svg>
);

/**
 * 3D Package & Inventory Box Icon
 */
export const Products3DIcon: React.FC<Icon3DProps> = ({ size = 48, className = '', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <defs>
            <linearGradient id="box_top" x1="16" y1="12" x2="48" y2="28" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
            <linearGradient id="box_left" x1="12" y1="26" x2="32" y2="52" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
            <linearGradient id="box_right" x1="32" y1="26" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1E40AF" />
                <stop offset="100%" stopColor="#172554" />
            </linearGradient>
            <filter id="box_shadow" x="4" y="6" width="56" height="56" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#1D4ED8" floodOpacity="0.35" />
            </filter>
        </defs>
        <g filter="url(#box_shadow)">
            {/* Top Isometric Face */}
            <path d="M32 10L52 20L32 30L12 20L32 10Z" fill="url(#box_top)" stroke="#93C5FD" strokeWidth="1" />
            {/* Left Face */}
            <path d="M12 20L32 30V50L12 40V20Z" fill="url(#box_left)" />
            {/* Right Face */}
            <path d="M32 30L52 20V40L32 50V30Z" fill="url(#box_right)" />
            {/* Box Tape / Label */}
            <path d="M26 13L38 19L38 33L26 27V13Z" fill="#FCD34D" fillOpacity="0.9" />
            <path d="M38 19L38 33L46 29V15L38 19Z" fill="#F59E0B" fillOpacity="0.9" />
        </g>
    </svg>
);

/**
 * 3D Invoices & Sales Receipt Icon
 */
export const Invoices3DIcon: React.FC<Icon3DProps> = ({ size = 48, className = '', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <defs>
            <linearGradient id="inv_page" x1="16" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>
            <linearGradient id="inv_stamp" x1="28" y1="34" x2="48" y2="50" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <filter id="inv_shadow" x="6" y="4" width="52" height="58" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="5" stdDeviation="3.5" floodColor="#475569" floodOpacity="0.3" />
            </filter>
        </defs>
        <g filter="url(#inv_shadow)">
            {/* Folded Paper Sheet */}
            <path d="M16 10C16 7.79 17.79 6 20 6H40L50 16V52C50 54.21 48.21 56 46 56H20C17.79 56 16 54.21 16 52V10Z" fill="url(#inv_page)" stroke="#CBD5E1" strokeWidth="1.5" />
            {/* Paper Fold Corner */}
            <path d="M40 6V14C40 15.1 40.9 16 42 16H50" fill="#94A3B8" />
            {/* Text Lines */}
            <rect x="22" y="16" width="14" height="2.5" rx="1.2" fill="#64748B" />
            <rect x="22" y="23" width="22" height="2" rx="1" fill="#94A3B8" />
            <rect x="22" y="29" width="18" height="2" rx="1" fill="#94A3B8" />
            <rect x="22" y="35" width="20" height="2" rx="1" fill="#94A3B8" />
            {/* 3D Success Stamp Badge */}
            <circle cx="38" cy="42" r="9" fill="url(#inv_stamp)" stroke="#A7F3D0" strokeWidth="1.5" />
            <path d="M34 42L37 45L42 39" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
    </svg>
);

/**
 * 3D Cash Vault & Shift Icon
 */
export const Vault3DIcon: React.FC<Icon3DProps> = ({ size = 48, className = '', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <defs>
            <linearGradient id="vault_body" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="50%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#92400E" />
            </linearGradient>
            <linearGradient id="vault_door" x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FDE68A" />
                <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <filter id="vault_shadow" x="4" y="6" width="56" height="56" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#B45309" floodOpacity="0.4" />
            </filter>
        </defs>
        <g filter="url(#vault_shadow)">
            {/* Vault Outer Shell */}
            <rect x="10" y="10" width="44" height="44" rx="8" fill="url(#vault_body)" stroke="#FDE68A" strokeWidth="1.5" />
            {/* Vault Door Inset */}
            <rect x="15" y="15" width="34" height="34" rx="5" fill="url(#vault_door)" stroke="#B45309" strokeWidth="1.5" />
            {/* Dial Wheel */}
            <circle cx="32" cy="32" r="9" fill="#78350F" stroke="#FDE68A" strokeWidth="2" />
            <circle cx="32" cy="32" r="4" fill="#FBBF24" />
            <path d="M32 25V27M32 37V39M25 32H27M37 32H39" stroke="#FDE68A" strokeWidth="1.5" strokeLinecap="round" />
            {/* Vault Handle */}
            <circle cx="43" cy="32" r="2.5" fill="#78350F" />
        </g>
    </svg>
);

/**
 * 3D Customers & Debts Loyalty Icon
 */
export const Customers3DIcon: React.FC<Icon3DProps> = ({ size = 48, className = '', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <defs>
            <linearGradient id="cust_bg" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#A855F7" />
                <stop offset="100%" stopColor="#6B21A8" />
            </linearGradient>
            <linearGradient id="cust_avatar" x1="22" y1="14" x2="42" y2="38" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#E9D5FF" />
                <stop offset="100%" stopColor="#C084FC" />
            </linearGradient>
            <filter id="cust_shadow" x="4" y="6" width="56" height="56" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#7E22CE" floodOpacity="0.35" />
            </filter>
        </defs>
        <g filter="url(#cust_shadow)">
            {/* Shield / Badge Shape */}
            <path d="M32 8L50 15V29C50 41.5 42 49.5 32 54C22 49.5 14 41.5 14 29V15L32 8Z" fill="url(#cust_bg)" stroke="#E9D5FF" strokeWidth="1.5" />
            {/* User Avatar Head */}
            <circle cx="32" cy="24" r="7" fill="url(#cust_avatar)" />
            {/* User Body Curve */}
            <path d="M22 43C22 37.48 26.48 33 32 33C37.52 33 42 37.48 42 43V45C39 48 35.5 49.5 32 50C28.5 49.5 25 48 22 45V43Z" fill="url(#cust_avatar)" />
            {/* Sparkle Star */}
            <path d="M44 14L45 17L48 18L45 19L44 22L43 19L40 18L43 17L44 14Z" fill="#FDE047" />
        </g>
    </svg>
);

/**
 * 3D Analytics & Growth Reports Icon
 */
export const Reports3DIcon: React.FC<Icon3DProps> = ({ size = 48, className = '', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <defs>
            <linearGradient id="rep_bar1" x1="16" y1="34" x2="24" y2="52" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="rep_bar2" x1="28" y1="24" x2="36" y2="52" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>
            <linearGradient id="rep_bar3" x1="40" y1="14" x2="48" y2="52" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <filter id="rep_shadow" x="4" y="6" width="56" height="56" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#0284C7" floodOpacity="0.35" />
            </filter>
        </defs>
        <g filter="url(#rep_shadow)">
            {/* Base Platform */}
            <rect x="10" y="50" width="44" height="6" rx="3" fill="#334155" />
            {/* Bar 1 */}
            <rect x="14" y="34" width="9" height="17" rx="3" fill="url(#rep_bar1)" stroke="#BAE6FD" strokeWidth="1" />
            {/* Bar 2 */}
            <rect x="27" y="24" width="9" height="27" rx="3" fill="url(#rep_bar2)" stroke="#C7D2FE" strokeWidth="1" />
            {/* Bar 3 */}
            <rect x="40" y="14" width="9" height="37" rx="3" fill="url(#rep_bar3)" stroke="#A7F3D0" strokeWidth="1" />
            {/* Trend Arrow */}
            <path d="M14 30L26 20L36 24L48 10" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M42 10H48V16" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
    </svg>
);

/**
 * 3D AI Assistant Spark Icon
 */
export const AI3DIcon: React.FC<Icon3DProps> = ({ size = 48, className = '', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <defs>
            <linearGradient id="ai_crystal" x1="16" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#EC4899" />
                <stop offset="50%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
            <filter id="ai_shadow" x="4" y="4" width="56" height="56" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#8B5CF6" floodOpacity="0.4" />
            </filter>
        </defs>
        <g filter="url(#ai_shadow)">
            {/* Diamond Crystal */}
            <path d="M32 6L50 24L32 58L14 24L32 6Z" fill="url(#ai_crystal)" stroke="#F5D0FE" strokeWidth="1.5" />
            <path d="M32 6L24 24H40L32 6Z" fill="#FFFFFF" fillOpacity="0.3" />
            <path d="M24 24L32 58L40 24H24Z" fill="#1E1B4B" fillOpacity="0.25" />
            {/* Sparkles */}
            <circle cx="16" cy="14" r="2.5" fill="#FDE047" />
            <circle cx="48" cy="46" r="2" fill="#FDE047" />
        </g>
    </svg>
);

/**
 * 3D Settings & Gear Icon
 */
export const Settings3DIcon: React.FC<Icon3DProps> = ({ size = 48, className = '', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <defs>
            <linearGradient id="gear_body" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#64748B" />
                <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <filter id="gear_shadow" x="4" y="6" width="56" height="56" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#1E293B" floodOpacity="0.35" />
            </filter>
        </defs>
        <g filter="url(#gear_shadow)">
            <rect x="12" y="12" width="40" height="40" rx="10" fill="url(#gear_body)" stroke="#94A3B8" strokeWidth="1.5" />
            <circle cx="32" cy="32" r="10" fill="#1E293B" stroke="#38BDF8" strokeWidth="2.5" />
            <circle cx="32" cy="32" r="4.5" fill="#38BDF8" />
        </g>
    </svg>
);
