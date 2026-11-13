import 'dotenv/config';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import metadataRoutes from './routes/metadata';
import qualityRoutes from './routes/quality';
import toolsRoutes from './routes/tools';
import historyRoutes from './routes/history';
import subscriptionRoutes from './routes/subscription';

const app: Express = express();
const PORT = Number(process.env.PORT || 4000);

const LOCAL_MODE = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
if (LOCAL_MODE) {
  console.log('[yearmedia-api] running in local/demo mode — Supabase keys not set, using in-memory + JSON file store (apps/api/data/).');
} else {
  console.log('[yearmedia-api] supabase connected — Auth + profiles/history/jobs/subscriptions read from Supabase.');
}
if (!process.env.GEMINI_API_KEY) {
  console.log('[yearmedia-api] GEMINI_API_KEY not set — metadata uses the honest filename-only demo fallback.');
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'yearmedia-api',
    mode: LOCAL_MODE ? 'local/demo' : 'supabase',
    aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/subscription', subscriptionRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found', message: 'Route not found.' });
});

// Multer file-size errors and friends -> clean JSON.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'file_too_large', message: 'File exceeds the 50 MB limit.' });
    return;
  }
  console.error('[yearmedia-api] error:', err);
  res.status(500).json({ error: 'internal_error', message: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`[yearmedia-api] listening on http://localhost:${PORT}`);
});

export default app;
