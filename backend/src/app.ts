import express from 'express';
import { statuses, validateReportInput, type ReportInput, type Status } from '@field-tracker/shared';
import { createDatabase, type AppDatabase } from './db.js';
import { createReport, findReportById, listReportEvents, listReports, transitionReport } from './reports.js';

export function createApp(database: AppDatabase = createDatabase()) {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.post('/api/reports', (request, response) => {
    const errors = validateReportInput(request.body);
    if (Object.keys(errors).length > 0) {
      response.status(400).json({ error: 'validation_failed', fields: errors });
      return;
    }

    const result = createReport(database, request.body as ReportInput);
    response.status(result.created ? 201 : 200).json(result.report);
  });

  app.get('/api/reports', (request, response) => {
    const status = request.query.status;
    if (status !== undefined && (typeof status !== 'string' || !statuses.includes(status as Status))) {
      response.status(400).json({ error: 'validation_failed', fields: { status: 'must be a valid report status' } });
      return;
    }
    response.json(listReports(database, status as Status | undefined));
  });

  app.get('/api/reports/:id/events', (request, response) => {
    const reportId = Number(request.params.id);
    if (!Number.isSafeInteger(reportId) || reportId < 1 || !findReportById(database, reportId)) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    response.json(listReportEvents(database, reportId));
  });

  app.get('/api/reports/:id', (request, response) => {
    const reportId = Number(request.params.id);
    const report = Number.isSafeInteger(reportId) && reportId > 0 ? findReportById(database, reportId) : undefined;
    if (!report) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    response.json({ ...report, events: listReportEvents(database, reportId) });
  });

  app.patch('/api/reports/:id/status', (request, response) => {
    const reportId = Number(request.params.id);
    const report = Number.isSafeInteger(reportId) && reportId > 0 ? findReportById(database, reportId) : undefined;
    if (!report) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    const body = request.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body) || body.actor !== 'coordinator' ||
        typeof body.toStatus !== 'string' || !statuses.includes(body.toStatus as Status)) {
      response.status(400).json({
        error: 'validation_failed',
        fields: { toStatus: 'must be a valid status and actor must be coordinator' },
      });
      return;
    }
    if (body.toStatus === 'rejected' && (typeof body.message !== 'string' || body.message.trim().length === 0)) {
      response.status(400).json({ error: 'validation_failed', fields: { message: 'is required when rejecting a report' } });
      return;
    }
    const updated = transitionReport(database, reportId, body.toStatus as Status, body.message as string | undefined);
    if (!updated) {
      response.status(409).json({ error: 'invalid_transition', from: report.status, to: body.toStatus });
      return;
    }
    response.json(updated);
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
      response.status(400).json({ error: 'validation_failed', fields: { body: 'must contain valid JSON' } });
      return;
    }
    console.error(error);
    response.status(500).json({ error: 'internal_error' });
  });

  return app;
}
