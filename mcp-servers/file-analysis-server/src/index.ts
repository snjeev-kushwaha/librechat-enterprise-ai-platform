// mcp-servers/file-analysis-server/src/index.ts
// Parses Excel, CSV, PDF files and returns structured data for AI analysis

import 'dotenv/config';
import express       from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z }         from 'zod';
import * as XLSX     from 'xlsx';
import * as fs       from 'fs';
import * as path     from 'path';

const app     = express();
const PORT    = Number(process.env.MCP_FILES_PORT) || 3003;
const SECRET  = process.env.MCP_SHARED_SECRET;
const UPLOADS = process.env.UPLOADS_DIR || '/app/uploads';

app.use(express.json());

app.use((req, res, next) => {
  if (!SECRET) { next(); return; }
  if (req.headers.authorization !== `Bearer ${SECRET}`)
    return res.status(401).json({ error: 'Unauthorized' });
  next();
});

const sessions = new Map<string, StreamableHTTPServerTransport>();
setInterval(() => {
  sessions.forEach((t, id) => {
    if ((t as any).lastActivity && Date.now() - (t as any).lastActivity > 15 * 60_000)
      sessions.delete(id);
  });
}, 5 * 60_000);

// ── Helpers ────────────────────────────────────────────────────
function safeReadFile(filename: string): string {
  // Prevent path traversal attacks
  const safe = path.basename(filename);
  const full  = path.join(UPLOADS, safe);
  if (!fs.existsSync(full)) throw new Error(`File not found: ${safe}`);
  return full;
}

function computeStats(rows: any[], headers: string[]) {
  const stats: Record<string, any> = {};
  for (const col of headers) {
    const vals = rows.map(r => r[col]).filter(v => typeof v === 'number' && !isNaN(v));
    if (vals.length > 0) {
      stats[col] = {
        count: vals.length,
        min:   Math.min(...vals),
        max:   Math.max(...vals),
        sum:   vals.reduce((a, b) => a + b, 0),
        avg:   (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
      };
    }
  }
  return stats;
}

// ── Build MCP Server ───────────────────────────────────────────
function buildServer(): McpServer {
  const server = new McpServer({ name: 'file-analysis-server', version: '1.0.0' });

  // TOOL 1 — List uploaded files
  server.tool(
    'list_uploaded_files',
    `List all files currently in the uploads directory.
     Returns: filename, size, type, modified date.
     Use this first to see what files are available before analyzing them.`,
    {},
    async () => {
      try {
        if (!fs.existsSync(UPLOADS)) return {
          content: [{ type: 'text' as const, text: JSON.stringify({ files: [], message: 'Uploads directory is empty' }) }]
        };
        const files = fs.readdirSync(UPLOADS)
          .filter(f => !f.startsWith('.'))
          .map(f => {
            const stat = fs.statSync(path.join(UPLOADS, f));
            return {
              name:     f,
              sizeKB:   Math.round(stat.size / 1024),
              type:     path.extname(f).toLowerCase(),
              modified: stat.mtime.toISOString().split('T')[0],
            };
          });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ files, count: files.length }, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text' as const, text: err.message }] };
      }
    }
  );

  // TOOL 2 — Parse Excel / CSV
  server.tool(
    'parse_excel',
    `Parse an Excel (.xlsx, .xls) or CSV file and return its contents as structured JSON.
     Returns: sheet names, headers, first 200 rows per sheet, and row counts.
     Use get_file_stats first if you want to check file info before parsing.
     IMPORTANT: For large files (>1000 rows) use summarize_excel instead to avoid token overflow.`,
    {
      filename: z.string().describe('Exact filename from list_uploaded_files, e.g. "Q3_Revenue.xlsx"'),
      max_rows: z.number().int().min(1).max(500).default(200)
                 .describe('Max rows to return per sheet (default 200, max 500)'),
      sheet_name: z.string().optional()
                   .describe('Specific sheet name to parse. Omit to parse all sheets.'),
    },
    async ({ filename, max_rows, sheet_name }) => {
      try {
        const filepath  = safeReadFile(filename);
        const ext       = path.extname(filename).toLowerCase();
        const workbook  = XLSX.readFile(filepath, { cellDates: true, cellNF: false });

        const targetSheets = sheet_name
          ? [sheet_name]
          : workbook.SheetNames;

        const result: any = { filename, sheets: [] };

        for (const name of targetSheets) {
          const sheet = workbook.Sheets[name];
          if (!sheet) continue;

          const rows    = XLSX.utils.sheet_to_json(sheet, { defval: null }) as any[];
          const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
          const preview = rows.slice(0, max_rows);

          result.sheets.push({
            name,
            totalRows: rows.length,
            returnedRows: preview.length,
            headers,
            rows: preview,
            truncated: rows.length > max_rows,
          });
        }

        result.totalSheets = result.sheets.length;
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `Parse error: ${err.message}` }] };
      }
    }
  );

  // TOOL 3 — Summarize Excel (stats only — no raw data)
  server.tool(
    'summarize_excel',
    `Generate statistical summary of an Excel/CSV file WITHOUT returning raw data.
     Returns: row counts, column names, data types, and numeric stats (min/max/avg/sum) per column.
     Use this for large files (>500 rows) where returning all rows would overflow the context window.`,
    {
      filename:   z.string().describe('Exact filename, e.g. "Sales_2025.xlsx"'),
      sheet_name: z.string().optional().describe('Sheet name. Omit for all sheets.'),
    },
    async ({ filename, sheet_name }) => {
      try {
        const filepath = safeReadFile(filename);
        const workbook = XLSX.readFile(filepath, { cellDates: true });
        const targets  = sheet_name ? [sheet_name] : workbook.SheetNames;
        const summary: any = { filename, sheets: [] };

        for (const name of targets) {
          const sheet   = workbook.Sheets[name];
          if (!sheet) continue;
          const rows    = XLSX.utils.sheet_to_json(sheet, { defval: null }) as any[];
          const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
          const stats   = computeStats(rows, headers);

          // Infer column types
          const columnTypes: Record<string, string> = {};
          for (const h of headers) {
            const sample = rows.slice(0, 10).map(r => r[h]).filter(v => v != null);
            if (sample.every(v => typeof v === 'number'))       columnTypes[h] = 'number';
            else if (sample.every(v => v instanceof Date))      columnTypes[h] = 'date';
            else if (sample.some(v => typeof v === 'number'))   columnTypes[h] = 'mixed';
            else                                                 columnTypes[h] = 'text';
          }

          summary.sheets.push({ name, totalRows: rows.length, headers, columnTypes, numericStats: stats });
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `Summary error: ${err.message}` }] };
      }
    }
  );

  // TOOL 4 — Parse PDF
  server.tool(
    'parse_pdf',
    `Extract text content from a PDF file, page by page.
     Returns: full text, page count, and metadata.
     For very large PDFs, use page_start and page_end to extract specific pages.`,
    {
      filename:   z.string().describe('Exact PDF filename, e.g. "Report_Q3.pdf"'),
      page_start: z.number().int().min(1).default(1).describe('Start page (1-indexed)'),
      page_end:   z.number().int().min(1).default(20).describe('End page (max 20 pages per call)'),
    },
    async ({ filename, page_start, page_end }) => {
      try {
        const filepath = safeReadFile(filename);
        if (!filepath.toLowerCase().endsWith('.pdf'))
          throw new Error('File must be a PDF (.pdf extension)');

        // Dynamic import of pdf-parse
        const pdfParse = (await import('pdf-parse')).default;
        const buffer   = fs.readFileSync(filepath);
        const data     = await pdfParse(buffer);

        // Split into pages (pdf-parse gives full text; split by form feed)
        const pages    = data.text.split('\x0C').filter((p: string) => p.trim());
        const selected = pages.slice(page_start - 1, page_end);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              filename,
              totalPages:    pages.length,
              returnedPages: selected.length,
              pageRange:     `${page_start}-${Math.min(page_end, pages.length)}`,
              metadata:      data.info,
              pages:         selected.map((text: string, i: number) => ({
                page: page_start + i,
                text: text.trim().slice(0, 3000), // cap each page at 3000 chars
              })),
            }, null, 2)
          }]
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `PDF error: ${err.message}` }] };
      }
    }
  );

  // TOOL 5 — Get file stats (metadata without content)
  server.tool(
    'get_file_stats',
    `Get metadata about a file without reading its contents.
     Returns: size, type, modified date, and for Excel files: sheet names and row counts.
     Use before parse_excel or parse_pdf to plan your analysis approach.`,
    {
      filename: z.string().describe('Exact filename to inspect'),
    },
    async ({ filename }) => {
      try {
        const filepath = safeReadFile(filename);
        const stat     = fs.statSync(filepath);
        const ext      = path.extname(filename).toLowerCase();
        const result: any = {
          filename,
          sizeKB:   Math.round(stat.size / 1024),
          sizeMB:   (stat.size / (1024 * 1024)).toFixed(2),
          type:     ext,
          modified: stat.mtime.toISOString(),
        };

        if (['.xlsx', '.xls', '.csv'].includes(ext)) {
          const wb = XLSX.readFile(filepath, { sheetStubs: true });
          result.excel = {
            sheets: wb.SheetNames.map(name => {
              const range = XLSX.utils.decode_range(wb.Sheets[name]['!ref'] || 'A1');
              return { name, estimatedRows: range.e.r, estimatedCols: range.e.c + 1 };
            })
          };
        }

        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text' as const, text: err.message }] };
      }
    }
  );

  return server;
}

// ── HTTP handlers ──────────────────────────────────────────────
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport   = sessionId ? sessions.get(sessionId) : undefined;
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

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', sessions: sessions.size, uploadsDir: UPLOADS,
    tools: ['list_uploaded_files', 'parse_excel', 'summarize_excel', 'parse_pdf', 'get_file_stats'] })
);

app.listen(PORT, () => {
  console.log(`\n📊 MCP File Analysis Server running on :${PORT}`);
  console.log(`   Uploads dir: ${UPLOADS}`);
  console.log('   Tools: list_uploaded_files, parse_excel, summarize_excel, parse_pdf, get_file_stats\n');
});
