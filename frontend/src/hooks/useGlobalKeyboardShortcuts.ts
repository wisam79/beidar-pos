import { useEffect, useRef } from 'react';

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
  const onToggleCommandPaletteRef = useRef(onToggleCommandPalette);
  const onToggleShortcutsRef = useRef(onToggleShortcuts);
  const onNavigateRef = useRef(onNavigate);

  useEffect(() => {
    onToggleCommandPaletteRef.current = onToggleCommandPalette;
    onToggleShortcutsRef.current = onToggleShortcuts;
    onNavigateRef.current = onNavigate;
  }); // runs on every render

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
        onToggleCommandPaletteRef.current();
        return;
      }
      if (
        e.key === '?' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        onToggleShortcutsRef.current();
        return;
      }
      const view = VIEW_MAP[e.key];
      if (view) {
        e.preventDefault();
        onNavigateRef.current(view);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [appState]);
}
