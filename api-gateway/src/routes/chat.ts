// api-gateway/src/routes/chat.ts
import { Router } from 'express';
import axios from 'axios';
import { chatRateLimit } from '../middleware/rateLimit.js';
import { resolveEndpoint } from '../services/llmRouter.js';
import { streamChat, getValidLcToken, streamOllamaDirectly, getModelsFromLibreChat } from '../services/librechatClient.js';

const LIBRECHAT_URL = process.env.LIBRECHAT_URL || 'http://librechat:3080';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const chatRouter = Router();

chatRouter.post('/', chatRateLimit, async (req, res) => {
  const { text, model, conversationId, agentId } = req.body;
  const userId = req.user!.id;

  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

  let endpoint: string;
  try { endpoint = resolveEndpoint(model); }
  catch (err: any) { return res.status(400).json({ error: err.message }); }

  // ── All other providers: go through LibreChat ───────────────
  const lcToken = await getValidLcToken(userId);
  if (!lcToken) return res.status(401).json({ error: 'Session expired. Please log in again.' });

  if (endpoint === 'ollama') {
    try {
      console.log(`[Chat] Pre-fetching models from LibreChat to initialize ollama endpoint...`);
      await getModelsFromLibreChat(lcToken);
    } catch (err: any) {
      console.warn(`[Chat] Failed to pre-fetch models for ollama:`, err.message);
    }
  }

  // ... rest of existing LibreChat streaming code
  try {
    // Step 1: POST to LibreChat to start the generation job.
    // Returns { streamId, conversationId, status: "started" } in modern LibreChat.
    const initResponse = await streamChat({
      userId, lcToken, text, model, endpoint,
      conversationId: conversationId || 'new',
      agentId,
    });

    // Collect the initial JSON response (it's a short payload, not a real stream)
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      initResponse.on('data', (chunk: Buffer) => chunks.push(chunk));
      initResponse.on('end', resolve);
      initResponse.on('error', reject);
    });

    const rawBody = Buffer.concat(chunks).toString('utf8');
    console.log('[LibreChat] init response:', rawBody.substring(0, 300));

    let initData: any;
    try {
      initData = JSON.parse(rawBody);
    } catch {
      // If it's not JSON it might already be an SSE stream (old-style direct stream)
      // Fall back: pipe whatever we got directly
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      res.write(rawBody);
      res.end();
      return;
    }

    // Check for errors in the init response
    if (initData.message) {
      return res.status(400).json({ error: initData.message });
    }

    const streamId = initData.streamId;
    if (!streamId) {
      console.error('[Chat] No streamId in LibreChat response:', initData);
      return res.status(500).json({ error: 'No streamId returned from LibreChat' });
    }

    const newConversationId = initData.conversationId || streamId;
    console.log(`[Chat] Got streamId=${streamId}, subscribing to SSE stream...`);

    // Step 2: Subscribe to the SSE stream for this job.
    // LibreChat: GET /api/agents/chat/stream/:streamId
    const sseResponse = await axios.get(
      `${LIBRECHAT_URL}/api/agents/chat/stream/${streamId}`,
      {
        headers: {
          Authorization: `Bearer ${lcToken}`,
          Accept: 'text/event-stream',
          'User-Agent': BROWSER_UA,
          // Pass conversationId so LibreChat can resume if needed
          'X-Conversation-Id': newConversationId,
        },
        responseType: 'stream',
        timeout: 0, // no timeout for streaming
      }
    );

    // Step 3: Pipe the SSE stream back to the client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    // Surface the conversationId so the frontend can track this conversation
    res.setHeader('X-Conversation-Id', newConversationId);
    res.flushHeaders();

    sseResponse.data.pipe(res);

    let firstChunkLogged = false;
    sseResponse.data.on('data', (chunk: Buffer) => {
      if (!firstChunkLogged) {
        firstChunkLogged = true;
        console.log('[LibreChat SSE first chunk]:', chunk.toString('utf8').substring(0, 300));
      }
    });

    sseResponse.data.on('end', () => console.log('[LibreChat SSE stream] ended'));
    sseResponse.data.on('error', (e: Error) => console.error('[LibreChat SSE error]:', e.message));
    req.on('close', () => sseResponse.data.destroy());

  } catch (err: any) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || err.message;
    console.error('[Chat] Error:', status, message);
    if (!res.headersSent)
      res.status(status).json({ error: message });
  }
});