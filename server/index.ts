import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { apiRouter } from './api';
import './db'; // ensures SQLite database migrations and tables are initialized

export const apiApp = express();

// Security Headers with Helmet
apiApp.use(
  helmet({
    contentSecurityPolicy: false, // Prevents interfering with Vite development scripts/styles in iframe preview
    crossOriginEmbedderPolicy: false,
  })
);

// Restricted CORS
const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  : [];
const allowedOrigins = [...defaultOrigins, ...envOrigins];

apiApp.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-side/test runners)
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.run.app')) {
        callback(null, true);
      } else {
        callback(new Error('Origine non autorisée par la politique CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

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
