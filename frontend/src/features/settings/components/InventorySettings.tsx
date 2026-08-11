
import { AlertTriangle, Bell } from 'lucide-react';

import { AppPreferences } from '../../../core/types';
import { SettingInput, SettingToggle } from './SettingsUI';

interface InventorySettingsProps {
    prefs: AppPreferences;
    handleChange: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
    errors: Record<string, string>;
}

export const InventorySettings = ({ prefs, handleChange, errors }: InventorySettingsProps) => {
    return (
        <div className="space-y-4 animate-in fade-in duration-200 select-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Low Stock Config */}
                <div className="bg-surface rounded-xl border border-border/80 p-4 space-y-4 shadow-3xs">
                    <h3 className="text-xs font-black text-text-main flex items-center gap-2 pb-2 border-b border-border/60">
                        <Bell size={16} className="text-primary" />
                        تنبيهات نقص المنتجات
                    </h3>

                    <SettingInput
                        label="حد التنبيه (الكمية الأدنى)"
                        value={prefs.lowStockTrigger}
                        onChange={(v: string) => handleChange('lowStockTrigger', Number(v))}
                        type="number"
                        error={errors.lowStockTrigger}
                    />
                </div>

                {/* Negative Stock Config */}
                <div className="bg-surface rounded-xl border border-border/80 p-4 space-y-4 shadow-3xs">
                    <h3 className="text-xs font-black text-text-main flex items-center gap-2 pb-2 border-b border-border/60">
                        <AlertTriangle size={16} className="text-primary" />
                        سياسة البيع عند النفاذ
                    </h3>

                    <SettingToggle
                        label="السماح بالبيع عند النفاد (مخزون سالب)"
                        value={prefs.allowNegativeStock}
                        onChange={(v: boolean) => handleChange('allowNegativeStock', v)}
                        icon={AlertTriangle}
                    />
                </div>
            </div>
        </div>
    );
};
