// api-gateway/src/services/llmRouter.ts
// Central LLM registry — maps model names to LibreChat endpoints

import type { ModelInfo } from '../types/index.js';

export const MODEL_REGISTRY: Record<string, ModelInfo> = {
  // ── OpenAI ────────────────────────────────────────────────
  'gpt-4o': {
    endpoint: 'openAI', provider: 'OpenAI',
    displayName: 'GPT-4o', contextWindow: 128000,
    costPer1kIn: 0.005, costPer1kOut: 0.015,
    capabilities: ['vision', 'function_calling', 'json_mode'], isFree: false,
  },
  'gpt-4o-mini': {
    endpoint: 'openAI', provider: 'OpenAI',
    displayName: 'GPT-4o Mini', contextWindow: 128000,
    costPer1kIn: 0.00015, costPer1kOut: 0.0006,
    capabilities: ['vision', 'function_calling', 'json_mode'], isFree: false,
  },
  'o3-mini': {
    endpoint: 'openAI', provider: 'OpenAI',
    displayName: 'o3 Mini (Reasoning)', contextWindow: 200000,
    costPer1kIn: 0.0011, costPer1kOut: 0.0044,
    capabilities: ['reasoning', 'function_calling'], isFree: false,
  },

  // ── Anthropic ─────────────────────────────────────────────
  'claude-opus-4-20250514': {
    endpoint: 'anthropic', provider: 'Anthropic',
    displayName: 'Claude Opus 4', contextWindow: 200000,
    costPer1kIn: 0.015, costPer1kOut: 0.075,
    capabilities: ['vision', 'extended_thinking', 'tool_use'], isFree: false,
  },
  'claude-sonnet-4-20250514': {
    endpoint: 'anthropic', provider: 'Anthropic',
    displayName: 'Claude Sonnet 4', contextWindow: 200000,
    costPer1kIn: 0.003, costPer1kOut: 0.015,
    capabilities: ['vision', 'tool_use'], isFree: false,
  },
  'claude-haiku-4-5-20251001': {
    endpoint: 'anthropic', provider: 'Anthropic',
    displayName: 'Claude Haiku 4.5', contextWindow: 200000,
    costPer1kIn: 0.0008, costPer1kOut: 0.004,
    capabilities: ['vision', 'tool_use'], isFree: false,
  },

  // ── Google ────────────────────────────────────────────────
  'gemini-2.5-pro-preview-05-06': {
    endpoint: 'google', provider: 'Google',
    displayName: 'Gemini 2.5 Pro', contextWindow: 1000000,
    costPer1kIn: 0.00125, costPer1kOut: 0.010,
    capabilities: ['vision', 'audio', 'function_calling', 'thinking'], isFree: false,
  },
  'gemini-2.0-flash-001': {
    endpoint: 'google', provider: 'Google',
    displayName: 'Gemini 2.0 Flash', contextWindow: 1000000,
    costPer1kIn: 0.0001, costPer1kOut: 0.0004,
    capabilities: ['vision', 'function_calling'], isFree: false,
  },

  // ── 🦙 Ollama (FREE — runs locally) ──────────────────────
  'llama3.2': {
    endpoint: 'Ollama (Local - FREE)', provider: 'Ollama',
    displayName: 'Llama 3.2 (FREE)', contextWindow: 128000,
    costPer1kIn: 0, costPer1kOut: 0,
    capabilities: ['function_calling'], isFree: true,
  },
  'llama3.2:1b': {
    endpoint: 'Ollama (Local - FREE)', provider: 'Ollama',
    displayName: 'Llama 3.2 1B (FREE, fast)', contextWindow: 128000,
    costPer1kIn: 0, costPer1kOut: 0,
    capabilities: [], isFree: true,
  },
  'mistral': {
    endpoint: 'Ollama (Local - FREE)', provider: 'Ollama',
    displayName: 'Mistral 7B (FREE)', contextWindow: 32768,
    costPer1kIn: 0, costPer1kOut: 0,
    capabilities: ['function_calling'], isFree: true,
  },
  'gemma2:2b': {
    endpoint: 'Ollama (Local - FREE)', provider: 'Ollama',
    displayName: 'Gemma 2 2B (FREE)', contextWindow: 8192,
    costPer1kIn: 0, costPer1kOut: 0,
    capabilities: [], isFree: true,
  },
  'codellama': {
    endpoint: 'Ollama (Local - FREE)', provider: 'Ollama',
    displayName: 'CodeLlama (FREE, code)', contextWindow: 100000,
    costPer1kIn: 0, costPer1kOut: 0,
    capabilities: ['code'], isFree: true,
  },
};

export function resolveEndpoint(model: string): string {
  const entry = MODEL_REGISTRY[model];
  if (!entry) throw new Error(`Unknown model: "${model}". Check MODEL_REGISTRY in llmRouter.ts`);
  return entry.endpoint;
}

export function getGroupedModels(): Record<string, (ModelInfo & { id: string })[]> {
  return Object.entries(MODEL_REGISTRY).reduce((acc, [id, m]) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push({ id, ...m });
    return acc;
  }, {} as Record<string, (ModelInfo & { id: string })[]>);
}

export function recommendModel(task: {
  needsVision?: boolean;
  needsReasoning?: boolean;
  budgetTier: 'free' | 'cheap' | 'standard' | 'premium';
  contextLength?: number;
}): string {
  const { needsReasoning, budgetTier, contextLength = 0 } = task;
  if (budgetTier === 'free') return 'llama3.2';
  if (needsReasoning) return 'o3-mini';
  if (contextLength > 200_000) return 'gemini-2.5-pro-preview-05-06';
  if (budgetTier === 'cheap') return 'gpt-4o-mini';
  if (budgetTier === 'premium') return 'claude-opus-4-20250514';
  return 'claude-sonnet-4-20250514';
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number) {
  const m = MODEL_REGISTRY[model];
  if (!m) return null;
  const inputCost = (inputTokens / 1000) * m.costPer1kIn;
  const outputCost = (outputTokens / 1000) * m.costPer1kOut;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}
