// api-gateway/src/routes/chat.ts
import { Router } from 'express';
import { chatRateLimit } from '../middleware/rateLimit.js';
import { resolveEndpoint } from '../services/llmRouter.js';
import { streamChat, getLibreChatToken } from '../services/librechatClient.js';

export const chatRouter = Router();

chatRouter.post('/', chatRateLimit, async (req, res) => {
  const { text, model, conversationId, agentId } = req.body;
  const userId = req.user!.id;

  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
  if (!model) return res.status(400).json({ error: 'model is required' });

  const lcToken = await getLibreChatToken(userId);
  if (!lcToken) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  let endpoint: string;
  try {
    endpoint = resolveEndpoint(model);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  console.log(`[Chat] user=${userId} model=${model} endpoint=${endpoint}`);

  try {
    const stream = await streamChat({
      userId, lcToken, text, model, endpoint,
      conversationId: conversationId || 'new',
      agentId,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    stream.pipe(res);
    req.on('close', () => stream.destroy());
    stream.on('error', (err: Error) => {
      console.error('[Chat] Stream error:', err.message);
    });
  } catch (err: any) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || err.message;
    if (!res.headersSent)
      res.status(status).json({ error: message });
  }
});
