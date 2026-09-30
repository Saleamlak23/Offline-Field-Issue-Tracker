import type { AppDatabase } from './db.js';
import type { ReportInput } from '@field-tracker/shared';

interface ReportRow {
  id: number;
  client_id: string;
  category: string;
  description: string;
  location: string;
  priority: string;
  status: string;
  reported_at: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: number;
  clientId: string;
  category: string;
  description: string;
  location: string;
  priority: string;
  status: string;
  reportedAt: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

function mapReport(row: ReportRow): Report {
  return {
    id: row.id,
    clientId: row.client_id,
    category: row.category,
    description: row.description,
    location: row.location,
    priority: row.priority,
    status: row.status,
    reportedAt: row.reported_at,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function findReportByClientId(database: AppDatabase, clientId: string): Report | undefined {
  const row = database.prepare('SELECT * FROM reports WHERE client_id = ?').get(clientId) as ReportRow | undefined;
  return row ? mapReport(row) : undefined;
}

export function createReport(database: AppDatabase, input: ReportInput): { report: Report; created: boolean } {
  const existing = findReportByClientId(database, input.clientId);
  if (existing) return { report: existing, created: false };

  const insertReport = database.prepare(`
    INSERT INTO reports (client_id, category, description, location, priority, status, reported_at)
    VALUES (@clientId, @category, @description, @location, @priority, 'submitted', @reportedAt)
  `);
  const insertEvent = database.prepare(`
    INSERT INTO report_events (report_id, event_type, from_status, to_status, message, actor, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTransaction = database.transaction(() => {
    const result = insertReport.run(input);
    const reportId = Number(result.lastInsertRowid);
    insertEvent.run(reportId, 'CREATED', null, 'submitted', null, 'field_worker', new Date().toISOString());
    for (const event of input.localEvents ?? []) {
      insertEvent.run(
        reportId,
        event.eventType,
        event.fromStatus ?? null,
        event.toStatus ?? null,
        event.message ?? null,
        'field_worker',
        event.createdAt,
      );
    }
    return database.prepare('SELECT * FROM reports WHERE id = ?').get(reportId) as ReportRow;
  });

  try {
    return { report: mapReport(insertTransaction()), created: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: reports.client_id')) {
      const report = findReportByClientId(database, input.clientId);
      if (report) return { report, created: false };
    }
    throw error;
  }
}
