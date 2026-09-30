import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { syncService } from './syncService.js';

interface ConnectivityContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  toggleConnectivity: () => void;
  syncNow: () => Promise<void>;
  retryOne: (clientId: string) => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextValue | undefined>(undefined);

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);
  const [manualOnline, setManualOnline] = useState<boolean | undefined>(undefined);
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = manualOnline ?? browserOnline;

  const syncNow = useCallback(async () => {
    if (!isOnline) return;
    setIsSyncing(true);
    try {
      await syncService.runSyncCycle(true, undefined, isOnline);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);

  const retryOne = useCallback(async (clientId: string) => {
    if (!isOnline) return;
    setIsSyncing(true);
    try {
      await syncService.retryOne(clientId, isOnline);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);

  const toggleConnectivity = useCallback(() => {
    setManualOnline(!isOnline);
  }, [isOnline]);

  useEffect(() => {
    const updateOnline = () => setBrowserOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    syncService.setOnlineState(isOnline);
    if (!isOnline) return;
    void syncService.runSyncCycle(false, undefined, isOnline);
    const interval = window.setInterval(() => void syncService.runSyncCycle(false, undefined, isOnline), 15_000);
    return () => window.clearInterval(interval);
  }, [isOnline]);

  const value = useMemo(() => ({ isOnline, isSyncing, toggleConnectivity, syncNow, retryOne }), [
    isOnline,
    isSyncing,
    toggleConnectivity,
    syncNow,
    retryOne,
  ]);

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity() {
  const value = useContext(ConnectivityContext);
  if (!value) throw new Error('useConnectivity must be used inside ConnectivityProvider');
  return value;
}
