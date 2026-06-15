// api-gateway/src/routes/agents.ts
import { Router } from 'express';
import { getAgents, getLibreChatToken } from '../services/librechatClient.js';

export const agentsRouter = Router();

// GET /api/agents
agentsRouter.get('/', async (req, res) => {
  const lcToken = await getLibreChatToken(req.user!.id);
  if (!lcToken) return res.status(401).json({ error: 'Session expired' });
  try {
    const data = await getAgents(lcToken);
    res.json(data);
  } catch (err: any) {
    // Return empty list if agents not configured
    res.json({ agents: [] });
  }
});
