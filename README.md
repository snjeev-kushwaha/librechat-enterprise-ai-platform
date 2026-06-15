# 🤖 AI Platform — LibreChat + MCP + React + Node.js

A production-ready, full-stack AI chat platform that integrates **LibreChat** as the AI engine, a custom **Node.js API Gateway** for LLM routing, a **React frontend** with model switching, and **custom MCP servers** for tool integrations.

---

## 🗺️ Architecture Overview

```
React App (port 5173/80)
    │  REST + SSE
    ▼
Node.js API Gateway (port 4000)   ← your custom backend
    │  JWT auth · LLM routing · rate limiting
    ▼
LibreChat Backend (port 3080)     ← AI engine (open-source)
    │  MCP Protocol          │  LLM API calls
    ▼                         ▼
MCP Servers              AI Providers
  :3001 tools-server       OpenAI (GPT-4o)
  :3002 db-server          Anthropic (Claude)
                           Google (Gemini)
                           Ollama (local / free)

Databases (internal)
  MongoDB    :27017  → users, conversations, messages
  PostgreSQL :5432   → RAG vector embeddings (pgvector)
  MeiliSearch:7700   → full-text conversation search
  Redis      :6379   → caching, rate limiting
```

---

## 📁 Project Structure

```
ai-platform/
├── docker-compose.yml          ← orchestrates all services
├── .env.example                ← copy → .env, fill in keys
├── package.json                ← root scripts
├── scripts/
│   └── gen-secrets.js          ← auto-generates all secret keys
├── LibreChat-config/
│   └── librechat.yaml          ← LibreChat endpoints + MCP config
├── api-gateway/                ← Node.js Express backend
│   └── src/
│       ├── index.ts            ← entry point
│       ├── routes/             ← auth, chat, models, conversations
│       ├── middleware/         ← JWT auth, rate limiting
│       └── services/           ← llmRouter, librechatClient
├── react-app/                  ← Vite + React frontend
│   └── src/
│       ├── App.tsx             ← root component
│       ├── components/         ← Chat, ModelSwitcher, Sidebar, Login
│       ├── hooks/              ← useChat, useModels, useAuth
│       └── api/client.ts       ← axios instance
└── mcp-servers/
    ├── tools-server/           ← web_search, weather, calculator
    └── db-server/              ← SQL query tools
```

---

## ⚡ Quick Start (5 steps)

### Prerequisites
- Docker + Docker Compose v2
- Node.js 20+
- At least one AI provider API key (OpenAI / Anthropic / Google)

---

### Step 1 — Clone LibreChat into the project

```bash
git clone https://github.com/YOUR_USERNAME/ai-platform.git
cd ai-platform

# Clone LibreChat into the LibreChat/ subdirectory
git clone https://github.com/danny-avila/LibreChat.git LibreChat
```

---

### Step 2 — Set up environment variables

```bash
# Copy the template
cp .env.example .env

# Auto-generate all secret keys
node scripts/gen-secrets.js

# Now edit .env and add your API keys:
nano .env
```

**Required API keys to add in `.env`:**
```env
OPENAI_API_KEY=sk-...          # OpenAI (optional but recommended)
ANTHROPIC_API_KEY=sk-ant-...   # Anthropic Claude (optional)
GOOGLE_KEY=AIza...             # Google Gemini (optional)
```

**For MCP tools (optional but cool):**
```env
BRAVE_API_KEY=BSA_...          # Get free key at search.brave.com/login
OPENWEATHER_KEY=...            # Get free key at openweathermap.org/api
```

---

### Step 3 — Install Node.js dependencies

```bash
# Install all service dependencies
npm run install:all
```

---

### Step 4 — Start all services

```bash
# Start everything with Docker (first run takes ~4 minutes to pull images)
npm run docker:up

# Watch startup logs
docker compose logs -f librechat

# Check all services are healthy
docker compose ps
```

Expected output when ready:
```
ai-platform-librechat    Up    0.0.0.0:3080->3080/tcp
ai-platform-mongodb      Up    27017/tcp
ai-platform-meili        Up    7700/tcp
ai-platform-pgvector     Up    5432/tcp
ai-platform-rag          Up    8000/tcp
ai-platform-redis        Up    6379/tcp
ai-platform-gateway      Up    0.0.0.0:4000->4000/tcp
ai-platform-mcp-tools    Up    0.0.0.0:3001->3001/tcp
ai-platform-mcp-db       Up    0.0.0.0:3002->3002/tcp
ai-platform-react        Up    0.0.0.0:80->80/tcp
```

---

### Step 5 — Create admin account + start using it

```bash
# 1. Open LibreChat and create your admin account
open http://localhost:3080

# 2. After creating your account, DISABLE public registration:
#    Edit .env → set ALLOW_REGISTRATION=false
#    Then restart the LibreChat service:
docker compose restart librechat

# 3. Open the React app
open http://localhost:5173   # dev mode (if running locally)
# OR
open http://localhost:80     # production Docker mode
```

---

## 🔧 Development Mode (without Docker)

Run each service locally for faster development iteration:

### Terminal 1 — Start Docker infrastructure only
```bash
# Only start the databases (MongoDB, MeiliSearch, PostgreSQL, Redis)
docker compose up -d mongodb meilisearch vectordb rag_api redis librechat
```

### Terminal 2 — API Gateway
```bash
cd api-gateway
npm run dev
# Runs on http://localhost:4000 with hot reload
```

### Terminal 3 — React App
```bash
cd react-app
npm run dev
# Runs on http://localhost:5173 with hot reload
```

### Terminal 4 — MCP Tools Server
```bash
cd mcp-servers/tools-server
npm run dev
# Runs on http://localhost:3001
```

### Terminal 5 — MCP DB Server
```bash
cd mcp-servers/db-server
npm run dev
# Runs on http://localhost:3002
```

### Or run everything at once:
```bash
# From project root (requires the Docker services above to be running)
npm run dev
```

---

## 🔀 How LLM Switching Works

The `api-gateway/src/services/llmRouter.ts` file is the brain of model switching:

```
User selects model in React UI
       ↓
POST /api/chat { model: "claude-sonnet-4-20250514", text: "..." }
       ↓
Gateway → resolveEndpoint("claude-sonnet-4-20250514")
       ↓ returns "anthropic"
Gateway → POST LibreChat /api/ask/anthropic { model, text, ... }
       ↓
LibreChat → Anthropic API (Claude)
       ↓
SSE stream piped back → Gateway → React (real-time tokens)
```

**Model → Endpoint mapping:**
| Model | Provider | Endpoint |
|-------|----------|----------|
| gpt-4o, gpt-4o-mini, o3-mini | OpenAI | `openAI` |
| claude-opus-4, claude-sonnet-4, claude-haiku | Anthropic | `anthropic` |
| gemini-2.5-pro, gemini-2.0-flash | Google | `google` |
| llama3.2, mistral | Ollama (local) | `custom` |

To add a new model, add an entry to `MODEL_REGISTRY` in `llmRouter.ts`.

---

## 🔌 How MCP Integration Works

```
LibreChat starts → MCPManager reads librechat.yaml
       ↓
Connects to tools-server (:3001) via SSE HTTP
Connects to db-server    (:3002) via SSE HTTP
Connects to filesystem           via stdio
       ↓
Tools appear in Agent Builder UI
       ↓
User creates an Agent, assigns tools to it
       ↓
User sends message → Agent LLM decides to call a tool
       ↓
LibreChat → MCP Client → HTTP POST /mcp on tools-server
       ↓
JSON-RPC: tools/call { name: "web_search", arguments: { query: "..." } }
       ↓
Tool executes → result injected back into LLM context
       ↓
LLM generates grounded response → streams to user
```

**Available MCP tools out of the box:**
| Tool | Server | What it does |
|------|--------|-------------|
| `web_search` | tools-server | Search web via Brave API |
| `get_weather` | tools-server | Current weather by city |
| `calculate` | tools-server | Safe arithmetic evaluation |
| `get_datetime` | tools-server | Current date/time by timezone |
| `list_tables` | db-server | List available DB tables |
| `get_schema` | db-server | Get table column info |
| `query_database` | db-server | Run read-only SQL queries |

---

## 🔐 Security Setup

### 1. Never commit secrets
Your `.env` file is in `.gitignore`. Never commit it. Use `cp .env.example .env`.

### 2. After creating admin account
```env
# .env
ALLOW_REGISTRATION=false
```

### 3. For production — set real domains
```env
DOMAIN_CLIENT=https://chat.yourdomain.com
DOMAIN_SERVER=https://chat.yourdomain.com
```

### 4. MCP server secrets
All MCP servers are protected by `MCP_SHARED_SECRET`. This is set automatically by `gen-secrets.js`.

### 5. DB server whitelist
The db-server only allows queries on explicitly whitelisted tables. Edit `ALLOWED_TABLES` in `mcp-servers/db-server/src/index.ts` to match your tables.

---

## ⚙️ Adding a New AI Provider

1. Get the API key for the provider
2. Add it to `.env`
3. Add it to `librechat.yaml` under `endpoints:`
4. Add it to `MODEL_REGISTRY` in `api-gateway/src/services/llmRouter.ts`
5. Restart: `docker compose restart librechat api-gateway`

---

## 🔌 Adding a New MCP Server

1. Create a new folder under `mcp-servers/`
2. Copy the `tools-server` structure as a template
3. Define your tools using `server.tool(...)`
4. Add it to `docker-compose.yml` as a new service
5. Add it to `LibreChat-config/librechat.yaml` under `mcpServers:`
6. Restart: `docker compose up -d --build`

---

## 📊 Health Checks

```bash
# Check all services at once
npm run health

# Individual service health
curl http://localhost:3080/api/health    # LibreChat
curl http://localhost:4000/health       # API Gateway
curl http://localhost:3001/health       # MCP Tools Server
curl http://localhost:3002/health       # MCP DB Server

# View all logs
npm run docker:logs

# View specific service logs
docker compose logs -f api-gateway
docker compose logs -f librechat | grep -i mcp
```

---

## 🔄 Updating

```bash
# Update LibreChat to latest
cd LibreChat && git pull && cd ..

# Rebuild containers
npm run docker:rebuild
```

---

## 🛑 Stopping Everything

```bash
# Stop all containers (keeps data)
npm run docker:down

# Stop and DELETE all data (fresh start)
npm run docker:clean
```

---

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Test LLM router logic
cd api-gateway && npm test

# Test React components
cd react-app && npm test
```

---

## 📂 Port Reference

| Service | Port | URL |
|---------|------|-----|
| React App (prod) | 80 | http://localhost |
| React App (dev) | 5173 | http://localhost:5173 |
| API Gateway | 4000 | http://localhost:4000 |
| LibreChat | 3080 | http://localhost:3080 |
| MCP Tools Server | 3001 | http://localhost:3001/health |
| MCP DB Server | 3002 | http://localhost:3002/health |
| MongoDB | 27017 | internal only |
| PostgreSQL | 5432 | internal only |
| MeiliSearch | 7700 | internal only |
| Redis | 6379 | internal only |

---

## 🔧 Common Issues & Fixes

### "MongoDB connection refused"
```bash
docker compose restart api-gateway librechat
# MongoDB takes longer to start — the API retries automatically
```

### "MCP server not showing tools in Agent Builder"
```bash
# Check MCP connection logs
docker compose logs librechat | grep -i mcp

# Validate your librechat.yaml YAML syntax
python3 -c "import yaml; yaml.safe_load(open('LibreChat-config/librechat.yaml'))" && echo "YAML OK"
```

### "React app shows login but login fails"
```bash
# Ensure the gateway is running and ALLOW_REGISTRATION=true
curl http://localhost:4000/health
# Check that LibreChat itself is healthy too
curl http://localhost:3080/api/health
```

### "SSE stream cuts off after 60 seconds"
This is an Nginx timeout issue. In `react-app/nginx.conf`, ensure:
```nginx
proxy_read_timeout 3600s;
proxy_buffering off;
```

---

## 🏗️ Production Deployment

For deploying to a VPS (Ubuntu 22.04/24.04):

```bash
# 1. Clone on your server
git clone https://github.com/YOUR_USERNAME/ai-platform.git
cd ai-platform && git clone https://github.com/danny-avila/LibreChat.git LibreChat

# 2. Set up .env with production values
cp .env.example .env
node scripts/gen-secrets.js
nano .env  # add API keys, set DOMAIN_CLIENT to your real domain

# 3. Start everything
docker compose up -d

# 4. Set up SSL with Certbot (Nginx on host)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d chat.yourdomain.com

# 5. Set ALLOW_REGISTRATION=false after creating admin account
```

---

## 💡 Interview Talking Points

**"How does LLM switching work in your system?"**
> "The React ModelSwitcher calls `GET /api/models` on the Gateway, which returns a registry of all models grouped by provider with context window and cost info. When the user selects a model and sends a message, the Gateway's `llmRouter.ts` maps the model ID to a LibreChat endpoint — `'anthropic'` for Claude, `'openAI'` for GPT, `'google'` for Gemini. The request is proxied to LibreChat's `/api/ask/{endpoint}` and the SSE stream is piped directly back to React."

**"How do MCP tools work?"**
> "LibreChat's MCPManager reads `librechat.yaml` on startup and connects to each MCP server via HTTP SSE. When a user sends a message to an agent, the LLM sees the tool definitions and decides autonomously whether to call a tool. LibreChat handles the JSON-RPC handshake — `tools/list` to discover, `tools/call` to invoke. The tool result comes back and gets injected into the LLM's context for the final response."

**"Why did you build a custom API Gateway instead of using LibreChat directly?"**
> "Two reasons: First, security — the Gateway enforces our own JWT auth and rate limiting before any request reaches LibreChat. The React app never talks to LibreChat directly. Second, abstraction — the Gateway's LLM router gives us one place to control model availability, costs, and routing logic. If we swap LibreChat for a different backend, the React app doesn't change at all."

---

## 📝 License

MIT — free to use, modify, and distribute.

---

Built with ❤️ using LibreChat, MCP, React, Node.js, and Docker.

copy librechat.yaml LibreChat-config\librechat.yaml
docker compose restart librechat
docker compose logs --tail 50 librechat