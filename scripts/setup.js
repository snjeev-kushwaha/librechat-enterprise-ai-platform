#!/usr/bin/env node
/**
 * setup.js — one-command project bootstrapper
 * Run: node scripts/setup.js
 */
import { execSync } from 'child_process';
import fs           from 'fs';
import path         from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root      = path.join(__dirname, '..');

function run(cmd, cwd = root) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function exists(p) { return fs.existsSync(path.join(root, p)); }

console.log('\n🚀 AI Platform — Setup Script\n');
console.log('='.repeat(50));

// 1. Check .env
if (!exists('.env')) {
  if (exists('.env.example')) {
    fs.copyFileSync(path.join(root, '.env.example'), path.join(root, '.env'));
    console.log('✅ Created .env from .env.example');
  } else {
    console.error('❌ .env.example not found!');
    process.exit(1);
  }
} else {
  console.log('✅ .env already exists — skipping copy');
}

// 2. Generate secrets
console.log('\n📝 Generating secrets...');
run('node scripts/gen-secrets.js');

// 3. Install dependencies
console.log('\n📦 Installing dependencies...');
run('npm install');
run('npm install', path.join(root, 'api-gateway'));
run('npm install', path.join(root, 'react-app'));
run('npm install', path.join(root, 'mcp-servers/tools-server'));
run('npm install', path.join(root, 'mcp-servers/db-server'));

console.log('\n' + '='.repeat(50));
console.log('✅ Setup complete!\n');
console.log('Next steps:');
console.log('  1. Edit .env — add your API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)');
console.log('  2. Run: npm run docker:up');
console.log('  3. Visit http://localhost:3080 — create your admin account');
console.log('  4. Set ALLOW_REGISTRATION=false in .env, then: docker compose restart librechat');
console.log('  5. Visit http://localhost:5173 — your AI platform is live!\n');
