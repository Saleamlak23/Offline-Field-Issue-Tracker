import { validateReportInput, type Category, type Priority, type ValidationErrors } from '@field-tracker/shared';
import { db, type LocalReport } from './db.js';

export interface NewReportInput {
  category: Category;
  description: string;
  location: string;
  priority: Priority;
  reportedAt: string;
}

export class ReportValidationError extends Error {
  constructor(public readonly fields: ValidationErrors) {
    super('Please correct the highlighted fields.');
    this.name = 'ReportValidationError';
  }
}

export async function createLocalReport(input: NewReportInput, status: 'draft' | 'submitted' = 'submitted'): Promise<LocalReport> {
  const clientId = crypto.randomUUID();
  const now = new Date().toISOString();
  const errors = validateReportInput({ ...input, clientId });
  if (Object.keys(errors).length > 0) throw new ReportValidationError(errors);

  const report: LocalReport = {
    ...input,
    clientId,
    status,
    syncState: status === 'draft' ? 'draft' : 'pending',
    syncAttempts: 0,
    createdAtLocal: now,
    updatedAtLocal: now,
  };

  await db.transaction('rw', db.reports, db.events, async () => {
    await db.reports.add(report);
    await db.events.bulkAdd(status === 'draft' ? [
      { clientId, eventType: 'CREATED', toStatus: 'draft', createdAt: now },
    ] : [
      { clientId, eventType: 'CREATED', toStatus: 'submitted', createdAt: now },
      { clientId, eventType: 'SUBMIT_QUEUED', toStatus: 'submitted', createdAt: now },
    ]);
  });
  return report;
}

export async function submitLocalDraft(clientId: string): Promise<LocalReport> {
  const current = await db.reports.get(clientId);
  if (!current || current.status !== 'draft' || current.syncState !== 'draft') {
    throw new Error('Only a saved draft can be submitted.');
  }
  const now = new Date().toISOString();
  const submitted: LocalReport = {
    ...current,
    status: 'submitted',
    syncState: 'pending',
    updatedAtLocal: now,
  };
  await db.transaction('rw', db.reports, db.events, async () => {
    await db.reports.put(submitted);
    await db.events.bulkAdd([
      { clientId, eventType: 'STATUS_CHANGED', fromStatus: 'draft', toStatus: 'submitted', createdAt: now },
      { clientId, eventType: 'SUBMIT_QUEUED', toStatus: 'submitted', createdAt: now },
    ]);
  });
  return submitted;
}

export async function getLocalReport(clientId: string): Promise<LocalReport | undefined> {
  return db.reports.get(clientId);
}

export async function getReportEvents(clientId: string) {
  return db.events.where('clientId').equals(clientId).sortBy('createdAt');
}

export async function updateUnsentReport(clientId: string, input: NewReportInput): Promise<LocalReport> {
  const current = await db.reports.get(clientId);
  if (!current || current.serverId !== undefined || current.syncState === 'synced') {
    throw new Error('Only a report that has not reached the server can be edited.');
  }
  const errors = validateReportInput({ ...input, clientId });
  if (Object.keys(errors).length > 0) throw new ReportValidationError(errors);

  const updated: LocalReport = {
    ...current,
    ...input,
    syncState: current.status === 'draft' ? 'draft' : 'pending',
    retryable: undefined,
    lastSyncError: undefined,
    updatedAtLocal: new Date().toISOString(),
  };
  await db.transaction('rw', db.reports, db.events, async () => {
    await db.reports.put(updated);
    if (current.status !== 'draft') {
      await db.events.add({ clientId, eventType: 'SUBMIT_QUEUED', toStatus: 'submitted', createdAt: updated.updatedAtLocal });
    }
  });
  return updated;
}
