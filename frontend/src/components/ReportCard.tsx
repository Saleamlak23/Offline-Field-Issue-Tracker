import { Link } from 'react-router-dom';
import type { LocalReport } from '../db.js';

const syncLabels = {
  pending: 'Pending sync',
  synced: 'Synced',
  failed: 'Sync failed',
} as const;

export function ReportCard({ report }: { report: LocalReport }) {
  return (
    <Link className="report-card" to={`/reports/${report.clientId}`}>
      <div className="report-card-main">
        <div className="report-card-meta">
          <span className="category-label">{report.category.replace('_', ' ')}</span>
          <span className={`sync-badge sync-${report.syncState}`}><span className="sync-dot" />{syncLabels[report.syncState]}</span>
        </div>
        <h2>{report.description}</h2>
        <p>{report.location}</p>
      </div>
      <div className="report-card-side">
        <span className={`priority priority-${report.priority}`}>{report.priority}</span>
        <span className="report-date">{new Date(report.reportedAt).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}
