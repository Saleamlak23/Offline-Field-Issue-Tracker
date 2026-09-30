import { createApp } from './app.js';
import { createDatabase } from './db.js';

const port = Number(process.env.PORT ?? 3000);

const app = createApp(createDatabase());

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
