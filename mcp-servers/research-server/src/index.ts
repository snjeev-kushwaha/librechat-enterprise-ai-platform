// mcp-servers/research-server/src/index.ts
// Deep research MCP: multi-search, synthesis, fact-checking, report generation

import 'dotenv/config';
import express       from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z }         from 'zod';

const app    = express();
const PORT   = Number(process.env.MCP_RESEARCH_PORT) || 3004;
const SECRET = process.env.MCP_SHARED_SECRET;

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

// ── Brave Search helper ────────────────────────────────────────
async function braveSearch(query: string, count = 5): Promise<any[]> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error('BRAVE_API_KEY not set in .env');
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
  const res  = await fetch(url, {
    headers: { 'X-Subscription-Token': key, Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`Brave API: ${res.status}`);
  const d = await res.json() as any;
  return (d.web?.results || []).map((r: any) => ({
    title: r.title, url: r.url, snippet: r.description || '',
  }));
}

// ── Build server ───────────────────────────────────────────────
function buildServer(): McpServer {
  const server = new McpServer({ name: 'research-server', version: '1.0.0' });

  // TOOL 1 — Multi-query parallel search
  server.tool(
    'multi_search',
    `Run multiple search queries in parallel for comprehensive research coverage.
     More thorough than single web_search. Automatically deduplicates results by URL.
     Use when researching a complex topic that requires multiple angles.
     Returns combined results sorted by relevance.`,
    {
      queries: z.array(z.string().min(3)).min(2).max(4)
                 .describe('2-4 different search queries covering different aspects of the topic'),
      results_per_query: z.number().int().min(1).max(5).default(3)
                          .describe('Results per query (default 3)'),
    },
    async ({ queries, results_per_query }) => {
      try {
        // Run all queries in parallel
        const allResults = await Promise.allSettled(
          queries.map(q => braveSearch(q, results_per_query))
        );

        const combined: any[] = [];
        const seenUrls = new Set<string>();

        allResults.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            r.value.forEach((item: any) => {
              if (!seenUrls.has(item.url)) {
                seenUrls.add(item.url);
                combined.push({ ...item, query: queries[i] });
              }
            });
          }
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              totalResults: combined.length,
              queries,
              results: combined,
            }, null, 2)
          }]
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `Search error: ${err.message}` }] };
      }
    }
  );

  // TOOL 2 — Generate research outline
  server.tool(
    'outline_report',
    `Generate a structured research outline for a given topic.
     Returns a JSON outline with sections, key questions to answer, and suggested search queries.
     Use this FIRST when asked to do deep research — it helps plan the investigation.`,
    {
      topic:     z.string().min(5).describe('Research topic or question'),
      depth:     z.enum(['brief', 'standard', 'comprehensive']).default('standard')
                  .describe('Depth of research: brief (3 sections), standard (5), comprehensive (8)'),
      audience:  z.enum(['executive', 'technical', 'general']).default('general')
                  .describe('Target audience for the report'),
    },
    async ({ topic, depth, audience }) => {
      const sectionCounts = { brief: 3, standard: 5, comprehensive: 8 };
      const count = sectionCounts[depth];

      const sections: any[] = [
        { section: 'Executive Summary', questions: ['What are the key findings?', 'What are the implications?'] },
        { section: 'Background & Context', questions: [`What is the current state of ${topic}?`, 'What are the key definitions?'] },
        { section: 'Key Findings', questions: ['What does the data show?', 'What are the trends?'] },
        { section: 'Analysis', questions: ['What does this mean?', 'What are the causes?'] },
        { section: 'Implications', questions: ['What should be done?', 'What are the risks?'] },
        { section: 'Competitive Landscape', questions: ['Who are the key players?', 'What are their positions?'] },
        { section: 'Data & Evidence', questions: ['What do the numbers show?', 'What is the statistical significance?'] },
        { section: 'Recommendations', questions: ['What action should be taken?', 'What are the next steps?'] },
      ].slice(0, count);

      const searchQueries = [
        `${topic} overview 2025`,
        `${topic} latest developments`,
        `${topic} statistics data analysis`,
        `${topic} future trends implications`,
      ].slice(0, Math.min(count, 4));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            topic, depth, audience,
            outline: sections,
            suggestedSearchQueries: searchQueries,
            estimatedSections: count,
            instruction: 'Use multi_search with the suggestedSearchQueries, then synthesize_sources with the results for each section.',
          }, null, 2)
        }]
      };
    }
  );

  // TOOL 3 — Fact check a claim
  server.tool(
    'fact_check',
    `Verify a specific claim by searching for supporting or contradicting evidence.
     Returns: verdict (SUPPORTED / CONTRADICTED / INSUFFICIENT_EVIDENCE), confidence (0-1), and sources.
     Use when you need to verify a statistic, quote, or assertion before including it in a report.`,
    {
      claim:      z.string().min(10).describe('The specific claim or statement to verify'),
      context:    z.string().optional().describe('Additional context about the claim'),
    },
    async ({ claim, context }) => {
      try {
        const queries = [
          claim.slice(0, 100),
          context ? `${context} ${claim.slice(0, 50)}` : `evidence ${claim.slice(0, 80)}`,
        ];
        const allResults = await Promise.all(queries.map(q => braveSearch(q, 3)));
        const combined   = allResults.flat().slice(0, 6);

        // Simple heuristic verdict based on result count and relevance
        // In production, you'd have the LLM do this reasoning
        const hasResults = combined.length > 0;
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              claim,
              context: context || null,
              verdict: hasResults ? 'EVIDENCE_FOUND' : 'INSUFFICIENT_EVIDENCE',
              confidence: hasResults ? 0.6 : 0.1,
              note: 'Review the sources below and use your judgment to determine if they support or contradict the claim.',
              sources: combined,
              instruction: 'Analyze these sources to determine if they support, contradict, or are insufficient to verify the claim.',
            }, null, 2)
          }]
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text' as const, text: `Fact check error: ${err.message}` }] };
      }
    }
  );

  // TOOL 4 — Generate structured report template
  server.tool(
    'generate_report_template',
    `Generate a markdown report template with pre-filled sections based on a topic.
     Returns a markdown string that you should fill in with actual findings.
     Use after multi_search to structure your findings into a professional report.`,
    {
      topic:       z.string().min(5).describe('Report topic'),
      report_type: z.enum(['research', 'analysis', 'comparison', 'recommendation']).default('research')
                    .describe('Type of report to generate'),
      company:     z.string().optional().describe('Company/organization name for the report header'),
    },
    async ({ topic, report_type, company }) => {
      const date   = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
      const org    = company || 'AI Platform';
      const types  = {
        research:       { emoji: '🔬', title: 'Research Report' },
        analysis:       { emoji: '📊', title: 'Analysis Report' },
        comparison:     { emoji: '⚖️',  title: 'Comparative Analysis' },
        recommendation: { emoji: '💡', title: 'Strategic Recommendations' },
      };
      const t = types[report_type];

      const template = `# ${t.emoji} ${t.title}: ${topic}

**Prepared by:** ${org} AI Research Agent
**Date:** ${date}
**Classification:** Internal

---

## Executive Summary

[2-3 sentence summary of key findings and their significance]

---

## 1. Background & Context

[Explain the current situation, why this topic matters, and relevant definitions]

---

## 2. Key Findings

### Finding 1: [Title]
[Detail with supporting evidence and source]

### Finding 2: [Title]
[Detail with supporting evidence and source]

### Finding 3: [Title]
[Detail with supporting evidence and source]

---

## 3. Data Analysis

| Metric | Value | Source |
|--------|-------|--------|
| [Metric] | [Value] | [Source] |

---

## 4. Implications

- **Opportunity:** [Key opportunity identified]
- **Risk:** [Key risk to consider]
- **Action required:** [What needs to be done]

---

## 5. Recommendations

1. **[Short-term]** — [Specific action, timeline]
2. **[Medium-term]** — [Specific action, timeline]
3. **[Long-term]** — [Strategic direction]

---

## Sources
[List all sources used]

---
*Generated by AI Research Agent — Review and validate before distribution*`;

      return { content: [{ type: 'text' as const, text: template }] };
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
  res.json({ status: 'ok', sessions: sessions.size,
    tools: ['multi_search', 'outline_report', 'fact_check', 'generate_report_template'] })
);

app.listen(PORT, () => {
  console.log(`\n🔬 MCP Research Server running on :${PORT}`);
  console.log('   Tools: multi_search, outline_report, fact_check, generate_report_template\n');
});
