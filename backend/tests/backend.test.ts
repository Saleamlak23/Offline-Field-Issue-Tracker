import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { categories, priorities, statuses, validateReportInput } from '@field-tracker/shared';
import { createApp } from '../src/app.js';
import { createDatabase, type AppDatabase } from '../src/db.js';
import { canTransition } from '../src/reports.js';

const databases: AppDatabase[] = [];

function setup() {
  const database = createDatabase(':memory:');
  databases.push(database);
  return { app: createApp(database), database };
}

function reportInput(clientId = 'a1b2c3d4-e5f6-4789-8123-abcdef012345') {
  return {
    clientId,
    category: 'water',
    description: 'Broken pipe near the school.',
    location: 'North sector, school',
    priority: 'high',
    reportedAt: new Date().toISOString(),
  };
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe('status transitions', () => {
  it('allows only transitions in the workflow table', () => {
    const allowed = new Set([
      'draft:submitted',
      'submitted:assigned', 'submitted:rejected',
      'assigned:in_progress', 'assigned:rejected',
      'in_progress:resolved', 'in_progress:rejected',
      'resolved:in_progress', 'rejected:submitted',
    ]);
    for (const from of statuses) {
      for (const to of statuses) {
        expect(canTransition(from, to)).toBe(allowed.has(`${from}:${to}`));
      }
    }
  });
});

describe('report validation', () => {
  it('reports invalid descriptions and future dates', () => {
    const input = { ...reportInput(), description: 'Nope', reportedAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() };
    const errors = validateReportInput(input);
    expect(errors.description).toBeDefined();
    expect(errors.reportedAt).toBeDefined();
  });

  it('accepts a complete valid payload', () => {
    expect(validateReportInput(reportInput())).toEqual({});
    expect(categories).toContain('water');
    expect(priorities).toContain('critical');
  });
});

describe('report API', () => {
  it('creates once and returns the existing report for repeated client IDs', async () => {
    const { app, database } = setup();
    const payload = reportInput();
    const created = await request(app).post('/api/reports').send(payload).expect(201);
    const repeated = await request(app).post('/api/reports').send(payload).expect(200);

    expect(repeated.body.id).toBe(created.body.id);
    expect(database.prepare('SELECT COUNT(*) AS count FROM reports').get()).toEqual({ count: 1 });
  });

  it('keeps concurrent duplicate requests to one report', async () => {
    const { app, database } = setup();
    const payload = reportInput();
    const responses = await Promise.all([
      request(app).post('/api/reports').send(payload),
      request(app).post('/api/reports').send(payload),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(database.prepare('SELECT COUNT(*) AS count FROM reports').get()).toEqual({ count: 1 });
  });

  it('validates inputs and records only valid status transitions', async () => {
    const { app } = setup();
    await request(app).post('/api/reports').send({ ...reportInput(), category: 'unknown' })
      .expect(400)
      .expect(({ body }) => expect(body.fields.category).toBeDefined());
    const created = await request(app).post('/api/reports').send(reportInput()).expect(201);
    await request(app).patch(`/api/reports/${created.body.id}/status`).send({ toStatus: 'resolved', actor: 'coordinator' }).expect(409);
    await request(app).patch(`/api/reports/${created.body.id}/status`).send({ toStatus: 'rejected', actor: 'coordinator' }).expect(400);
    const assigned = await request(app).patch(`/api/reports/${created.body.id}/status`)
      .send({ toStatus: 'assigned', actor: 'coordinator' }).expect(200);
    expect(assigned.body.revision).toBe(2);
    const detail = await request(app).get(`/api/reports/${created.body.id}`).expect(200);
    expect(detail.body.events.map((event: { eventType: string }) => event.eventType)).toEqual(['CREATED', 'STATUS_CHANGED']);
  });
});
