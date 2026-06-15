export interface ModelInfo {
  id: string;
  endpoint: string;
  provider: string;
  displayName: string;
  contextWindow: number;
  costPer1kIn: number;
  costPer1kOut: number;
  capabilities: string[];
  isFree: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  createdAt: Date;
  isStreaming?: boolean;
}

export interface Conversation {
  conversationId: string;
  title: string;
  model: string;
  endpoint: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  tools?: string[];
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}
