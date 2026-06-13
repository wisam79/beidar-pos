import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export function useOnlineStatus() {
  const setOnlineStatus = useAppStore((s) => s.setOnlineStatus);

  useEffect(() => {
    const goOnline = () => setOnlineStatus(true);
    const goOffline = () => setOnlineStatus(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [setOnlineStatus]);
}
