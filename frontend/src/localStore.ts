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

export async function createLocalReport(input: NewReportInput): Promise<LocalReport> {
  const clientId = crypto.randomUUID();
  const now = new Date().toISOString();
  const errors = validateReportInput({ ...input, clientId });
  if (Object.keys(errors).length > 0) throw new ReportValidationError(errors);

  const report: LocalReport = {
    ...input,
    clientId,
    status: 'submitted',
    syncState: 'pending',
    syncAttempts: 0,
    createdAtLocal: now,
    updatedAtLocal: now,
  };

  await db.transaction('rw', db.reports, db.events, async () => {
    await db.reports.add(report);
    await db.events.bulkAdd([
      { clientId, eventType: 'CREATED', createdAt: now },
      { clientId, eventType: 'SUBMIT_QUEUED', toStatus: 'submitted', createdAt: now },
    ]);
  });
  return report;
}

export async function getLocalReport(clientId: string): Promise<LocalReport | undefined> {
  return db.reports.get(clientId);
}

export async function getReportEvents(clientId: string) {
  return db.events.where('clientId').equals(clientId).sortBy('createdAt');
}
