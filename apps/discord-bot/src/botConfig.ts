// SECTION: BOT_ENV
// PURPOSE: Configures environment and exports the Supabase client and Discord bot secrets.

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match && process.env[match[1]] === undefined) {
            process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
        }
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jxhzhaqqtlynbnntwpyu.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

export const botToken = process.env.DISCORD_BOT_TOKEN || process.env.Discord_Bot_Token || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || '';
export const logChannelId = process.env.DISCORD_LOG_CHANNEL_ID || '';
export const guildId = process.env.DISCORD_GUILD_ID || '';
