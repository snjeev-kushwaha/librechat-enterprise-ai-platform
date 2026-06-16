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
    headers: { 'Content-Type': 'application/json' },
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
    // Store with 8-hour expiry matching JWT lifetime
    await redis.setEx(`lc_token:${userId}`, 3600 * 8, token);
  } catch (e: any) {
    console.error('[Redis] Failed to store LC token:', e.message);
  }
}

// ── Authentication ────────────────────────────────────────────────
export async function loginToLibreChat(email: string, password: string) {
  const res = await adminClient().post('/api/auth/login', { email, password });
  return res.data as { user: { id: string; email: string; role: string }; token: string };
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

  // const res = await axios.post(
  //   `${BASE_URL}/api/ask/${encodeURIComponent(agentId ? 'agents' : endpoint)}`,
  // NEW — custom endpoints use /api/ask/custom, name stays in body
  const STANDARD_ROUTES = new Set([
    'openAI', 'anthropic', 'google', 'azureOpenAI',
    'agents', 'assistants', 'gptPlugins'
  ]);
  const route = agentId
    ? 'agents'
    : STANDARD_ROUTES.has(endpoint) ? endpoint : 'custom';

  const res = await axios.post(
    `${BASE_URL}/api/ask/${route}`,
    body,
    {
      headers: {
        'Authorization': `Bearer ${lcToken}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      timeout: 0, // no timeout for streaming
    }
  );

  return res.data; // Readable stream
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
  const res = await adminClient().delete(`/api/convos/${conversationId}`, {
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
