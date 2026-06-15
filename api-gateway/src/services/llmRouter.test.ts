// api-gateway/src/services/llmRouter.test.ts
import { describe, it, expect } from 'vitest';
import { resolveEndpoint, recommendModel, estimateCost, getGroupedModels } from './llmRouter.js';

describe('resolveEndpoint', () => {
  it('maps GPT-4o → openAI', ()      => expect(resolveEndpoint('gpt-4o')).toBe('openAI'));
  it('maps GPT-4o-mini → openAI', () => expect(resolveEndpoint('gpt-4o-mini')).toBe('openAI'));
  it('maps Claude Sonnet → anthropic', () => expect(resolveEndpoint('claude-sonnet-4-20250514')).toBe('anthropic'));
  it('maps Claude Opus → anthropic', () => expect(resolveEndpoint('claude-opus-4-20250514')).toBe('anthropic'));
  it('maps Gemini Pro → google', ()  => expect(resolveEndpoint('gemini-2.5-pro-preview-05-06')).toBe('google'));
  it('maps Llama → custom', ()       => expect(resolveEndpoint('llama3.2')).toBe('custom'));
  it('throws for unknown model', ()  => expect(() => resolveEndpoint('unknown-xyz')).toThrow('Unknown model'));
});

describe('recommendModel', () => {
  it('returns llama3.2 for free tier',     () => expect(recommendModel({ budgetTier: 'free' })).toBe('llama3.2'));
  it('returns o3-mini for reasoning',      () => expect(recommendModel({ budgetTier: 'standard', needsReasoning: true })).toBe('o3-mini'));
  it('returns gemini for huge context',    () => expect(recommendModel({ budgetTier: 'standard', contextLength: 500_000 })).toBe('gemini-2.5-pro-preview-05-06'));
  it('returns gpt-4o-mini for cheap tier', () => expect(recommendModel({ budgetTier: 'cheap' })).toBe('gpt-4o-mini'));
  it('returns claude-opus for premium',    () => expect(recommendModel({ budgetTier: 'premium' })).toBe('claude-opus-4-20250514'));
});

describe('estimateCost', () => {
  it('calculates GPT-4o cost correctly', () => {
    const cost = estimateCost('gpt-4o', 1000, 500);
    expect(cost?.inputCost).toBeCloseTo(0.005, 5);
    expect(cost?.outputCost).toBeCloseTo(0.0075, 5);
    expect(cost?.totalCost).toBeCloseTo(0.0125, 5);
  });
  it('returns zero for free Ollama models', () => {
    const cost = estimateCost('llama3.2', 10_000, 5_000);
    expect(cost?.totalCost).toBe(0);
  });
  it('returns null for unknown model', () => {
    expect(estimateCost('no-such-model', 100, 100)).toBeNull();
  });
});

describe('getGroupedModels', () => {
  it('groups models by provider', () => {
    const g = getGroupedModels();
    expect(g['OpenAI']).toBeDefined();
    expect(g['Anthropic']).toBeDefined();
    expect(g['Google']).toBeDefined();
  });
  it('every model has required fields', () => {
    const g = getGroupedModels();
    Object.values(g).flat().forEach(m => {
      expect(m.id).toBeTruthy();
      expect(m.endpoint).toBeTruthy();
      expect(m.displayName).toBeTruthy();
      expect(typeof m.contextWindow).toBe('number');
    });
  });
});
