import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useConnectivity } from '../connectivity.js';

export function SyncBanner() {
  const { isOnline, isSyncing, toggleConnectivity, syncNow } = useConnectivity();
  const unsynced = useLiveQuery(() => db.reports.where('syncState').anyOf('pending', 'failed').count(), []) ?? 0;

  return (
    <div className={`sync-banner ${isOnline ? 'banner-online' : 'banner-offline'}`} role="status">
      <span className="connection-indicator"><span className="connection-dot" />{isOnline ? 'Online' : 'Offline'}</span>
      <span className="sync-message">{isOnline ? `${unsynced} report${unsynced === 1 ? '' : 's'} waiting to sync` : `${unsynced} report${unsynced === 1 ? '' : 's'} saved on this device`}</span>
      {isOnline && unsynced > 0 && <button className="text-button" onClick={() => void syncNow()} disabled={isSyncing}>{isSyncing ? 'Syncing…' : 'Sync now'}</button>}
      <button className="connectivity-toggle" onClick={toggleConnectivity}>{isOnline ? 'Go offline' : 'Go online'}</button>
    </div>
  );
}
