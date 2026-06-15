#!/usr/bin/env node
/**
 * gen-secrets.js
 * Auto-generates all required secret keys and updates your .env file
 * Usage: node scripts/gen-secrets.js
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath   = path.join(__dirname, '..', '.env');

// Check .env exists
if (!fs.existsSync(envPath)) {
  console.error('❌ .env not found. Run: cp .env.example .env first.');
  process.exit(1);
}

let env = fs.readFileSync(envPath, 'utf8');

const replacements = {
  JWT_SECRET:           crypto.randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET:   crypto.randomBytes(32).toString('hex'),
  CREDS_KEY:            crypto.randomBytes(32).toString('hex'),
  CREDS_IV:             crypto.randomBytes(16).toString('hex'),
  MEILI_MASTER_KEY:     crypto.randomBytes(20).toString('hex'),
  MONGO_PASSWORD:       crypto.randomBytes(16).toString('hex'),
  POSTGRES_PASSWORD:    crypto.randomBytes(16).toString('hex'),
  REDIS_PASSWORD:       crypto.randomBytes(16).toString('hex'),
  GATEWAY_JWT_SECRET:   crypto.randomBytes(32).toString('hex'),
  MCP_SHARED_SECRET:    crypto.randomBytes(24).toString('hex'),
};

let updated = 0;
for (const [key, value] of Object.entries(replacements)) {
  const regex = new RegExp(`^(${key}=)REPLACE_WITH.*$`, 'm');
  if (regex.test(env)) {
    env = env.replace(regex, `$1${value}`);
    console.log(`✅ Generated ${key}`);
    updated++;
  }
}

fs.writeFileSync(envPath, env);
console.log(`\n🎉 ${updated} secrets generated and saved to .env`);
console.log('\nNext steps:');
console.log('  1. Add your API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)');
console.log('  2. Run: docker compose up -d');
console.log('  3. Visit: http://localhost:3080 → create admin account');
console.log('  4. Set ALLOW_REGISTRATION=false in .env');
console.log('  5. Visit: http://localhost:5173 for the React app');
