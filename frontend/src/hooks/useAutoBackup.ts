import { useEffect, useRef } from 'react';
import type { NotifyFunction, AppPreferences } from '../core/types';
import { playBeep, getLocalDateString } from '../core/utils';

export function useAutoBackup(
  appState: string,
  prefs: AppPreferences,
  setPrefs: (p: AppPreferences) => void,
  notify: NotifyFunction,
) {
  const calledRef = useRef(false);

  useEffect(() => {
    if (appState !== 'app' || !prefs.autoBackup) return;

    const today = getLocalDateString();
    if (prefs.lastBackupDate?.startsWith(today)) return;

    if (calledRef.current) return;
    calledRef.current = true;

    const performBackup = async () => {
      await new Promise((r) => setTimeout(r, 5000));

      try {
        const { api } = await import('../core/api');
        await api.db.createBackup();

        const now = new Date().toISOString();
        const updated: AppPreferences = { ...prefs, lastBackupDate: now };
        setPrefs(updated);
        localStorage.setItem('beidar_preferences', JSON.stringify(updated));
        api.prefs.set(updated).catch(console.error);

        notify('تم إجراء النسخ الاحتياطي التلقائي بنجاح ✅', 'success');
        playBeep('success');
      } catch (e) {
        console.error('Auto backup failed', e);
        notify('فشل النسخ الاحتياطي التلقائي', 'error');
      }
    };

    performBackup();
  }, [appState, prefs.autoBackup, prefs.lastBackupDate]);
}
