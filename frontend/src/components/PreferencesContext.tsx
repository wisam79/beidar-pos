import React, { createContext, useContext } from 'react';
import type { AppPreferences, NotifyFunction, View } from '../core/types';

export interface PreferencesContextValue {
  prefs: AppPreferences;
  setPrefs: (p: AppPreferences) => void;
  notify: NotifyFunction;
  setView: (view: View) => void;
}

const PreferencesCtx = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  prefs,
  setPrefs,
  notify,
  setView,
  children,
}: PreferencesContextValue & { children: React.ReactNode }) {
  return (
    <PreferencesCtx.Provider value={{ prefs, setPrefs, notify, setView }}>
      {children}
    </PreferencesCtx.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesCtx);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
