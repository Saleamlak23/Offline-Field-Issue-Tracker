import { Link } from 'react-router-dom';
import type { LocalReport } from '../db.js';
import { useConnectivity } from '../connectivity.js';

const syncLabels = {
  draft: 'Draft · on this device',
  pending: 'Pending sync',
  synced: 'Synced',
  failed: 'Sync failed',
} as const;

export function ReportCard({ report }: { report: LocalReport }) {
  const { retryOne, isSyncing } = useConnectivity();
  return (
    <article className="report-card">
      <Link className="report-card-main" to={`/reports/${report.clientId}`}>
        <div className="report-card-meta">
          <span className="category-label">{report.category.replace('_', ' ')}</span>
          <span className={`sync-badge sync-${report.syncState}`}><span className="sync-dot" />{syncLabels[report.syncState]}</span>
        </div>
        <h2>{report.description}</h2>
        <p>{report.location}</p>
      </Link>
      <div className="report-card-side">
        <span className={`priority priority-${report.priority}`}>{report.priority}</span>
        <span className="report-date">{new Date(report.reportedAt).toLocaleDateString()}</span>
        {report.syncState === 'failed' && report.retryable !== false && <button className="retry-button" aria-label="Retry sync" title={report.lastSyncError || 'Retry sync'} disabled={isSyncing} onClick={() => void retryOne(report.clientId)}>{isSyncing ? '…' : '↻'}</button>}
      </div>
    </article>
  );
}
