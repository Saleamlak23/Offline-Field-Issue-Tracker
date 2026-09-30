export const categories = ['water', 'electrical', 'structural', 'safety', 'equipment', 'other'] as const;
export const priorities = ['low', 'medium', 'high', 'critical'] as const;
export const statuses = ['draft', 'submitted', 'assigned', 'in_progress', 'resolved', 'rejected'] as const;
export const eventTypes = [
  'CREATED',
  'SUBMIT_QUEUED',
  'SYNCED',
  'SYNC_FAILED',
  'STATUS_CHANGED',
  'REOPENED',
  'VALIDATION_REJECTED',
] as const;

export type Category = (typeof categories)[number];
export type Priority = (typeof priorities)[number];
export type Status = (typeof statuses)[number];
export type EventType = (typeof eventTypes)[number];

export interface LocalEventInput {
  eventType: EventType;
  fromStatus?: string;
  toStatus?: string;
  message?: string;
  createdAt: string;
}

export interface ReportInput {
  clientId: string;
  category: Category;
  description: string;
  location: string;
  priority: Priority;
  reportedAt: string;
  localEvents?: LocalEventInput[];
}

export type ValidationErrors = Record<string, string>;

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;

function isRecentIsoDate(value: unknown, now: number): value is string {
  if (typeof value !== 'string' || !isoDatePattern.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now + 24 * 60 * 60 * 1000;
}

export function validateReportInput(value: unknown, now = Date.now()): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { body: 'must be a JSON object' };

  const input = value as Record<string, unknown>;
  if (typeof input.clientId !== 'string' || !uuidV4Pattern.test(input.clientId)) errors.clientId = 'must be a valid UUID v4';
  if (typeof input.category !== 'string' || !categories.includes(input.category as Category)) {
    errors.category = `must be one of ${categories.join(', ')}`;
  }
  if (typeof input.description !== 'string' || input.description.length < 5 || input.description.length > 2000) {
    errors.description = 'must be between 5 and 2000 characters';
  }
  if (typeof input.location !== 'string' || input.location.length < 2 || input.location.length > 200) {
    errors.location = 'must be between 2 and 200 characters';
  }
  if (typeof input.priority !== 'string' || !priorities.includes(input.priority as Priority)) {
    errors.priority = `must be one of ${priorities.join(', ')}`;
  }
  if (!isRecentIsoDate(input.reportedAt, now)) {
    errors.reportedAt = 'must be a valid ISO-8601 date no more than 24 hours in the future';
  }
  if (input.localEvents !== undefined) {
    if (!Array.isArray(input.localEvents)) {
      errors.localEvents = 'must be an array';
    } else {
      input.localEvents.forEach((event, index) => {
        if (!event || typeof event !== 'object' || Array.isArray(event)) {
          errors[`localEvents.${index}`] = 'must be an object';
          return;
        }
        const entry = event as Record<string, unknown>;
        if (typeof entry.eventType !== 'string' || !eventTypes.includes(entry.eventType as EventType)) {
          errors[`localEvents.${index}.eventType`] = `must be one of ${eventTypes.join(', ')}`;
        }
        if (!isRecentIsoDate(entry.createdAt, now)) {
          errors[`localEvents.${index}.createdAt`] = 'must be a valid ISO-8601 date';
        }
      });
    }
  }
  return errors;
}
