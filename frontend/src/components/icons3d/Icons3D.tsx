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

const makeIcon = (src: string, defaultAlt: string) => {
    const Icon3D: React.FC<Icon3DProps> = ({ size = 220, className = '', alt = defaultAlt }) => (
        <div className="relative w-full flex items-center justify-center">
            <img
                src={src}
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
    return Icon3D;
};

export const Pos3DIcon = makeIcon(posSalesImg, 'نقطة البيع');
export const Products3DIcon = makeIcon(productsImg, 'المخزون');
export const Invoices3DIcon = makeIcon(invoicesImg, 'الفواتير');
export const Vault3DIcon = makeIcon(vaultImg, 'الخزينة');
export const Customers3DIcon = makeIcon(customersImg, 'العملاء');
export const Reports3DIcon = makeIcon(reportsImg, 'التقارير');

export const AI3DIcon = Pos3DIcon;
export const Settings3DIcon = Pos3DIcon;