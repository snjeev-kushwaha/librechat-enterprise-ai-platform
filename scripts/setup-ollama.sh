#!/bin/bash
# setup-ollama.sh — pulls recommended Ollama models after docker compose up
echo ""
echo "🦙 Setting up Ollama models..."
echo "==============================="

if ! docker ps | grep -q ai-platform-ollama; then
  echo "❌ Ollama container not running. Run: npm run docker:up first"
  exit 1
fi

echo "📥 Pulling llama3.2 (~2.0 GB) — best general-purpose FREE model..."
docker exec ai-platform-ollama ollama pull llama3.2

echo ""
echo "📥 Pulling gemma2:2b (~1.6 GB) — fast small model..."
docker exec ai-platform-ollama ollama pull gemma2:2b

echo ""
echo "📥 Pulling nomic-embed-text (~274 MB) — FREE embeddings for RAG..."
docker exec ai-platform-ollama ollama pull nomic-embed-text

echo ""
echo "✅ Done! Available models:"
docker exec ai-platform-ollama ollama list

echo ""
echo "To switch RAG to FREE embeddings, add to .env:"
echo "  EMBEDDINGS_PROVIDER=ollama"
echo "  EMBEDDINGS_MODEL=nomic-embed-text"
echo "  OLLAMA_BASE_URL=http://ollama:11434"
echo "Then: docker compose restart rag_api"
