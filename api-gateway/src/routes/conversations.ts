// api-gateway/src/routes/conversations.ts
import { Router } from 'express';
import {
  getConversations,
  deleteConversation,
  getLibreChatToken,
} from '../services/librechatClient.js';

export const conversationsRouter = Router();

// GET /api/conversations
conversationsRouter.get('/', async (req, res) => {
  const lcToken = await getLibreChatToken(req.user!.id);
  if (!lcToken) return res.status(401).json({ error: 'Session expired' });
  try {
    const data = await getConversations(lcToken, Number(req.query.page) || 1);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/conversations/:id
conversationsRouter.delete('/:id', async (req, res) => {
  const lcToken = await getLibreChatToken(req.user!.id);
  if (!lcToken) return res.status(401).json({ error: 'Session expired' });
  try {
    await deleteConversation(lcToken, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
