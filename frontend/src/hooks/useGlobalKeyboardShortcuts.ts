import { useEffect, useCallback } from 'react';

type View = 'dashboard' | 'sales' | 'products' | 'inventory' | 'reports' | 'settings' | 'invoices' | 'customers' | 'finance' | 'shifts';

const VIEW_MAP: Record<string, View> = {
  F1: 'dashboard',
  F2: 'sales',
  F3: 'products',
  F4: 'inventory',
  F5: 'invoices',
  F6: 'customers',
  F7: 'finance',
  F8: 'reports',
};

export function useGlobalKeyboardShortcuts(
  appState: string,
  isCommandPaletteOpen: boolean,
  isShortcutsOpen: boolean,
  onToggleCommandPalette: () => void,
  onToggleShortcuts: () => void,
  onNavigate: (view: View) => void,
) {
  useEffect(() => {
    if (appState !== 'app') return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
        e.preventDefault();
        return;
      }
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I'))) {
        e.preventDefault();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onToggleCommandPalette();
        return;
      }
      if (
        e.key === '?' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        onToggleShortcuts();
        return;
      }
      const view = VIEW_MAP[e.key];
      if (view) {
        e.preventDefault();
        onNavigate(view);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [appState, isCommandPaletteOpen, isShortcutsOpen, onToggleCommandPalette, onToggleShortcuts, onNavigate]);
}
