import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db.js';
import { ReportCard } from '../components/ReportCard.js';

export function ReportList() {
  const reports = useLiveQuery(() => db.reports.orderBy('createdAtLocal').reverse().toArray(), []);
  const pendingCount = reports?.filter((report) => report.syncState !== 'synced').length ?? 0;

  return (
    <section>
      <div className="page-heading">
        <div><p className="eyebrow">FIELD REPORTS</p><h1>Issues from the field</h1><p className="page-description">Capture what needs attention. Your reports are saved on this device first.</p></div>
        <Link className="button button-primary" to="/reports/new"><span aria-hidden="true">＋</span> New report</Link>
      </div>
      <div className="list-summary"><span>{reports?.length ?? 0} reports saved</span><span>{pendingCount} awaiting sync</span></div>
      {reports === undefined ? <div className="empty-state">Loading your saved reports…</div> : reports.length === 0 ? (
        <div className="empty-state"><span className="empty-icon">＋</span><h2>No reports yet</h2><p>Start by recording an issue. It will be saved even without a connection.</p><Link to="/reports/new">Create your first report</Link></div>
      ) : <div className="report-list">{reports.map((report) => <ReportCard key={report.clientId} report={report} />)}</div>}
    </section>
  );
}
