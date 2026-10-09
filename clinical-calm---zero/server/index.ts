import express from 'express';
import { apiRouter } from './api';
import './db'; // ensures DB is initialized and seeded

export const apiApp = express();
apiApp.use(express.json());
apiApp.use('/api', apiRouter);

// Standalone mode support (e.g. node / tsx server/index.ts)
const isMain = process.argv[1]?.includes('server');
if (isMain) {
  const PORT = process.env.PORT || 3001;
  apiApp.listen(PORT, () => {
    console.log(`[Clinical Calm SQLite API] Server running on port ${PORT}`);
  });
}
