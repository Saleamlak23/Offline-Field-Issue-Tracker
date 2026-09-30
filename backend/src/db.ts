import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function createDatabase(databasePath = process.env.DB_PATH ?? 'data/reports.sqlite') {
  const resolvedPath = databasePath === ':memory:' ? databasePath : resolve(databasePath);
  if (resolvedPath !== ':memory:') mkdirSync(dirname(resolvedPath), { recursive: true });

  const database = new Database(resolvedPath);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL CHECK (category IN ('water','electrical','structural','safety','equipment','other')),
      description TEXT NOT NULL CHECK (length(description) BETWEEN 5 AND 2000),
      location TEXT NOT NULL CHECK (length(location) BETWEEN 2 AND 200),
      priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')),
      status TEXT NOT NULL CHECK (status IN ('draft','submitted','assigned','in_progress','resolved','rejected')) DEFAULT 'submitted',
      reported_at TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    CREATE TABLE IF NOT EXISTS report_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK (event_type IN ('CREATED','SUBMIT_QUEUED','SYNCED','SYNC_FAILED','STATUS_CHANGED','REOPENED','VALIDATION_REJECTED')),
      from_status TEXT,
      to_status TEXT,
      message TEXT,
      actor TEXT NOT NULL CHECK (actor IN ('field_worker','coordinator','system')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_events_report_id ON report_events(report_id);
  `);
  return database;
}

export type AppDatabase = ReturnType<typeof createDatabase>;
