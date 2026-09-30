import { useState, type FormEvent } from 'react';
import { categories, priorities } from '@field-tracker/shared';
import { Link, useNavigate } from 'react-router-dom';
import { ReportValidationError, createLocalReport } from '../localStore.js';

export function ReportForm() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<(typeof categories)[number]>('water');
  const [priority, setPriority] = useState<(typeof priorities)[number]>('medium');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [reportedAt, setReportedAt] = useState(new Date().toISOString().slice(0, 16));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const parsedDate = new Date(reportedAt);
      const normalizedDate = Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString();
      await createLocalReport({ category, priority, description, location, reportedAt: normalizedDate });
      navigate('/');
    } catch (error) {
      if (error instanceof ReportValidationError) setErrors(error.fields);
      else setErrors({ form: 'Could not save this report on the device. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="form-page">
      <Link className="back-link" to="/">← All reports</Link>
      <p className="eyebrow">NEW FIELD REPORT</p>
      <h1>What needs attention?</h1>
      <p className="page-description">This report is saved on your device before it syncs to the server.</p>
      <form className="report-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <label>Issue category<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{categories.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}</select></label>
          <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>{priorities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        <label>Description<textarea rows={5} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what happened and what may be affected." aria-invalid={Boolean(errors.description)} />{errors.description && <span className="field-error">{errors.description}</span>}</label>
        <label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Area, landmark, or nearby facility" aria-invalid={Boolean(errors.location)} />{errors.location && <span className="field-error">{errors.location}</span>}</label>
        <label>When did you notice it?<input type="datetime-local" value={reportedAt} onChange={(event) => setReportedAt(event.target.value)} aria-invalid={Boolean(errors.reportedAt)} />{errors.reportedAt && <span className="field-error">{errors.reportedAt}</span>}</label>
        {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
        <div className="form-footer"><span>Saved locally first <span aria-hidden="true">·</span> Syncs when online</span><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save report'}</button></div>
      </form>
    </section>
  );
}
