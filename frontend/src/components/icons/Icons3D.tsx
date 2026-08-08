import React from 'react';

interface Icon3DProps {
    size?: number;
    className?: string;
}

/**
 * 1. 3D POS Cash Register (بيع سريع - Quick POS)
 * Clean floating 3D render (Zero bottom ground shadow)
 */
export const Icon3DCashRegister: React.FC<Icon3DProps> = ({ size = 140, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-2 ${className}`}>
        <defs>
            <linearGradient id="crMatteDark" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#373d47" />
                <stop offset="100%" stopColor="#1e2229" />
            </linearGradient>
            <linearGradient id="crDrawer" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2c323c" />
                <stop offset="100%" stopColor="#15181e" />
            </linearGradient>
            <linearGradient id="crGreenGloss" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="crScreenGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6ee7b7" />
                <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
        </defs>

        {/* 1. Cash Drawer Base */}
        <rect x="16" y="58" width="68" height="25" rx="6" fill="url(#crDrawer)" />
        <rect x="18" y="60" width="64" height="21" rx="4" fill="#222731" />
        
        {/* Drawer Center Glowing Emerald Knob */}
        <circle cx="50" cy="70" r="4.5" fill="url(#crGreenGloss)" />
        <circle cx="49" cy="69" r="1.3" fill="#ffffff" fillOpacity="0.8" />

        {/* 2. Main Register Slanted Body */}
        <path d="M23 58L29 28C29.5 25.5 31.8 24 34.5 24H65.5C68.2 24 70.5 25.5 71 28L77 58H23Z" fill="url(#crMatteDark)" />
        
        {/* 3. Screen Box & Thermal Paper Roll */}
        <rect x="35" y="12" width="30" height="20" rx="4.5" fill="#252a34" />
        <rect x="38" y="15" width="14" height="14" rx="2" fill="#11141a" />
        
        {/* Emerald Thermal Receipt */}
        <rect x="54" y="17" width="9" height="11" rx="1.5" fill="url(#crScreenGreen)" />

        {/* 4. Glossy Emerald Tactile Keypad Grid */}
        <rect x="29" y="32" width="8.5" height="5.5" rx="1.8" fill="url(#crGreenGloss)" />
        <rect x="40" y="32" width="8.5" height="5.5" rx="1.8" fill="url(#crGreenGloss)" />
        <rect x="51" y="32" width="8.5" height="5.5" rx="1.8" fill="url(#crGreenGloss)" />
        <rect x="62" y="32" width="8.5" height="5.5" rx="1.8" fill="url(#crGreenGloss)" />

        <rect x="29" y="40" width="8.5" height="5.5" rx="1.8" fill="url(#crGreenGloss)" />
        <rect x="40" y="40" width="8.5" height="5.5" rx="1.8" fill="url(#crGreenGloss)" />
        <rect x="51" y="40" width="8.5" height="5.5" rx="1.8" fill="url(#crGreenGloss)" />
        <rect x="62" y="40" width="8.5" height="5.5" rx="1.8" fill="url(#crGreenGloss)" />

        <rect x="29" y="48" width="8.5" height="5.5" rx="1.8" fill="url(#crGreenGloss)" />
        <rect x="40" y="48" width="8.5" height="5.5" rx="1.8" fill="url(#crGreenGloss)" />
        <rect x="51" y="48" width="19.5" height="5.5" rx="1.8" fill="url(#crGreenGloss)" />
    </svg>
);

/**
 * 2. 3D Banknotes & Cash Stack (المصروفات والمالية - Finance & Cash)
 * Clean floating 3D render (Zero bottom ground shadow)
 */
export const Icon3DFinance: React.FC<Icon3DProps> = ({ size = 140, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-2 ${className}`}>
        <defs>
            <linearGradient id="cashTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3c434f" />
                <stop offset="100%" stopColor="#252a32" />
            </linearGradient>
            <linearGradient id="cashSideL" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2c323c" />
                <stop offset="100%" stopColor="#15191f" />
            </linearGradient>
            <linearGradient id="cashSideR" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e2229" />
                <stop offset="100%" stopColor="#0f1216" />
            </linearGradient>
            <linearGradient id="emeraldBand" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
        </defs>

        {/* 3D Banknote Stack Isometric Layers */}
        <path d="M20 42L44 64V78L20 56V42Z" fill="url(#cashSideL)" />
        <line x1="20" y1="47" x2="44" y2="69" stroke="#181c22" strokeWidth="1.2" />
        <line x1="20" y1="52" x2="44" y2="74" stroke="#181c22" strokeWidth="1.2" />

        <path d="M44 64L88 36V50L44 78V64Z" fill="url(#cashSideR)" />
        <line x1="44" y1="69" x2="88" y2="41" stroke="#14171d" strokeWidth="1.2" />
        <line x1="44" y1="74" x2="88" y2="46" stroke="#14171d" strokeWidth="1.2" />

        {/* Top Note Surface */}
        <path d="M20 42L64 14L88 36L44 64L20 42Z" fill="url(#cashTop)" />

        {/* Embossed Currency Markings */}
        <circle cx="54" cy="39" r="6" fill="#20252d" />
        <circle cx="33" cy="45" r="3" fill="#20252d" />
        <circle cx="75" cy="27" r="3" fill="#20252d" />

        {/* Glossy Emerald Green Wrap Band */}
        <path d="M46 26L61 17L70 25L55 35L46 26Z" fill="url(#emeraldBand)" />
        <path d="M46 26L55 35V49L46 40V26Z" fill="#047857" />
        <path d="M55 35L70 25V39L55 49V35Z" fill="#059669" />
    </svg>
);

/**
 * 3. 3D Calendar & Shift Box (وردية الكاشير - Cashier Shifts)
 * Clean floating 3D render (Zero bottom ground shadow)
 */
export const Icon3DShifts: React.FC<Icon3DProps> = ({ size = 140, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-2 ${className}`}>
        <defs>
            <linearGradient id="calGreenMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6ee7b7" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <linearGradient id="calMatte" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#373e49" />
                <stop offset="100%" stopColor="#1b1f26" />
            </linearGradient>
        </defs>

        {/* Main Calendar Body Tablet */}
        <rect x="20" y="22" width="58" height="56" rx="11" fill="url(#calMatte)" />
        <rect x="22" y="24" width="54" height="52" rx="9" fill="#20242d" />

        {/* 5 Glossy Emerald Green Metallic Spiral Binder Rings */}
        <path d="M27 15C27 10 31 10 31 15V25C31 30 27 30 27 25V15Z" fill="url(#calGreenMetallic)" />
        <path d="M38 15C38 10 42 10 42 15V25C42 30 38 30 38 25V15Z" fill="url(#calGreenMetallic)" />
        <path d="M49 15C49 10 53 10 53 15V25C53 30 49 30 49 25V15Z" fill="url(#calGreenMetallic)" />
        <path d="M60 15C60 10 64 10 64 15V25C64 30 60 30 60 25V15Z" fill="url(#calGreenMetallic)" />
        <path d="M71 15C71 10 75 10 75 15V25C75 30 71 30 71 25V15Z" fill="url(#calGreenMetallic)" />

        {/* Recessed Date Grid Tiles */}
        <rect x="28" y="35" width="9" height="7" rx="2" fill="#2d333f" />
        <rect x="41" y="35" width="9" height="7" rx="2" fill="#2d333f" />
        <rect x="54" y="35" width="9" height="7" rx="2" fill="#2d333f" />

        <rect x="28" y="46" width="9" height="7" rx="2" fill="#2d333f" />
        <rect x="41" y="46" width="9" height="7" rx="2" fill="#2d333f" />
        <rect x="54" y="46" width="9" height="7" rx="2" fill="#2d333f" />

        <rect x="28" y="57" width="9" height="7" rx="2" fill="#2d333f" />
        <rect x="41" y="57" width="9" height="7" rx="2" fill="#2d333f" />

        {/* Foreground Shift Parcel Box with Emerald Ribbon */}
        <rect x="62" y="50" width="24" height="26" rx="5" fill="#2a303a" />
        <path d="M73 50H77V76H73V50Z" fill="url(#calGreenMetallic)" />
        <circle cx="75" cy="55" r="1.8" fill="#ffffff" />
    </svg>
);

/**
 * 4. 3D Inventory Conveyor (جرد المخزون - Inventory & Stock)
 * Clean floating 3D render (Zero bottom ground shadow)
 */
export const Icon3DInventory: React.FC<Icon3DProps> = ({ size = 140, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-2 ${className}`}>
        <defs>
            <linearGradient id="invGreenGloss" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <radialGradient id="invDotGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#047857" />
            </radialGradient>
        </defs>

        {/* Top Product Cube on Belt */}
        <rect x="34" y="20" width="32" height="32" rx="6" fill="#2c333e" />
        {/* Emerald Ribbon Tape across Box */}
        <path d="M48 20H53V52H48V20Z" fill="url(#invGreenGloss)" />
        <rect x="38" y="36" width="6" height="6" rx="1.5" fill="#94a3b8" />

        {/* Conveyor Belt Pill Base */}
        <rect x="14" y="52" width="72" height="26" rx="13" fill="#20252e" />
        <rect x="16" y="54" width="68" height="22" rx="11" fill="#14181f" />

        {/* 3 Glowing Green Sensor Indicator Dots */}
        <circle cx="32" cy="65" r="5" fill="url(#invDotGlow)" />
        <circle cx="31" cy="64" r="1.8" fill="#ffffff" fillOpacity="0.8" />

        <circle cx="50" cy="65" r="5" fill="url(#invDotGlow)" />
        <circle cx="49" cy="64" r="1.8" fill="#ffffff" fillOpacity="0.8" />

        <circle cx="68" cy="65" r="5" fill="url(#invDotGlow)" />
        <circle cx="67" cy="64" r="1.8" fill="#ffffff" fillOpacity="0.8" />
    </svg>
);

/**
 * 5. 3D Winged Box (مادة جديدة - New Product / Add Item)
 * Clean floating 3D render (Zero bottom ground shadow)
 */
export const Icon3DNewProduct: React.FC<Icon3DProps> = ({ size = 140, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-2 ${className}`}>
        <defs>
            <linearGradient id="wingGreenGloss" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="cubeTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3c434f" />
                <stop offset="100%" stopColor="#252a32" />
            </linearGradient>
        </defs>

        {/* Left Stylized Glossy Emerald Green Wings */}
        <path d="M36 46L12 37C10 36 11 33 14 33L37 41L36 46Z" fill="url(#wingGreenGloss)" />
        <path d="M35 53L15 46C13 45 14 42 17 42L36 48L35 53Z" fill="url(#wingGreenGloss)" />
        <path d="M34 60L20 55C18 54 19 50 22 50L35 54L34 60Z" fill="#047857" />

        {/* 3D Isometric Cube Body */}
        <path d="M54 26L82 39L54 52L26 39L54 26Z" fill="url(#cubeTop)" />
        <path d="M26 39L54 52V78L26 65V39Z" fill="#252b34" />
        <path d="M54 52L82 39V65L54 78V52Z" fill="#15191f" />

        {/* Emerald Ribbon Tape on Top and Front */}
        <path d="M62 23L68 26L49 37L43 34L62 23Z" fill="url(#wingGreenGloss)" />
        <path d="M49 37L43 34V46L49 49V37Z" fill="#047857" />

        {/* White Label Tag on Right Side */}
        <rect x="62" y="56" width="8" height="8" rx="2" fill="#e2e8f0" transform="skewY(-15)" />
    </svg>
);

/**
 * 6. 3D Customer Profile & Debt Ledger (العملاء والديون - Customers & Accounts)
 * Clean floating 3D render (Zero bottom ground shadow)
 */
export const Icon3DCustomers: React.FC<Icon3DProps> = ({ size = 140, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-2 ${className}`}>
        <defs>
            <linearGradient id="custGreenGloss" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="custBodyDark" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3c434f" />
                <stop offset="100%" stopColor="#1a1e26" />
            </linearGradient>
            <linearGradient id="custCardDark" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2c323c" />
                <stop offset="100%" stopColor="#12151b" />
            </linearGradient>
        </defs>

        {/* Background Account Ledger Card */}
        <rect x="42" y="24" width="38" height="52" rx="8" fill="url(#custCardDark)" />
        <rect x="44" y="26" width="34" height="48" rx="6" fill="#181c23" />
        
        {/* Ledger Balance Lines */}
        <line x1="50" y1="36" x2="72" y2="36" stroke="#333b47" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="50" y1="43" x2="68" y2="43" stroke="#333b47" strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="50" x2="72" y2="50" stroke="#333b47" strokeWidth="2" strokeLinecap="round" />

        {/* Emerald Debt / Balance Stamp on Card */}
        <circle cx="68" cy="62" r="5.5" fill="url(#custGreenGloss)" />
        <path d="M66 62L67.5 63.5L70.5 60.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* 3D Customer Profile Avatar in Foreground */}
        {/* Spherical Head */}
        <circle cx="34" cy="36" r="14" fill="url(#custBodyDark)" />
        <circle cx="34" cy="36" r="12" fill="#252a33" />
        <circle cx="32" cy="33" r="3" fill="#ffffff" fillOpacity="0.15" />

        {/* Smooth Torso / Shoulders with Glossy Emerald Badge */}
        <path d="M16 74C16 57 24 53 34 53C44 53 52 57 52 74H16Z" fill="url(#custBodyDark)" />
        <path d="M18 73C18 58 25 55 34 55C43 55 50 58 50 73H18Z" fill="#1c212a" />

        {/* Glossy Emerald Ribbon / Tie Collar */}
        <path d="M30 55L34 65L38 55H30Z" fill="url(#custGreenGloss)" />
        <circle cx="34" cy="55" r="2.5" fill="#ffffff" />
    </svg>
);

/**
 * 7. 3D Shopping Basket (سجل الفواتير - Invoices & Orders)
 * Clean floating 3D render (Zero bottom ground shadow)
 */
export const Icon3DInvoices: React.FC<Icon3DProps> = ({ size = 140, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-2 ${className}`}>
        <defs>
            <linearGradient id="basketGreenGloss" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="basketBodyMatte" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#373e49" />
                <stop offset="100%" stopColor="#1a1e25" />
            </linearGradient>
        </defs>

        {/* Curved Glossy Emerald Green Handles */}
        <path d="M30 46C28 28 36 18 48 18C60 18 68 28 66 46" stroke="url(#basketGreenGloss)" strokeWidth="6" strokeLinecap="round" />
        <path d="M34 48C32 32 40 24 50 24C60 24 66 32 64 48" stroke="#047857" strokeWidth="5" strokeLinecap="round" />

        {/* Basket Upper Rim */}
        <rect x="16" y="46" width="68" height="11" rx="4.5" fill="url(#basketBodyMatte)" />
        <rect x="18" y="48" width="64" height="7" rx="2.5" fill="#1e232b" />

        {/* Slotted Basket Container */}
        <path d="M20 54L27 82C27.5 84.5 29.8 86 32.5 86H67.5C70.2 86 72.5 84.5 73 82L80 54H20Z" fill="url(#basketBodyMatte)" />

        {/* Vertical Ventilation Slots */}
        <rect x="32" y="58" width="5" height="20" rx="2" fill="#0f1217" />
        <rect x="42" y="58" width="5" height="20" rx="2" fill="#0f1217" />
        <rect x="53" y="58" width="5" height="20" rx="2" fill="#0f1217" />
        <rect x="63" y="58" width="5" height="20" rx="2" fill="#0f1217" />

        {/* Emerald Pivot Rivets */}
        <circle cx="28" cy="51" r="3.5" fill="url(#basketGreenGloss)" />
        <circle cx="72" cy="51" r="3.5" fill="url(#basketGreenGloss)" />
    </svg>
);

/**
 * 8. 3D Star Badge Medal (التقارير والأرباح - Reports & Growth)
 * Clean floating 3D render (Zero bottom ground shadow)
 */
export const Icon3DReports: React.FC<Icon3DProps> = ({ size = 140, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-2 ${className}`}>
        <defs>
            <linearGradient id="starGreenGloss" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="badgeMatte" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3c434f" />
                <stop offset="100%" stopColor="#1a1e25" />
            </linearGradient>
        </defs>

        {/* Emerald Ribbon Tails below Badge */}
        <path d="M42 62L36 90L48 83L60 90L54 62H42Z" fill="url(#starGreenGloss)" />
        <path d="M44 62L48 83L52 62H44Z" fill="#047857" />

        {/* Scalloped Tooth Edge Rings */}
        <circle cx="50" cy="18" r="5" fill="url(#badgeMatte)" />
        <circle cx="70" cy="26" r="5" fill="url(#badgeMatte)" />
        <circle cx="78" cy="45" r="5" fill="url(#badgeMatte)" />
        <circle cx="70" cy="64" r="5" fill="url(#badgeMatte)" />
        <circle cx="50" cy="72" r="5" fill="url(#badgeMatte)" />
        <circle cx="30" cy="64" r="5" fill="url(#badgeMatte)" />
        <circle cx="22" cy="45" r="5" fill="url(#badgeMatte)" />
        <circle cx="30" cy="26" r="5" fill="url(#badgeMatte)" />

        {/* Central Scalloped Circular Body */}
        <circle cx="50" cy="45" r="28" fill="url(#badgeMatte)" />
        <circle cx="50" cy="45" r="23" fill="#14171d" />

        {/* Central Glossy Emerald Green 3D Star */}
        <path d="M50 28L54.2 38.5L65.5 39.3L56.8 46.5L59.5 57.8L50 51.5L40.5 57.8L43.2 46.5L34.5 39.3L45.8 38.5L50 28Z" fill="url(#starGreenGloss)" />
        <circle cx="48" cy="42" r="2.2" fill="#ffffff" fillOpacity="0.6" />
    </svg>
);
