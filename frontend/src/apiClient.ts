import type { LocalEvent, LocalReport } from './db.js';

export interface ServerReport {
  id: number;
  clientId: string;
  revision: number;
}

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

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

  let message = `Server returned ${response.status}`;
  try {
    const body = await response.json() as { fields?: Record<string, string>; error?: string };
    message = Object.values(body.fields ?? {}).join('; ') || body.error || message;
  } catch {
    message = response.statusText || message;
  }
  const error = new Error(message) as Error & { status?: number };
  error.status = response.status;
  throw error;
}

export function isTransientSyncError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return status === undefined || status >= 500;
}
