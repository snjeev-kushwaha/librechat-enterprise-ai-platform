# How to Apply This Patch

This patch adds 5 new capabilities to your existing ai-platform project:
- 🦙 Ollama (FREE local LLMs)
- 📊 Excel + PDF file analysis
- 🔬 Deep research agent
- 🗂️ Project workspace configuration
- 🤖 Multi-step agents

## Step 1 — Copy patch files into your project

```bash
# Assuming ai-platform/ and ai-platform-patch/ are in the same folder
cp -r ai-platform-patch/. ai-platform/
```

This will:
- Overwrite docker-compose.yml (adds Ollama + 2 new MCP servers)
- Overwrite LibreChat-config/librechat.yaml (adds Ollama endpoint + new agents)
- Overwrite api-gateway/src/services/llmRouter.ts (adds Ollama models)
- Overwrite .env.example (adds new variables)
- ADD mcp-servers/file-analysis-server/ (new)
- ADD mcp-servers/research-server/ (new)
- ADD scripts/setup-ollama.sh (new)

## Step 2 — Update your .env with new variables

```bash
cd ai-platform

# Add these lines to your .env (they're in .env.example as well)
echo "OLLAMA_BASE_URL=http://ollama:11434"  >> .env
echo "MCP_FILES_PORT=3003"                  >> .env
echo "MCP_RESEARCH_PORT=3004"               >> .env
echo "UPLOADS_DIR=/app/uploads"             >> .env
```

## Step 3 — Install new dependencies

```bash
cd mcp-servers/file-analysis-server && npm install && cd ../..
cd mcp-servers/research-server      && npm install && cd ../..
```

## Step 4 — Rebuild and restart

```bash
# From ai-platform root:
docker compose down
docker compose up -d --build
```

## Step 5 — Pull Ollama models (FREE!)

```bash
./scripts/setup-ollama.sh
# OR manually:
docker exec ai-platform-ollama ollama pull llama3.2
docker exec ai-platform-ollama ollama pull gemma2:2b
docker exec ai-platform-ollama ollama pull nomic-embed-text
```

## Step 6 — Verify everything is up

```bash
docker compose ps
# All these should show "Up":
# ai-platform-ollama
# ai-platform-mcp-files  (:3003)
# ai-platform-mcp-research (:3004)

# Health checks:
curl http://localhost:11434/api/tags          # Ollama models list
curl http://localhost:3003/health             # File analysis MCP
curl http://localhost:3004/health             # Research MCP
```

## Step 7 — Set up agents in LibreChat UI

Go to http://localhost:3080 → Agents → Create Agent:

### Agent 1: Data Analyst
- Model: claude-sonnet-4 or llama3.2 (free)
- Tools: parse_excel, summarize_excel, query_database, calculate
- System prompt: "You are a data analyst. Always use parse_excel to read files before analyzing them. Use summarize_excel for large files. Present findings with clear numbers and insights."

### Agent 2: Research Analyst
- Model: claude-sonnet-4 or llama3.2 (free)
- Tools: multi_search, outline_report, fact_check, generate_report_template
- System prompt: "You are a research analyst. Always start with outline_report to plan your research. Use multi_search for comprehensive coverage. Generate structured reports using generate_report_template."

### Agent 3: Document Reviewer
- Model: Any
- Tools: parse_pdf, list_uploaded_files, get_file_stats
- System prompt: "You are a document analyst. Use list_uploaded_files to see available documents. Use get_file_stats before parsing large PDFs. Always cite page numbers in your analysis."

### Agent 4: Business Intelligence Agent
- Model: claude-opus-4 or claude-sonnet-4
- Tools: ALL tools from all MCP servers
- System prompt: "You are a business intelligence analyst. For complex questions, break them into sub-tasks: first gather internal data (parse_excel, query_database), then research market context (multi_search), then synthesize everything into a structured report (generate_report_template)."

## Optional: Switch to FREE Ollama embeddings

```bash
# Edit .env - comment out OpenAI and uncomment Ollama:
# EMBEDDINGS_PROVIDER=ollama
# EMBEDDINGS_MODEL=nomic-embed-text
# OLLAMA_BASE_URL=http://ollama:11434

docker compose restart rag_api
# Now RAG is 100% free with no OpenAI cost
```

## Port Reference (updated)

| Service              | Port | Cost  |
|----------------------|------|-------|
| React App            | 80   | Free  |
| API Gateway          | 4000 | Free  |
| LibreChat            | 3080 | Free  |
| MCP Tools Server     | 3001 | Free* |
| MCP DB Server        | 3002 | Free  |
| MCP File Analysis    | 3003 | Free  |  ← NEW
| MCP Research Server  | 3004 | Free* |  ← NEW
| Ollama               | 11434| FREE  |  ← NEW
| MongoDB              | 27017| Free  |
| PostgreSQL           | 5432 | Free  |
| MeiliSearch          | 7700 | Free  |
| Redis                | 6379 | Free  |

*Brave Search API has a free tier (2000 searches/month)
