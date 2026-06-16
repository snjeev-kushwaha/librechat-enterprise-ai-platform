// mcp-servers/db-server/src/index.ts
// Remote HTTP MCP server — read-only SQL access to analytics database

import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const app = express();
const PORT = Number(process.env.MCP_DB_PORT) || 3002;
const SECRET = process.env.MCP_SHARED_SECRET;

app.use(express.json());

// ── Auth guard ─────────────────────────────────────────────────
app.use((req, res, next) => {
  if (!SECRET) { next(); return; }
  const auth = req.headers.authorization;
  // Allow if: no secret configured, no auth header sent (discovery), or correct token
  if (!auth || auth === `Bearer ${SECRET}`) { next(); return; }
  return res.status(403).json({ error: 'Forbidden' });
});

// ── Allowed tables (security whitelist) ───────────────────────
const ALLOWED_TABLES = ['orders', 'products', 'customers', 'analytics_events', 'revenue_summary'];

function isSafeQuery(sql: string): { safe: boolean; reason?: string } {
  const up = sql.trim().toUpperCase();
  const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE'];
  for (const kw of forbidden) {
    if (new RegExp(`\\b${kw}\\b`).test(up)) return { safe: false, reason: `${kw} statements are not allowed` };
  }
  if (!up.startsWith('SELECT') && !up.startsWith('WITH'))
    return { safe: false, reason: 'Only SELECT and WITH (CTE) queries are permitted' };
  return { safe: true };
}

// ── Session store ──────────────────────────────────────────────
const sessions = new Map<string, StreamableHTTPServerTransport>();

setInterval(() => {
  sessions.forEach((t, id) => {
    if ((t as any).lastActivity && Date.now() - (t as any).lastActivity > 15 * 60_000)
      sessions.delete(id);
  });
}, 5 * 60_000);

// ── Build MCP server ───────────────────────────────────────────
function buildServer(): McpServer {
  const server = new McpServer({ name: 'db-server', version: '1.0.0' });

  // Lazy-load pg pool to avoid crash if ANALYTICS_DB_URL not set
  let poolPromise: Promise<any> | null = null;
  const getPool = async () => {
    if (!poolPromise) {
      if (!process.env.ANALYTICS_DB_URL) throw new Error('ANALYTICS_DB_URL not configured in .env');
      const pg = await import('pg');
      const pool = new pg.default.Pool({ connectionString: process.env.ANALYTICS_DB_URL, max: 5 });
      poolPromise = Promise.resolve(pool);
    }
    return poolPromise;
  };

  // TOOL 1 — List available tables
  server.tool(
    'list_tables',
    `List all available database tables with their approximate row counts.
     Use this first to understand what data is available before writing queries.
     Available tables: ${ALLOWED_TABLES.join(', ')}.`,
    {},
    async () => {
      try {
        const pool = await getPool();
        const result = await pool.query(
          `SELECT table_name,
                  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS size
           FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = ANY($1)
           ORDER BY table_name`,
          [ALLOWED_TABLES]
        );
        return { content: [{ type: 'text' as const, text: JSON.stringify(result.rows, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `DB error: ${err.message}` }] };
      }
    }
  );

  // TOOL 2 — Get table schema
  server.tool(
    'get_schema',
    `Get the column names, data types, and constraints for a specific database table.
     ALWAYS call this before writing a query to ensure you use correct column names.
     Available tables: ${ALLOWED_TABLES.join(', ')}.`,
    {
      table: z.enum(ALLOWED_TABLES as [string, ...string[]]).describe('Table name to inspect'),
    },
    async ({ table }) => {
      try {
        const pool = await getPool();
        const result = await pool.query(
          `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_name = $1 AND table_schema = 'public'
           ORDER BY ordinal_position`,
          [table]
        );
        return { content: [{ type: 'text' as const, text: JSON.stringify(result.rows, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `Schema error: ${err.message}` }] };
      }
    }
  );

  // TOOL 3 — Execute read-only SQL query
  server.tool(
    'query_database',
    `Execute a read-only SQL SELECT query on the analytics database.
     Returns results as a JSON array (max 200 rows).
     IMPORTANT rules:
     - Always call get_schema first to check column names
     - Always include a LIMIT clause (max 200)
     - Only SELECT and WITH (CTE) statements are allowed
     - Available tables: ${ALLOWED_TABLES.join(', ')}`,
    {
      sql: z.string().min(10).describe('SQL SELECT or WITH query to execute'),
      limit: z.number().int().min(1).max(200).default(50).describe('Maximum rows to return'),
    },
    async ({ sql, limit }) => {
      const check = isSafeQuery(sql);
      if (!check.safe) return {
        isError: true,
        content: [{ type: 'text' as const, text: `Query rejected: ${check.reason}` }]
      };

      const safeSql = /\bLIMIT\b/i.test(sql) ? sql : `${sql.trimEnd()} LIMIT ${limit}`;

      try {
        const pool = await getPool();
        const start = Date.now();
        const result = await pool.query(safeSql);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              rows: result.rows,
              rowCount: result.rowCount,
              columns: result.fields.map((f: any) => f.name),
              executionMs: Date.now() - start,
            }, null, 2)
          }]
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `Query error: ${err.message}` }] };
      }
    }
  );

  return server;
}

// ── HTTP handlers ──────────────────────────────────────────────
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport = sessionId ? sessions.get(sessionId) : undefined;
  if (!transport) {
    transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
    await buildServer().connect(transport);
    if (transport.sessionId) sessions.set(transport.sessionId, transport);
  }
  (transport as any).lastActivity = Date.now();
  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req, res) => {
  const t = sessions.get(req.headers['mcp-session-id'] as string);
  if (!t) return res.status(404).json({ error: 'Session not found' });
  (t as any).lastActivity = Date.now();
  await t.handleRequest(req, res);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', sessions: sessions.size, tools: ['list_tables', 'get_schema', 'query_database'] });
});

app.listen(PORT, () => {
  console.log(`\n🗄️  MCP DB Server running on :${PORT}`);
  console.log('   Tools: list_tables, get_schema, query_database\n');
});
