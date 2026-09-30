import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { categories, priorities } from '@field-tracker/shared';
import { Link, useParams } from 'react-router-dom';
import { db } from '../db.js';
import { HistoryTimeline } from '../components/HistoryTimeline.js';
import { ReportValidationError, submitLocalDraft, updateUnsentReport } from '../localStore.js';
import { useConnectivity } from '../connectivity.js';

export function ReportDetail() {
  const { clientId = '' } = useParams();
  const { retryOne, isSyncing } = useConnectivity();
  const data = useLiveQuery(async () => {
    const report = await db.reports.get(clientId);
    if (!report) return null;
    const events = await db.events.where('clientId').equals(clientId).sortBy('createdAt');
    return { report, events };
  }, [clientId]);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('water');
  const [priority, setPriority] = useState<(typeof priorities)[number]>('medium');
  const [reportedAt, setReportedAt] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');

  if (data === undefined) return <section className="empty-state">Loading saved report…</section>;
  if (data === null) return <section className="empty-state"><p>Saved report not found.</p><Link to="/">Back to reports</Link></section>;
  const { report, events } = data;
  const canEdit = report.status === 'draft' || (report.syncState === 'failed' && report.retryable === false && report.serverId === undefined);

  async function submitDraft() {
    try {
      await submitLocalDraft(clientId);
      await retryOne(clientId);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not submit this draft.');
    }
  }

  function startEditing() {
    setDescription(report.description);
    setLocation(report.location);
    setCategory(report.category);
    setPriority(report.priority);
    setReportedAt(new Date(report.reportedAt).toISOString().slice(0, 16));
    setEditing(true);
    setFieldErrors({});
    setSaveError('');
  }

  async function saveEditedReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setSaveError('');
    const parsedDate = new Date(reportedAt);
    const reportedAtIso = Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString();
    try {
      await updateUnsentReport(clientId, { description, location, category, priority, reportedAt: reportedAtIso });
      setEditing(false);
    } catch (error) {
      if (error instanceof ReportValidationError) setFieldErrors(error.fields);
      else setSaveError(error instanceof Error ? error.message : 'Could not update this report.');
    }
  }

  return (
    <section className="detail-page">
      <Link className="back-link" to="/">← All reports</Link>
      <div className="detail-heading">
        <div><p className="eyebrow">FIELD REPORT</p><h1>{report.description}</h1><p className="detail-location">⌖ {report.location}</p></div>
        <span className={`sync-badge sync-${report.syncState}`}><span className="sync-dot" />{report.syncState === 'pending' ? 'Pending sync' : report.syncState === 'synced' ? 'Synced' : 'Sync failed'}</span>
      </div>
      <div className="detail-grid">
        <article className="detail-card">
          {editing ? (
            <form className="report-form edit-report-form" onSubmit={saveEditedReport} noValidate>
              <h2>Correct report details</h2>
              <label>Issue category<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>{priorities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label>Description<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />{fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}</label>
              <label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} />{fieldErrors.location && <span className="field-error">{fieldErrors.location}</span>}</label>
              <label>Reported at<input type="datetime-local" value={reportedAt} onChange={(event) => setReportedAt(event.target.value)} />{fieldErrors.reportedAt && <span className="field-error">{fieldErrors.reportedAt}</span>}</label>
              {saveError && <p className="field-error">{saveError}</p>}
              <div className="inline-actions"><button type="button" className="button button-secondary" onClick={() => setEditing(false)}>Cancel</button><button className="button button-primary">Save and retry sync</button></div>
            </form>
          ) : (
            <>
              <div className="detail-card-header"><h2>Report details</h2>{canEdit && <button className="text-button" onClick={startEditing}>Edit details</button>}</div>
              <dl className="detail-fields">
                <div><dt>Category</dt><dd>{report.category}</dd></div>
                <div><dt>Priority</dt><dd className={`priority priority-${report.priority}`}>{report.priority}</dd></div>
                <div><dt>Reported at</dt><dd>{new Date(report.reportedAt).toLocaleString()}</dd></div>
                <div><dt>Workflow status</dt><dd>{report.status.replace('_', ' ')}</dd></div>
                {report.serverId && <div><dt>Server reference</dt><dd>#{report.serverId}</dd></div>}
              </dl>
              {report.status === 'draft' && <div className="sync-error-box"><strong>This draft is saved on this device.</strong><p>Submit it when it is ready to send to the coordinator.</p><button className="button button-primary" onClick={() => void submitDraft()}>Submit report</button></div>}
              {saveError && <p className="field-error" role="alert">{saveError}</p>}
              {report.syncState === 'failed' && <div className="sync-error-box"><strong>{report.lastSyncError || 'The server did not accept this report.'}</strong><p>{report.syncAttempts} automatic {report.syncAttempts === 1 ? 'attempt' : 'attempts'} made.</p>{report.retryable !== false && <button className="button button-secondary" onClick={() => void retryOne(report.clientId)} disabled={isSyncing}>{isSyncing ? 'Retrying…' : 'Retry sync'}</button>}</div>}
            </>
          )}
        </article>
        <article className="detail-card history-card"><div className="detail-card-header"><h2>History</h2><span>{events.length} events</span></div><HistoryTimeline events={events.map((entry, index) => ({ ...entry, id: entry.id ?? `${entry.clientId}-${index}` }))} /></article>
      </div>
    </section>
  );
}
