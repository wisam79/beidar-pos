import { useEffect } from 'react';

export function useAutoSelectInput() {
  useEffect(() => {
    const handler = (e: FocusEvent) => {
      const target = e.target as HTMLInputElement;
      if (!target) return;
      if (['text', 'number', 'email', 'password'].includes(target.type)) {
        setTimeout(() => target.select(), 0);
      }
      if (target.type === 'number' && ['0', '0.00', '0.0'].includes(target.value)) {
        target.value = '';
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    document.addEventListener('focusin', handler);
    return () => document.removeEventListener('focusin', handler);
  }, []);
}
