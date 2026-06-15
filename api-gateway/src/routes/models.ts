// api-gateway/src/routes/models.ts
import { Router } from 'express';
import { MODEL_REGISTRY, getGroupedModels } from '../services/llmRouter.js';

export const modelsRouter = Router();

// GET /api/models — returns all available models grouped by provider
modelsRouter.get('/', (_req, res) => {
  res.json({
    models: MODEL_REGISTRY,
    grouped: getGroupedModels(),
  });
});
