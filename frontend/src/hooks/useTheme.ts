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
    
    // Resolve accent color: map default greens to the user's custom green #306D29
    let color = prefs.accentColor || '#306D29';
    if (color === 'emerald' || color === '#10B981' || color === '#10b981' || color === '#059669' || color === '#047857' || color === '#84B179' || color === '#346739') {
      color = '#306D29';
    }
    
    console.log('[Theme Debug] Resolved color:', color, 'from prefs:', prefs.accentColor);
    root.style.setProperty('--color-primary', color);

    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      root.style.setProperty('--color-primary-rgb', `${r},${g},${b}`);
      root.style.setProperty('--color-primary-dim', `rgba(${r},${g},${b},0.25)`);
    } else {
      // Fallback for custom theme edge cases
      root.style.setProperty('--color-primary-rgb', '5,150,105');
      root.style.setProperty('--color-primary-dim', 'rgba(5,150,105,0.25)');
    }
  }, [prefs.fontSize, prefs.theme, prefs.accentColor]);
}
