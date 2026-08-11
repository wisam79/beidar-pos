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
    <div className={`relative group flex-1 min-w-[220px] ${className}`}>
        <input
            className="w-full h-11 bg-input-bg text-text-main border border-border/80 rounded-xl pr-11 pl-4 outline-none focus:border-success transition-colors text-sm font-extrabold placeholder:text-text-muted/70 touch-target"
            placeholder={placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
        />
        <Search className="absolute right-3.5 top-3 text-text-muted group-focus-within:text-success transition-colors pointer-events-none" size={18} />
    </div>
));
SearchInput.displayName = 'SearchInput';

// ═══════════════════════════════════════════════════════
//  SegmentedControl — أزرار تصفية متصلة لمسية
// ═══════════════════════════════════════════════════════

interface SegmentOption<T extends string = string> {
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
    <div className={`flex bg-surface-hover/60 p-1 rounded-xl border border-border/80 shrink-0 gap-1 overflow-x-auto no-scrollbar ${className}`}>
        {options.map(opt => {
            const isActive = value === opt.id;
            return (
                <button
                    key={opt.id}
                    onClick={() => onChange(opt.id)}
                    className={`px-4 py-2 min-h-[40px] rounded-lg font-extrabold text-xs md:text-sm whitespace-nowrap transition-colors touch-target outline-none cursor-pointer select-none ${
                        isActive
                            ? 'bg-success text-primary-fg font-black'
                            : 'text-text-muted hover:text-text-main hover:bg-surface'
                    }`}
                >
                    {opt.label}
                </button>
            );
        })}
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
    <div className={`bg-surface border border-border/80 p-3.5 rounded-2xl flex flex-col md:flex-row gap-3 items-center shrink-0 ${className}`}>
        {children}
    </div>
));
FilterBar.displayName = 'FilterBar';
