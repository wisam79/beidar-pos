/**
 * FilterBar + SearchInput + SegmentedControl — شريط الفلترة الموحد
 * يستبدل 6+ أشرطة بحث وفلاتر مختلفة
 */
import React, { memo } from 'react';
import { Search } from 'lucide-react';

// ═══════════════════════════════════════════════════════
//  SearchInput — حقل البحث الموحد
// ═══════════════════════════════════════════════════════

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export const SearchInput = memo(({ value, onChange, placeholder = 'بحث...', className = '' }: SearchInputProps) => (
    <div className={`relative group flex-1 min-w-[200px] ${className}`}>
        <input
            className="w-full bg-input-bg text-text-main border border-border rounded-xl pl-11 pr-4 py-3 outline-none focus:border-primary transition-all text-sm font-bold placeholder:text-text-muted focus:shadow-[0_0_15px_var(--color-primary-dim)] touch-target"
            placeholder={placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
        />
        <Search className="absolute left-4 top-3.5 text-text-muted group-focus-within:text-primary transition-colors" size={18} />
    </div>
));
SearchInput.displayName = 'SearchInput';

// ═══════════════════════════════════════════════════════
//  SegmentedControl — أزرار تصفية متصلة
// ═══════════════════════════════════════════════════════

export interface SegmentOption<T extends string = string> {
    id: T;
    label: string;
}

interface SegmentedControlProps<T extends string = string> {
    options: SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
}

export const SegmentedControl = memo(<T extends string>({
    options,
    value,
    onChange,
    className = '',
}: SegmentedControlProps<T>) => (
    <div className={`flex bg-bg p-1 rounded-xl border border-border shrink-0 ${className}`}>
        {options.map(opt => (
            <button
                key={opt.id}
                onClick={() => onChange(opt.id)}
                className={`px-5 py-2.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all touch-target active:scale-95 ${
                    value === opt.id
                        ? 'bg-primary text-primary-fg shadow-sm'
                        : 'text-text-muted hover:text-text-main hover:bg-surface'
                }`}
            >
                {opt.label}
            </button>
        ))}
    </div>
)) as <T extends string>(props: SegmentedControlProps<T>) => React.ReactElement;
(SegmentedControl as React.FC).displayName = 'SegmentedControl';

// ═══════════════════════════════════════════════════════
//  FilterBar — الحاوية الموحدة للفلاتر
// ═══════════════════════════════════════════════════════

interface FilterBarProps {
    children: React.ReactNode;
    className?: string;
}

export const FilterBar = memo(({ children, className = '' }: FilterBarProps) => (
    <div className={`bg-surface border border-border p-3 rounded-2xl flex flex-col md:flex-row gap-3 items-center shrink-0 ${className}`}>
        {children}
    </div>
));
FilterBar.displayName = 'FilterBar';
