import { useCallback, useEffect, useState } from 'react';
import { canTransition, statuses, type Status } from '@field-tracker/shared';
import { Link, useParams } from 'react-router-dom';
import { fetchReportDetail, fetchReports, updateReportStatus, type ServerReport, type ServerReportDetail } from '../apiClient.js';
import { HistoryTimeline } from '../components/HistoryTimeline.js';
import { useConnectivity } from '../connectivity.js';

function statusLabel(status: Status) {
  return status.replace('_', ' ');
}

export function Coordinator() {
  const { isOnline } = useConnectivity();
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [reports, setReports] = useState<ServerReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOnline) return;
    let active = true;
    setLoading(true);
    setError('');
    fetchReports(status === 'all' ? undefined : status)
      .then((result) => { if (active) setReports(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load reports.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOnline, status]);

  if (!isOnline) return <section className="connectivity-required"><span className="offline-symbol">⌁</span><p className="eyebrow">COORDINATOR DESK</p><h1>Connection required</h1><p>The coordinator view needs a live connection to load and update server reports.</p></section>;

  return (
    <section>
      <div className="page-heading"><div><p className="eyebrow">COORDINATOR DESK</p><h1>Review field reports</h1><p className="page-description">Reports synced from field workers. Choose an issue to review its history and update its status.</p></div>
        <label className="filter-select">Status<select value={status} onChange={(event) => setStatus(event.target.value as Status | 'all')}><option value="all">All statuses</option>{statuses.filter((value) => value !== 'draft').map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
      </div>
      {error && <div className="error-callout" role="alert">{error}</div>}
      <div className="coordinator-table-wrap"><table className="coordinator-table"><thead><tr><th>Issue</th><th>Location</th><th>Priority</th><th>Status</th><th>Reported</th><th /></tr></thead><tbody>
        {reports.map((report) => <tr key={report.id}><td><Link to={`/coordinator/reports/${report.id}`}>{report.description}</Link></td><td>{report.location}</td><td><span className={`priority priority-${report.priority}`}>{report.priority}</span></td><td><span className="status-chip">{statusLabel(report.status)}</span></td><td>{new Date(report.reportedAt).toLocaleDateString()}</td><td><Link className="row-arrow" aria-label={`Review ${report.description}`} to={`/coordinator/reports/${report.id}`}>→</Link></td></tr>)}
        {!loading && reports.length === 0 && <tr><td colSpan={6} className="table-empty">{error ? 'Reports could not be loaded.' : 'No reports match this status.'}</td></tr>}
        {loading && <tr><td colSpan={6} className="table-empty">Loading server reports…</td></tr>}
      </tbody></table></div>
    </section>
  );
}

const transitionLabels: Partial<Record<Status, string>> = {
  assigned: 'Assign',
  in_progress: 'Start work',
  resolved: 'Resolve',
  rejected: 'Reject',
  submitted: 'Reopen',
};

export function CoordinatorReportDetail() {
  const { id = '' } = useParams();
  const { isOnline } = useConnectivity();
  const reportId = Number(id);
  const [report, setReport] = useState<ServerReportDetail>();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!isOnline || !Number.isSafeInteger(reportId) || reportId < 1) return;
    setLoading(true);
    try {
      setReport(await fetchReportDetail(reportId));
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load this report.');
    } finally {
      setLoading(false);
    }
  }, [isOnline, reportId]);

  useEffect(() => { void reload(); }, [reload]);

  async function transition(toStatus: Status) {
    setSaving(true);
    setMessage('');
    try {
      await updateReportStatus(reportId, toStatus, reason.trim() || undefined);
      setReason('');
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update report status.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOnline) return <section className="connectivity-required"><p className="eyebrow">COORDINATOR DESK</p><h1>Connection required</h1><p>Reconnect to view server history and change the report status.</p></section>;
  if (loading && !report) return <section className="empty-state">Loading report…</section>;
  if (!report) return <section className="empty-state"><p>{message || 'Report not found.'}</p><Link to="/coordinator">Back to reports</Link></section>;

  const available = statuses.filter((target) => canTransition(report.status, target));
  const needsReason = available.includes('rejected');

  return (
    <section className="detail-page">
      <Link className="back-link" to="/coordinator">← Coordinator reports</Link>
      <div className="detail-heading"><div><p className="eyebrow">COORDINATOR REVIEW · #{report.id}</p><h1>{report.description}</h1><p className="detail-location">⌖ {report.location}</p></div><span className="status-chip">{statusLabel(report.status)}</span></div>
      {message && <div className="error-callout" role="alert">{message}</div>}
      <div className="detail-grid">
        <article className="detail-card"><div className="detail-card-header"><h2>Issue details</h2></div><dl className="detail-fields"><div><dt>Category</dt><dd>{report.category}</dd></div><div><dt>Priority</dt><dd className={`priority priority-${report.priority}`}>{report.priority}</dd></div><div><dt>Reported at</dt><dd>{new Date(report.reportedAt).toLocaleString()}</dd></div><div><dt>Revision</dt><dd>{report.revision}</dd></div></dl>
          <div className="transition-panel"><h3>Update status</h3>{needsReason && <label className="reason-field">Rejection reason<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this report is rejected" /></label>}<div className="transition-actions">{available.map((target) => <button key={target} className={`button ${target === 'rejected' ? 'button-danger' : 'button-primary'}`} disabled={saving || (target === 'rejected' && reason.trim().length === 0)} onClick={() => void transition(target)}>{saving ? 'Saving…' : report.status === 'resolved' || report.status === 'rejected' ? 'Reopen' : transitionLabels[target] ?? statusLabel(target)}</button>)}{available.length === 0 && <span className="muted-copy">No available status changes.</span>}</div></div>
        </article>
        <article className="detail-card history-card"><div className="detail-card-header"><h2>History</h2><span>{report.events.length} events</span></div><HistoryTimeline events={report.events} /></article>
      </div>
    </section>
  );
}
