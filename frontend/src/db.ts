import Dexie, { type Table } from 'dexie';
import type { Category, EventType, Priority, Status } from '@field-tracker/shared';

export interface LocalReport {
  clientId: string;
  category: Category;
  description: string;
  location: string;
  priority: Priority;
  status: Status;
  reportedAt: string;
  syncState: 'pending' | 'synced' | 'failed';
  syncAttempts: number;
  lastSyncError?: string;
  serverId?: number;
  revision?: number;
  createdAtLocal: string;
  updatedAtLocal: string;
}

export interface LocalEvent {
  id?: number;
  clientId: string;
  eventType: EventType;
  fromStatus?: string;
  toStatus?: string;
  message?: string;
  createdAt: string;
}

export class AppDB extends Dexie {
  reports!: Table<LocalReport, string>;
  events!: Table<LocalEvent, number>;

  constructor(name = 'field-issue-tracker') {
    super(name);
    this.version(1).stores({
      reports: 'clientId, syncState, status, createdAtLocal',
      events: '++id, clientId, createdAt',
    });
  }
}

export const db = new AppDB();
