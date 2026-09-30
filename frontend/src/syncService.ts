import { db, type LocalEvent, type LocalReport } from './db.js';
import { isTransientSyncError, postReport, type ServerReport } from './apiClient.js';

export interface SyncServiceOptions {
  isOnline?: () => boolean;
  sendReport?: (report: LocalReport, events: LocalEvent[], signal: AbortSignal) => Promise<ServerReport>;
  now?: () => number;
  timeoutMs?: number;
}

export class SyncService {
  private readonly isOnline: () => boolean;
  private readonly sendReport: NonNullable<SyncServiceOptions['sendReport']>;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly retryAfter = new Map<string, number>();
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private onlineOverride: boolean | undefined;
  private cycle: Promise<void> | undefined;

  constructor(options: SyncServiceOptions = {}) {
    this.isOnline = options.isOnline ?? (() => navigator.onLine);
    this.sendReport = options.sendReport ?? ((report, events, signal) => postReport(report, events, signal));
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  setOnlineState(isOnline: boolean) {
    this.onlineOverride = isOnline;
  }

  async runSyncCycle(force = false, clientId?: string, onlineOverride?: boolean): Promise<void> {
    if (onlineOverride !== undefined) this.onlineOverride = onlineOverride;
    if (!(this.onlineOverride ?? this.isOnline())) return;
    if (this.cycle) return this.cycle;

    this.cycle = this.syncReports(force, clientId).finally(() => {
      this.cycle = undefined;
    });
    return this.cycle;
  }

  async retryOne(clientId: string, onlineOverride?: boolean): Promise<void> {
    await this.runSyncCycle(true, clientId, onlineOverride);
  }

  private async syncReports(force: boolean, clientId?: string): Promise<void> {
    const candidates = clientId
      ? [await db.reports.get(clientId)].filter((report): report is LocalReport => Boolean(report))
      : await db.reports.where('syncState').anyOf('pending', 'failed').sortBy('createdAtLocal');

    for (const report of candidates) {
      if (report.syncState === 'synced') continue;
      if (!force && this.retryAfter.get(report.clientId)! > this.now()) continue;
      if (report.retryable === false && !force) continue;

      this.clearRetry(report.clientId);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const events = await db.events.where('clientId').equals(report.clientId).sortBy('createdAt');
        const serverReport = await this.sendReport(report, events, controller.signal);
        if (serverReport.clientId !== report.clientId || !Number.isSafeInteger(serverReport.id)) {
          throw new Error('The server response did not match this report.');
        }
        await db.transaction('rw', db.reports, db.events, async () => {
          await db.reports.update(report.clientId, {
            syncState: 'synced',
            retryable: false,
            serverId: serverReport.id,
            revision: serverReport.revision,
            lastSyncError: undefined,
            updatedAtLocal: new Date(this.now()).toISOString(),
          });
          await db.events.add({ clientId: report.clientId, eventType: 'SYNCED', createdAt: new Date(this.now()).toISOString() });
        });
        this.retryAfter.delete(report.clientId);
        this.clearRetry(report.clientId);
      } catch (error) {
        const retryable = isTransientSyncError(error);
        const message = error instanceof Error ? error.message : 'Sync failed unexpectedly.';
        const failedAt = this.now();
        await db.transaction('rw', db.reports, db.events, async () => {
          await db.reports.update(report.clientId, {
            syncState: 'failed',
            retryable,
            syncAttempts: report.syncAttempts + (retryable ? 1 : 0),
            lastSyncError: message,
            updatedAtLocal: new Date(failedAt).toISOString(),
          });
          await db.events.add({ clientId: report.clientId, eventType: 'SYNC_FAILED', message, createdAt: new Date(failedAt).toISOString() });
        });
        if (retryable) {
          const delay = Math.min(30_000, 2 ** report.syncAttempts * 2_000);
          this.retryAfter.set(report.clientId, failedAt + delay);
          this.retryTimers.set(report.clientId, setTimeout(() => {
            this.retryTimers.delete(report.clientId);
            void this.runSyncCycle(false, undefined, this.onlineOverride);
          }, delay));
        } else {
          this.retryAfter.delete(report.clientId);
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  private clearRetry(clientId: string) {
    const timer = this.retryTimers.get(clientId);
    if (timer) clearTimeout(timer);
    this.retryTimers.delete(clientId);
  }
}

export const syncService = new SyncService();
