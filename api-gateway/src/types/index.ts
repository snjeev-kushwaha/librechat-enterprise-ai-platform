// api-gateway/src/types/index.ts

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

export interface ModelInfo {
  endpoint: string;
  provider: string;
  displayName: string;
  contextWindow: number;
  costPer1kIn: number;
  costPer1kOut: number;
  capabilities: string[];
  isFree: boolean;
}

export interface ChatRequest {
  text: string;
  model: string;
  conversationId: string | null;
  agentId?: string;
  files?: string[];
}

export interface LibreChatStreamChunk {
  text?: string;
  conversationId?: string;
  messageId?: string;
  parentMessageId?: string;
  final?: boolean;
  error?: string;
  title?: string;
}

export interface Conversation {
  conversationId: string;
  title: string;
  model: string;
  endpoint: string;
  createdAt: string;
  updatedAt: string;
}

// Extend Express Request with authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
