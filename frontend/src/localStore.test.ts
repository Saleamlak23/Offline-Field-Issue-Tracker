import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppDB, db } from './db.js';
import { createLocalReport, ReportValidationError } from './localStore.js';

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

describe('local report store', () => {
  it('persists a queued report and its initial history events', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'a1b2c3d4-e5f6-4789-8123-abcdef012345' });
    const report = await createLocalReport(validInput);

    expect(await db.reports.get(report.clientId)).toMatchObject({ status: 'submitted', syncState: 'pending', syncAttempts: 0 });
    expect((await db.events.where('clientId').equals(report.clientId).sortBy('createdAt')).map((event) => event.eventType))
      .toEqual(['CREATED', 'SUBMIT_QUEUED']);
  });

  it('rejects invalid reports before writing to IndexedDB', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'a1b2c3d4-e5f6-4789-8123-abcdef012345' });
    await expect(createLocalReport({ ...validInput, description: 'bad' })).rejects.toBeInstanceOf(ReportValidationError);
    expect(await db.reports.count()).toBe(0);
  });

  it('retains reports after closing and reopening the database', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'a1b2c3d4-e5f6-4789-8123-abcdef012345' });
    await createLocalReport(validInput);
    await db.close();
    const reopened = new AppDB();
    expect(await reopened.reports.count()).toBe(1);
    expect((await reopened.reports.toArray())[0].description).toBe(validInput.description);
    await reopened.close();
    await db.open();
  });
});
