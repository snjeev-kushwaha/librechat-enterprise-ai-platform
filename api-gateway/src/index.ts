// api-gateway/src/index.ts — Express entry point
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { modelsRouter } from './routes/models.js';
import { conversationsRouter } from './routes/conversations.js';
import { agentsRouter } from './routes/agents.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';

const app = express();
const PORT = Number(process.env.GATEWAY_PORT) || 4000;

// ── Middleware ────────────────────────────────────────────────────
// app.use(cors({
//   origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:80'],
//   credentials: true,
// }));
const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(cors({
  origin: (origin, callback) => {
    // No origin = curl, server-to-server, Postman — allow it
    if (!origin) return callback(null, true);

    // Any localhost/127.0.0.1 port — covers :80, :5173, no-port, etc.
    if (localhostPattern.test(origin)) return callback(null, true);

    // Extra origins from .env (for production domains)
    const extra = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || [];
    if (extra.includes(origin)) return callback(null, true);

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ── Public routes (no auth required) ─────────────────────────────
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  librechat: process.env.LIBRECHAT_URL,
  mcp_tools: process.env.MCP_TOOLS_URL,
  mcp_db: process.env.MCP_DB_URL,
  timestamp: new Date().toISOString(),
}));

app.use('/auth', authRouter);
app.use('/api/auth', authRouter);

// ── Protected routes (JWT required) ──────────────────────────────
app.use('/api', authMiddleware, rateLimitMiddleware);
app.use('/api/chat', chatRouter);
app.use('/api/models', modelsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/agents', agentsRouter);

// ── 404 handler ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Error handler ─────────────────────────────────────────────────
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[Gateway] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 API Gateway running on http://localhost:${PORT}`);
  console.log(`   LibreChat backend : ${process.env.LIBRECHAT_URL}`);
  console.log(`   MCP Tools server  : ${process.env.MCP_TOOLS_URL}`);
  console.log(`   MCP DB server     : ${process.env.MCP_DB_URL}\n`);
});
