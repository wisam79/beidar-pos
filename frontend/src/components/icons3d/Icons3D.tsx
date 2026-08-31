import React from 'react';
import {
    ShoppingCart,
    Package,
    Receipt,
    Vault,
    UsersThree,
    ChartLineUp,
    Warehouse,
    Coins,
    GearSix,
    IconProps
} from '@phosphor-icons/react';

export interface Icon3DProps {
    size?: number;
    className?: string;
    alt?: string;
}

const makePhosphorDuotoneIcon = (
    IconComponent: React.ComponentType<IconProps>
) => {
    const CardIcon: React.FC<Icon3DProps> = ({ size = 80, className = '' }) => (
        <div className="relative flex items-center justify-center p-1">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-primary/25 rounded-full blur-2xl opacity-40 group-hover:opacity-90 transition-opacity duration-300 pointer-events-none" />

            {/* Tactile Duotone Glass Pod */}
            <div className={`relative z-10 w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 via-surface to-surface-hover/80 border border-primary/25 group-hover:border-primary/60 shadow-lg group-hover:shadow-primary/25 transition-all duration-300 group-hover:scale-105 ${className}`}>
                <IconComponent
                    size={size}
                    weight="duotone"
                    className="text-primary group-hover:brightness-125 transition-all duration-300 drop-shadow-md"
                />
            </div>
        </div>
    );
    return CardIcon;
};

export const Pos3DIcon = makePhosphorDuotoneIcon(ShoppingCart);
export const Products3DIcon = makePhosphorDuotoneIcon(Package);
export const Invoices3DIcon = makePhosphorDuotoneIcon(Receipt);
export const Vault3DIcon = makePhosphorDuotoneIcon(Vault);
export const Customers3DIcon = makePhosphorDuotoneIcon(UsersThree);
export const Reports3DIcon = makePhosphorDuotoneIcon(ChartLineUp);
export const Inventory3DIcon = makePhosphorDuotoneIcon(Warehouse);
export const Finance3DIcon = makePhosphorDuotoneIcon(Coins);
export const Settings3DIcon = makePhosphorDuotoneIcon(GearSix);

export const AI3DIcon = Pos3DIcon;