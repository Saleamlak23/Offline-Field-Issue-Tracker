import express from 'express';

export const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', time: new Date().toISOString() });
});
