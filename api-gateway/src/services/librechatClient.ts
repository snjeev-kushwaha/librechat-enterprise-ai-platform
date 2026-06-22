// api-gateway/src/services/librechatClient.ts
// Typed HTTP client for LibreChat's internal API

import axios, { type AxiosInstance } from 'axios';
import { createClient } from 'redis';

const BASE_URL = process.env.LIBRECHAT_URL || 'http://librechat:3080';

// Redis for storing per-user LibreChat tokens
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
    redisClient.on('error', (e: Error) => console.error('[Redis]', e.message));
    await redisClient.connect();
  }
  return redisClient;
}

// Create an axios instance for LibreChat admin calls
function adminClient(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      // LibreChat's uaParser middleware blocks non-browser User-Agents
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    timeout: 120_000,
  });
}

// ── Auth: Get/refresh LibreChat token for a user ──────────────────
export async function getLibreChatToken(userId: string): Promise<string | null> {
  try {
    const redis = await getRedis();
    return await redis.get(`lc_token:${userId}`);
  } catch {
    return null;
  }
}

export async function setLibreChatToken(userId: string, token: string): Promise<void> {
  try {
    const redis = await getRedis();
    // LibreChat access tokens are short-lived (15 min default).
    // Store with a 14-minute TTL so Redis expiry matches token expiry.
    await redis.setEx(`lc_token:${userId}`, 60 * 14, token);
  } catch (e: any) {
    console.error('[Redis] Failed to store LC token:', e.message);
  }
}

export async function setLibreChatRefreshToken(userId: string, refreshToken: string): Promise<void> {
  try {
    const redis = await getRedis();
    // Refresh tokens are longer-lived (typically 7 days in LibreChat)
    await redis.setEx(`lc_refresh:${userId}`, 3600 * 24 * 7, refreshToken);
  } catch (e: any) {
    console.error('[Redis] Failed to store LC refresh token:', e.message);
  }
}

export async function getLibreChatRefreshToken(userId: string): Promise<string | null> {
  try {
    const redis = await getRedis();
    return await redis.get(`lc_refresh:${userId}`);
  } catch {
    return null;
  }
}

/**
 * Try to get a valid LC access token for the user.
 * If the stored token is expired/missing, use the refresh token to get a new one.
 * Returns null if both are missing/expired (user must re-login).
 */
export async function getValidLcToken(userId: string): Promise<string | null> {
  // Try stored access token first
  const token = await getLibreChatToken(userId);
  if (token) return token;

  // Access token expired — attempt refresh
  const refreshToken = await getLibreChatRefreshToken(userId);
  if (!refreshToken) {
    console.warn(`[Auth] No refresh token for user ${userId} — re-login required`);
    return null;
  }

  try {
    console.log(`[Auth] Access token expired for user ${userId}, refreshing...`);
    const res = await adminClient().post(
      '/api/auth/refresh',
      {},
      { headers: { Cookie: `refreshToken=${refreshToken}` } }
    );
    const newToken: string = res.data?.token;

    if (!newToken) throw new Error('No token in refresh response');

    await setLibreChatToken(userId, newToken);

    // LibreChat returns the new refresh token via Set-Cookie, not in the body.
    // Capture it from the response headers so we can use it next time.
    const setCookie: string | string[] | undefined = res.headers['set-cookie'];
    if (setCookie) {
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      for (const c of cookies) {
        const match = c.match(/^refreshToken=([^;]+)/);
        if (match) {
          await setLibreChatRefreshToken(userId, match[1]);
          break;
        }
      }
    }

    console.log(`[Auth] Token refreshed successfully for user ${userId}`);
    return newToken;
  } catch (e: any) {
    console.error(`[Auth] Token refresh failed for user ${userId}:`, e.response?.data || e.message);
    return null;
  }
}

// ── Authentication ────────────────────────────────────────────────
export async function loginToLibreChat(email: string, password: string) {
  const res = await adminClient().post('/api/auth/login', { email, password });

  // LibreChat sets refreshToken as an HttpOnly cookie in Set-Cookie header
  const setCookie: string | string[] | undefined = res.headers['set-cookie'];
  let refreshToken: string | undefined;
  if (setCookie) {
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const c of cookies) {
      const match = c.match(/^refreshToken=([^;]+)/);
      if (match) { refreshToken = match[1]; break; }
    }
  }

  return {
    user: res.data.user as { id: string; email: string; role: string },
    token: res.data.token as string,
    refreshToken,
  };
}

export async function registerInLibreChat(data: {
  name: string; email: string; password: string; confirm_password: string;
}) {
  const res = await adminClient().post('/api/auth/register', data);
  return res.data;
}

// ── Chat: Stream completion ───────────────────────────────────────
export async function streamChat(params: {
  userId: string;
  lcToken: string;
  text: string;
  model: string;
  endpoint: string;
  conversationId: string;
  agentId?: string;
}) {
  const { userId, lcToken, text, model, endpoint, conversationId, agentId } = params;

  const body: Record<string, unknown> = {
    text,
    model,
    endpoint,
    conversationId: conversationId === 'new' ? null : conversationId,
  };

  if (agentId) {
    body.agentId = agentId;
    body.endpoint = 'agents';
  }

  // Built-in LibreChat endpoints that map directly to /api/ask/<endpoint>
  const STANDARD_ROUTES = new Set([
    'openAI', 'anthropic', 'google', 'azureOpenAI',
    'agents', 'assistants', 'azureAssistants', 'gptPlugins',
  ]);

  const isCustomEndpoint =
    !STANDARD_ROUTES.has(endpoint) && endpoint !== 'agents' && endpoint !== 'assistants';

  if (isCustomEndpoint) {
    // For custom endpoints (e.g. Ollama), LibreChat routes to /api/ask/custom
    // and expects the endpoint name in the body so it can look up the config.
    body.endpointType = 'custom';
  }

  // Build the correct LibreChat URL.
  //
  // LibreChat's modern API (v0.7+) has NO /api/ask/* routes at all.
  // Everything goes through /api/agents/chat, with the endpoint name
  // either as a URL segment (custom/ephemeral) or in the request body.
  //
  //   - agentId present              → POST /api/agents/chat
  //   - assistants endpoint          → POST /api/assistants/v2/chat
  //   - azureAssistants endpoint     → POST /api/assistants/v1/chat
  //   - custom endpoint (e.g. Ollama)→ POST /api/agents/chat/:endpoint
  //   - built-in (openAI, anthropic) → POST /api/agents/chat  (endpoint in body)
  let url: string;
  if (agentId) {
    url = `${BASE_URL}/api/agents/chat`;
  } else if (endpoint === 'assistants') {
    url = `${BASE_URL}/api/assistants/v2/chat`;
  } else if (endpoint === 'azureAssistants') {
    url = `${BASE_URL}/api/assistants/v1/chat`;
  } else if (isCustomEndpoint) {
    // Custom endpoints use the /:endpoint variant so LibreChat looks up
    // the matching entry in endpoints.custom[] by name.
    url = `${BASE_URL}/api/agents/chat/${encodeURIComponent(endpoint)}`;
  } else {
    // Built-in providers: endpoint name goes in the body, route is /chat
    url = `${BASE_URL}/api/agents/chat`;
  }
  console.log('[LibreChat] POST', url, 'body=', JSON.stringify(body));

  try {
    const res = await axios.post(
      url,
      body,
      {
        headers: {
          'Authorization': `Bearer ${lcToken}`,
          'Content-Type': 'application/json',
          // LibreChat's uaParser middleware blocks non-browser User-Agents.
          // Provide a realistic browser UA so the request is accepted.
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        responseType: 'stream',
        timeout: 0, // no timeout for streaming
      }
    );
    return res.data; // Readable stream
  } catch (err: any) {
    console.error('[LibreChat] request error:', err.response?.status, err.response?.data || err.message);
    throw err;
  }
}

// ── Models ────────────────────────────────────────────────────────
export async function getModelsFromLibreChat(lcToken: string) {
  const res = await adminClient().get('/api/models', {
    headers: { Authorization: `Bearer ${lcToken}` },
  });
  return res.data;
}

// ── Conversations ─────────────────────────────────────────────────
export async function getConversations(lcToken: string, page = 1) {
  const res = await adminClient().get(`/api/convos?page=${page}`, {
    headers: { Authorization: `Bearer ${lcToken}` },
  });
  return res.data;
}

export async function deleteConversation(lcToken: string, conversationId: string) {
  const res = await adminClient().delete('/api/convos', {
    headers: { Authorization: `Bearer ${lcToken}` },
    data: {
      arg: {
        conversationId,
        source: 'button',
      },
    },
  });
  return res.data;
}

export async function getMessages(lcToken: string, conversationId: string) {
  const res = await adminClient().get(`/api/messages/${conversationId}`, {
    headers: { Authorization: `Bearer ${lcToken}` },
  });
  return res.data;
}


// ── Agents ────────────────────────────────────────────────────────
export async function getAgents(lcToken: string) {
  const res = await adminClient().get('/api/agents', {
    headers: { Authorization: `Bearer ${lcToken}` },
  });
  return res.data;
}

// Direct Ollama call — bypasses LibreChat completely
export async function streamOllamaDirectly(params: {
  text:           string;
  model:          string;
  conversationId: string | null;
}) {
  const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';

  const res = await axios.post(
    `${OLLAMA_URL}/v1/chat/completions`,
    {
      model:    params.model,
      messages: [{ role: 'user', content: params.text }],
      stream:   true,
    },
    {
      headers:      { 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout:      0,
    }
  );
  return res.data;
}