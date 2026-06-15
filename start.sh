#!/bin/bash
# start.sh — Quick start for AI Platform
set -e

echo ""
echo "🤖 AI Platform — Quick Start"
echo "=============================="

# Check .env
if [ ! -f ".env" ]; then
  echo "📋 Creating .env from template..."
  cp .env.example .env
  echo "📝 Generating secret keys..."
  node scripts/gen-secrets.js
  echo ""
  echo "⚠️  IMPORTANT: Edit .env and add your API keys before continuing!"
  echo "   Required: at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_KEY"
  echo ""
  echo "Then run this script again."
  exit 0
fi

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Install Docker Desktop from https://docker.com"
  exit 1
fi

echo "🐳 Starting all services..."
docker compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 15

echo ""
echo "🔍 Health checks..."
curl -sf http://localhost:3080/api/health > /dev/null && echo "  ✅ LibreChat   :3080" || echo "  ⚠️  LibreChat still starting..."
curl -sf http://localhost:4000/health     > /dev/null && echo "  ✅ API Gateway :4000" || echo "  ⚠️  Gateway still starting..."
curl -sf http://localhost:3001/health     > /dev/null && echo "  ✅ MCP Tools   :3001" || echo "  ⚠️  MCP Tools still starting..."
curl -sf http://localhost:3002/health     > /dev/null && echo "  ✅ MCP DB      :3002" || echo "  ⚠️  MCP DB still starting..."

echo ""
echo "✅ Platform started!"
echo ""
echo "📍 Open these URLs:"
echo "   React App  → http://localhost:80     (or http://localhost:5173 for dev)"
echo "   LibreChat  → http://localhost:3080   (admin panel)"
echo ""
echo "Next: Create your admin account at http://localhost:3080"
echo "      Then set ALLOW_REGISTRATION=false in .env"
