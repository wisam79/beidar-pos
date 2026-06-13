import { useEffect } from 'react';
import type { AppPreferences } from '../core/types';

const sizeMap: Record<string, string> = {
  normal: '15px',
  large: '16px',
  xl: '17px',
};

export function useTheme(prefs: AppPreferences) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = sizeMap[prefs.fontSize] || '15px';
    root.setAttribute('data-theme', prefs.theme || 'dark');
    root.style.setProperty('--color-primary', prefs.accentColor);

    const r = parseInt(prefs.accentColor.slice(1, 3), 16);
    const g = parseInt(prefs.accentColor.slice(3, 5), 16);
    const b = parseInt(prefs.accentColor.slice(5, 7), 16);
    root.style.setProperty('--color-primary-rgb', `${r},${g},${b}`);
    root.style.setProperty('--color-primary-dim', `rgba(${r},${g},${b},0.25)`);
  }, [prefs.fontSize, prefs.theme, prefs.accentColor]);
}
