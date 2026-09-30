import type { Status } from '@field-tracker/shared';
import type { LocalEvent, LocalReport } from './db.js';

export interface ServerReport {
  id: number;
  clientId: string;
  category: string;
  description: string;
  location: string;
  priority: string;
  status: Status;
  reportedAt: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServerEvent {
  id: number;
  reportId: number;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  message: string | null;
  actor: string;
  createdAt: string;
}

export interface ServerReportDetail extends ServerReport {
  events: ServerEvent[];
}

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function readApiError(response: Response): Promise<Error & { status?: number }> {
  let message = `Server returned ${response.status}`;
  try {
    const body = await response.json() as { fields?: Record<string, string>; error?: string };
    message = Object.values(body.fields ?? {}).join('; ') || body.error || message;
  } catch {
    message = response.statusText || message;
  }
  const error = new Error(message) as Error & { status?: number };
  error.status = response.status;
  return error;
}

export async function postReport(report: LocalReport, events: LocalEvent[], signal: AbortSignal): Promise<ServerReport> {
  const response = await fetch(`${apiBaseUrl}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      clientId: report.clientId,
      category: report.category,
      description: report.description,
      location: report.location,
      priority: report.priority,
      reportedAt: report.reportedAt,
      localEvents: events.map(({ eventType, fromStatus, toStatus, message, createdAt }) => ({
        eventType,
        fromStatus,
        toStatus,
        message,
        createdAt,
      })),
    }),
  });

  if (response.status === 200 || response.status === 201) {
    return response.json() as Promise<ServerReport>;
  }

  throw await readApiError(response);
}

export function isTransientSyncError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return status === undefined || status >= 500;
}

export async function fetchReports(status?: Status): Promise<ServerReport[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await fetch(`${apiBaseUrl}/api/reports${suffix}`);
  if (!response.ok) throw await readApiError(response);
  return response.json() as Promise<ServerReport[]>;
}

export async function fetchReportDetail(id: number): Promise<ServerReportDetail> {
  const response = await fetch(`${apiBaseUrl}/api/reports/${id}`);
  if (!response.ok) throw await readApiError(response);
  return response.json() as Promise<ServerReportDetail>;
}

export async function updateReportStatus(id: number, toStatus: Status, message?: string): Promise<ServerReport> {
  const response = await fetch(`${apiBaseUrl}/api/reports/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStatus, actor: 'coordinator', message }),
  });
  if (!response.ok) throw await readApiError(response);
  return response.json() as Promise<ServerReport>;
}
