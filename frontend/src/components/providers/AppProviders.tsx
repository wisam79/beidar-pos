import React from 'react';
import { useAppStore } from '../../store/appStore';
import { useAuth } from '../../core/AuthContext';
import type { View } from '../../core/types';
import { ChangePasswordModal } from '../ChangePasswordModal';
import { SessionTimeoutWarning } from '../SessionTimeoutWarning';
import { CommandPalette } from '../CommandPalette';
import { AIChatWindow } from '../AIChatWindow';
import { UtilitiesDock } from '../UtilitiesDock';
import { ShortcutsModal } from '../ShortcutsModal';

interface AppProvidersProps {
  children: React.ReactNode;
  aiContext: { revenue: number; orders: number; lowStock: number };
  onNavigate: (view: View) => void;
  onLock: () => void;
}

const ChangePasswordModalWrapper = () => {
  const { currentUser, requirePinChange, setRequirePinChange } = useAuth();
  if (!requirePinChange || !currentUser) return null;
  return (
    <ChangePasswordModal
      isOpen
      staffId={currentUser.id}
      staffName={currentUser.username}
      isForced
      onSuccess={() => setRequirePinChange(false)}
    />
  );
};

export const AppProviders = ({ children, aiContext, onNavigate, onLock }: AppProvidersProps) => {
  const isAiChatOpen = useAppStore((state) => state.isAiChatOpen);
  const setAiChatOpen = useAppStore((state) => state.setAiChatOpen);
  const isCommandPaletteOpen = useAppStore((state) => state.isCommandPaletteOpen);
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const isShortcutsOpen = useAppStore((state) => state.isShortcutsOpen);
  const setShortcutsOpen = useAppStore((state) => state.setShortcutsOpen);

  return (
    <>
      <ChangePasswordModalWrapper />
      <SessionTimeoutWarning />
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} onNavigate={onNavigate} />
      <AIChatWindow isOpen={isAiChatOpen} onClose={() => setAiChatOpen(false)} contextData={aiContext} />
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <UtilitiesDock onLock={onLock} />
      {children}
    </>
  );
};
