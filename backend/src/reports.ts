import type { AppDatabase } from './db.js';
import { canTransition } from '@field-tracker/shared';
import type { EventType, ReportInput, Status } from '@field-tracker/shared';

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

export interface ReportEvent {
  id: number;
  reportId: number;
  eventType: EventType;
  fromStatus: string | null;
  toStatus: string | null;
  message: string | null;
  actor: 'field_worker' | 'coordinator' | 'system';
  createdAt: string;
}

interface EventRow {
  id: number;
  report_id: number;
  event_type: EventType;
  from_status: string | null;
  to_status: string | null;
  message: string | null;
  actor: ReportEvent['actor'];
  created_at: string;
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

function mapEvent(row: EventRow): ReportEvent {
  return {
    id: row.id,
    reportId: row.report_id,
    eventType: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    message: row.message,
    actor: row.actor,
    createdAt: row.created_at,
  };
}

export function findReportById(database: AppDatabase, id: number): Report | undefined {
  const row = database.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow | undefined;
  return row ? mapReport(row) : undefined;
}

export function listReports(database: AppDatabase, status?: Status): Report[] {
  const rows = status
    ? database.prepare('SELECT * FROM reports WHERE status = ? ORDER BY created_at DESC, id DESC').all(status)
    : database.prepare('SELECT * FROM reports ORDER BY created_at DESC, id DESC').all();
  return (rows as ReportRow[]).map(mapReport);
}

export function listReportEvents(database: AppDatabase, reportId: number): ReportEvent[] {
  const rows = database
    .prepare('SELECT * FROM report_events WHERE report_id = ? ORDER BY created_at ASC, id ASC')
    .all(reportId) as EventRow[];
  return rows.map(mapEvent);
}

export { canTransition } from '@field-tracker/shared';

export function transitionReport(
  database: AppDatabase,
  reportId: number,
  toStatus: Status,
  message?: string,
): Report | undefined {
  const existing = findReportById(database, reportId);
  if (!existing) return undefined;
  if (!canTransition(existing.status as Status, toStatus)) return undefined;

  const eventType: EventType =
    (existing.status === 'resolved' && toStatus === 'in_progress') ||
    (existing.status === 'rejected' && toStatus === 'submitted')
      ? 'REOPENED'
      : 'STATUS_CHANGED';
  const now = new Date().toISOString();
  const updateTransaction = database.transaction(() => {
    database
      .prepare('UPDATE reports SET status = ?, revision = revision + 1, updated_at = ? WHERE id = ?')
      .run(toStatus, now, reportId);
    database
      .prepare(`
        INSERT INTO report_events (report_id, event_type, from_status, to_status, message, actor, created_at)
        VALUES (?, ?, ?, ?, ?, 'coordinator', ?)
      `)
      .run(reportId, eventType, existing.status, toStatus, message ?? null, now);
    return database.prepare('SELECT * FROM reports WHERE id = ?').get(reportId) as ReportRow;
  });
  return mapReport(updateTransaction());
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
