import express from 'express';
import { validateReportInput, type ReportInput } from '@field-tracker/shared';
import { createDatabase, type AppDatabase } from './db.js';
import { createReport } from './reports.js';

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
