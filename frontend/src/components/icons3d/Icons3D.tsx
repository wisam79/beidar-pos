import React from 'react';
import posSalesImg from '../../assets/icons3d/pos_sales.webp';
import productsImg from '../../assets/icons3d/products_inventory.webp';
import invoicesImg from '../../assets/icons3d/invoices_orders.webp';
import vaultImg from '../../assets/icons3d/vault_shifts.webp';
import customersImg from '../../assets/icons3d/customers_debts.webp';
import reportsImg from '../../assets/icons3d/reports_analytics.webp';

export interface Icon3DProps {
    size?: number;
    className?: string;
    alt?: string;
}

export const Pos3DIcon: React.FC<Icon3DProps> = ({ size = 220, className = '', alt = 'نقطة البيع' }) => (
    <div className="relative w-full flex items-center justify-center">
        <img
            src={posSalesImg}
            alt={alt}
            width={size}
            height={size}
            style={{ width: size, height: size }}
            className={`relative z-10 object-contain select-none pointer-events-none drop-shadow-md transition-transform duration-300 ${className}`}
            loading="eager"
            draggable={false}
        />
    </div>
);

export const Products3DIcon: React.FC<Icon3DProps> = ({ size = 220, className = '', alt = 'المخزون' }) => (
    <div className="relative w-full flex items-center justify-center">
        <img
            src={productsImg}
            alt={alt}
            width={size}
            height={size}
            style={{ width: size, height: size }}
            className={`relative z-10 object-contain select-none pointer-events-none drop-shadow-md transition-transform duration-300 ${className}`}
            loading="eager"
            draggable={false}
        />
    </div>
);

export const Invoices3DIcon: React.FC<Icon3DProps> = ({ size = 220, className = '', alt = 'الفواتير' }) => (
    <div className="relative w-full flex items-center justify-center">
        <img
            src={invoicesImg}
            alt={alt}
            width={size}
            height={size}
            style={{ width: size, height: size }}
            className={`relative z-10 object-contain select-none pointer-events-none drop-shadow-md transition-transform duration-300 ${className}`}
            loading="eager"
            draggable={false}
        />
    </div>
);

export const Vault3DIcon: React.FC<Icon3DProps> = ({ size = 220, className = '', alt = 'الخزينة' }) => (
    <div className="relative w-full flex items-center justify-center">
        <img
            src={vaultImg}
            alt={alt}
            width={size}
            height={size}
            style={{ width: size, height: size }}
            className={`relative z-10 object-contain select-none pointer-events-none drop-shadow-md transition-transform duration-300 ${className}`}
            loading="eager"
            draggable={false}
        />
    </div>
);

export const Customers3DIcon: React.FC<Icon3DProps> = ({ size = 220, className = '', alt = 'العملاء' }) => (
    <div className="relative w-full flex items-center justify-center">
        <img
            src={customersImg}
            alt={alt}
            width={size}
            height={size}
            style={{ width: size, height: size }}
            className={`relative z-10 object-contain select-none pointer-events-none drop-shadow-md transition-transform duration-300 ${className}`}
            loading="eager"
            draggable={false}
        />
    </div>
);

export const Reports3DIcon: React.FC<Icon3DProps> = ({ size = 220, className = '', alt = 'التقارير' }) => (
    <div className="relative w-full flex items-center justify-center">
        <img
            src={reportsImg}
            alt={alt}
            width={size}
            height={size}
            style={{ width: size, height: size }}
            className={`relative z-10 object-contain select-none pointer-events-none drop-shadow-md transition-transform duration-300 ${className}`}
            loading="eager"
            draggable={false}
        />
    </div>
);

export const AI3DIcon = Pos3DIcon;
export const Settings3DIcon = Pos3DIcon;
