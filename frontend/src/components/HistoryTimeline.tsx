import type { EventType } from '@field-tracker/shared';

export interface HistoryEntry {
  id: string | number;
  eventType: EventType | string;
  fromStatus?: string | null;
  toStatus?: string | null;
  message?: string | null;
  createdAt: string;
}

const eventLabels: Record<string, string> = {
  CREATED: 'Report created',
  SUBMIT_QUEUED: 'Added to sync queue',
  SYNCED: 'Synced with server',
  SYNC_FAILED: 'Sync attempt failed',
  STATUS_CHANGED: 'Status updated',
  REOPENED: 'Report reopened',
  VALIDATION_REJECTED: 'Report needs changes',
};

export function HistoryTimeline({ events }: { events: HistoryEntry[] }) {
  return (
    <ol className="history-timeline">
      {events.map((event) => (
        <li key={event.id} className="history-item">
          <span className={`history-marker event-${event.eventType.toLowerCase()}`} />
          <div className="history-copy">
            <div className="history-title-row"><strong>{eventLabels[event.eventType] ?? event.eventType}</strong><time>{new Date(event.createdAt).toLocaleString()}</time></div>
            {(event.fromStatus || event.toStatus) && <p>{event.fromStatus ? `${event.fromStatus.replace('_', ' ')} → ` : ''}{event.toStatus?.replace('_', ' ')}</p>}
            {event.message && <p className="history-message">{event.message}</p>}
          </div>
        </li>
      ))}
      {events.length === 0 && <li className="timeline-empty">No history recorded yet.</li>}
    </ol>
  );
}
