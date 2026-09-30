import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from './db.js';
import { createLocalReport } from './localStore.js';
import { SyncService } from './syncService.js';

const validInput = {
  category: 'water' as const,
  description: 'Broken pipe beside the school.',
  location: 'North sector, school',
  priority: 'high' as const,
  reportedAt: new Date().toISOString(),
};

afterEach(async () => {
  await db.open();
  await db.reports.clear();
  await db.events.clear();
  vi.unstubAllGlobals();
});

async function createPendingReport() {
  vi.stubGlobal('crypto', { randomUUID: () => 'a1b2c3d4-e5f6-4789-8123-abcdef012345' });
  return createLocalReport(validInput);
}

describe('sync service', () => {
  it('does not attempt a request or increment attempts while offline', async () => {
    const report = await createPendingReport();
    const sendReport = vi.fn();
    const service = new SyncService({ isOnline: () => false, sendReport });

    await service.runSyncCycle();

    expect(sendReport).not.toHaveBeenCalled();
    expect((await db.reports.get(report.clientId))?.syncAttempts).toBe(0);
  });

  it('backs off after transient failures and syncs after a successful retry', async () => {
    const report = await createPendingReport();
    let now = 1_000;
    const sendReport = vi.fn()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValue({ id: 42, clientId: report.clientId, revision: 1 });
    const service = new SyncService({ isOnline: () => true, sendReport, now: () => now });

    await service.runSyncCycle();
    expect((await db.reports.get(report.clientId))?.syncAttempts).toBe(1);
    now += 2_000;
    await service.runSyncCycle();
    expect((await db.reports.get(report.clientId))?.syncAttempts).toBe(2);
    now += 4_000;
    await service.runSyncCycle();

    expect(sendReport).toHaveBeenCalledTimes(3);
    expect(await db.reports.get(report.clientId)).toMatchObject({ syncState: 'synced', serverId: 42, revision: 1, syncAttempts: 2 });
  });

  it('marks an idempotent success without adding another local report', async () => {
    const report = await createPendingReport();
    const service = new SyncService({
      isOnline: () => true,
      sendReport: async () => ({ id: 12, clientId: report.clientId, revision: 1 }),
    });

    await service.runSyncCycle();

    expect(await db.reports.count()).toBe(1);
    expect(await db.reports.get(report.clientId)).toMatchObject({ syncState: 'synced', serverId: 12 });
  });
});
