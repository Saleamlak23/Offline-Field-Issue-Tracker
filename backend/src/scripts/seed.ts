import { createDatabase } from '../db.js';
import { createReport, findReportByClientId, transitionReport } from '../reports.js';
import type { Status } from '@field-tracker/shared';

const examples = [
  {
    clientId: '00000000-0000-4000-8000-000000000001',
    category: 'water',
    description: 'Water main leaking beside the community clinic.',
    location: 'North ward, clinic entrance',
    priority: 'high',
    daysAgo: 1,
    status: 'submitted',
  },
  {
    clientId: '00000000-0000-4000-8000-000000000002',
    category: 'electrical',
    description: 'Streetlight wiring is exposed near the market.',
    location: 'Central market, east gate',
    priority: 'critical',
    daysAgo: 2,
    status: 'assigned',
  },
  {
    clientId: '00000000-0000-4000-8000-000000000003',
    category: 'structural',
    description: 'A large crack has appeared in the footbridge deck.',
    location: 'River crossing footbridge',
    priority: 'high',
    daysAgo: 3,
    status: 'in_progress',
  },
  {
    clientId: '00000000-0000-4000-8000-000000000004',
    category: 'safety',
    description: 'Damaged railing repaired along the school path.',
    location: 'Primary school north path',
    priority: 'medium',
    daysAgo: 4,
    status: 'resolved',
  },
  {
    clientId: '00000000-0000-4000-8000-000000000005',
    category: 'equipment',
    description: 'Request for a replacement pump lacks a site reference.',
    location: 'West sector, water point 8',
    priority: 'low',
    daysAgo: 5,
    status: 'rejected',
  },
  {
    clientId: '00000000-0000-4000-8000-000000000006',
    category: 'other',
    description: 'Drain cover is loose beside the bus stop.',
    location: 'South station bus stop',
    priority: 'medium',
    daysAgo: 2,
    status: 'submitted',
  },
] as const;

const database = createDatabase();
const transitionsByStatus: Record<string, Status[]> = {
  submitted: [],
  assigned: ['assigned'],
  in_progress: ['assigned', 'in_progress'],
  resolved: ['assigned', 'in_progress', 'resolved'],
  rejected: ['rejected'],
};
let inserted = 0;
let skipped = 0;

try {
  for (const example of examples) {
    if (findReportByClientId(database, example.clientId)) {
      skipped += 1;
      continue;
    }

    const reportedAt = new Date(Date.now() - example.daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const { report } = createReport(database, {
      clientId: example.clientId,
      category: example.category,
      description: example.description,
      location: example.location,
      priority: example.priority,
      reportedAt,
    });
    const createdAt = new Date(Date.now() - example.daysAgo * 24 * 60 * 60 * 1000).toISOString();
    database.prepare('UPDATE reports SET created_at = ? WHERE id = ?').run(createdAt, report.id);
    database
      .prepare("UPDATE report_events SET created_at = ? WHERE report_id = ? AND event_type = 'CREATED'")
      .run(createdAt, report.id);

    for (const nextStatus of transitionsByStatus[example.status]) {
      transitionReport(database, report.id, nextStatus, nextStatus === 'rejected' ? 'Seed example rejection reason.' : undefined);
    }
    inserted += 1;
  }
  console.log(`Seed complete: inserted ${inserted}, skipped ${skipped}.`);
} finally {
  database.close();
}
