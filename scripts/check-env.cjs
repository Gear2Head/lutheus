const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
const required = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'OAUTH_STATE_SECRET',
  'BOOTSTRAP_DISCORD_IDS',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'GROQ_API_KEY'
];

const optional = [
  'GROQ_MODEL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
];

function parseEnv(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    result[key] = rawValue.replace(/^["']|["']$/g, '');
  }
  return result;
}

if (!fs.existsSync(envPath)) {
  console.error('Missing .env file.');
  process.exit(1);
}

const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
const missing = required.filter((key) => !env[key]);
const presentOptional = optional.filter((key) => Boolean(env[key]));

console.log(`Required present: ${required.length - missing.length}/${required.length}`);
console.log(`Optional present: ${presentOptional.length}/${optional.length}`);

if (missing.length) {
  console.error(`Missing required keys: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('Environment shape is valid. Values were not printed.');
