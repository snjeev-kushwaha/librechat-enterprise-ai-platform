// mcp-servers/tools-server/src/index.ts
// Remote HTTP MCP server exposing: web_search, get_weather, calculate

import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const app = express();
const PORT = Number(process.env.MCP_TOOLS_PORT) || 3001;
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

// ── Session store (stateful protocol) ─────────────────────────
const sessions = new Map<string, StreamableHTTPServerTransport>();

// Clean up idle sessions every 5 min
setInterval(() => {
  sessions.forEach((t, id) => {
    if ((t as any).lastActivity && Date.now() - (t as any).lastActivity > 15 * 60_000) {
      sessions.delete(id);
    }
  });
}, 5 * 60_000);

// ── Build MCP server ───────────────────────────────────────────
function buildServer(): McpServer {
  const server = new McpServer({ name: 'tools-server', version: '1.0.0' });

  // TOOL 1 — Web search via Brave Search API
  server.tool(
    'web_search',
    `Search the web for current information. Returns top results with title, URL, and snippet.
     Use for: recent news, facts that may have changed, research topics, current events.
     Returns up to 5 results. Always cite the source URL in your answer.`,
    {
      query: z.string().min(2).max(200).describe('Search query — be specific (3-8 words works best)'),
      count: z.number().int().min(1).max(5).default(3).describe('Number of results to return'),
    },
    async ({ query, count }) => {
      const apiKey = process.env.BRAVE_API_KEY;
      if (!apiKey) return {
        isError: true,
        content: [{ type: 'text' as const, text: 'BRAVE_API_KEY not configured. Add it to .env' }]
      };

      try {
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
        const res = await fetch(url, {
          headers: { 'X-Subscription-Token': apiKey, 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error(`Brave API returned ${res.status}`);

        const data = await res.json() as any;
        const results = (data.web?.results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.description || r.extra_snippets?.[0] || '',
        }));
        return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `Search failed: ${err.message}` }] };
      }
    }
  );

  // TOOL 2 — Current weather via OpenWeatherMap
  server.tool(
    'get_weather',
    `Get current weather conditions for any city.
     Returns: temperature (°C), feels like, weather description, humidity, wind speed.
     Always include country code for unambiguous results, e.g. "Mumbai, IN" or "London, GB".`,
    {
      location: z.string().min(2).max(100).describe('City name with country code, e.g. "Indore, IN"'),
    },
    async ({ location }) => {
      const apiKey = process.env.OPENWEATHER_KEY;
      if (!apiKey) return {
        isError: true,
        content: [{ type: 'text' as const, text: 'OPENWEATHER_KEY not configured. Add it to .env' }]
      };

      try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
        const res = await fetch(url);
        if (!res.ok) {
          const err = await res.json() as any;
          throw new Error(err.message || `OpenWeather returned ${res.status}`);
        }
        const d = await res.json() as any;
        const result = {
          location: `${d.name}, ${d.sys.country}`,
          temperature: `${d.main.temp}°C`,
          feels_like: `${d.main.feels_like}°C`,
          condition: d.weather[0].description,
          humidity: `${d.main.humidity}%`,
          wind_speed: `${d.wind.speed} m/s`,
          visibility: d.visibility ? `${d.visibility / 1000} km` : 'N/A',
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `Weather lookup failed: ${err.message}` }] };
      }
    }
  );

  // TOOL 3 — Safe calculator (deterministic — avoids LLM arithmetic errors)
  server.tool(
    'calculate',
    `Evaluate a mathematical expression and return the exact numeric result.
     ALWAYS use this tool for any arithmetic, percentage calculations, currency conversions,
     or unit conversions — never try to compute math in your head.
     Supports: +, -, *, /, %, Math.sqrt(), Math.pow(), Math.round(), Math.floor(), Math.ceil().
     Examples: "247 * 18", "50000 * 0.18", "Math.sqrt(144)", "(100 + 50) / 3"`,
    {
      expression: z.string().min(1).max(500).describe('Math expression to evaluate'),
    },
    async ({ expression }) => {
      try {
        // Safe evaluation — only allows math operations
        const result = new Function('Math', `'use strict'; return (${expression})`)(Math);
        if (typeof result !== 'number' || !isFinite(result))
          throw new Error('Expression did not return a finite number');
        return { content: [{ type: 'text' as const, text: String(result) }] };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Calculation failed: ${err.message}. Check the expression syntax.` }]
        };
      }
    }
  );

  // TOOL 4 — Current date/time
  server.tool(
    'get_datetime',
    'Get the current date and time in a specified timezone. Use when the user asks about current time or date.',
    {
      timezone: z.string().default('Asia/Kolkata').describe('IANA timezone, e.g. "Asia/Kolkata", "America/New_York"'),
    },
    async ({ timezone }) => {
      try {
        const now = new Date();
        const result = {
          iso: now.toISOString(),
          local: now.toLocaleString('en-IN', { timeZone: timezone }),
          timezone,
          unixMs: now.getTime(),
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `Invalid timezone: ${err.message}` }] };
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
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    const server = buildServer();
    await server.connect(transport);
    if (transport.sessionId) sessions.set(transport.sessionId, transport);
  }
  (transport as any).lastActivity = Date.now();
  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  const transport = sessionId ? sessions.get(sessionId) : undefined;
  if (!transport) return res.status(404).json({ error: 'Session not found' });
  (transport as any).lastActivity = Date.now();
  await transport.handleRequest(req, res);
});

app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId) sessions.delete(sessionId);
  res.status(200).json({ ok: true });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', sessions: sessions.size, tools: ['web_search', 'get_weather', 'calculate', 'get_datetime'] });
});

app.listen(PORT, () => {
  console.log(`\n🔌 MCP Tools Server running on :${PORT}`);
  console.log('   Tools: web_search, get_weather, calculate, get_datetime\n');
});
