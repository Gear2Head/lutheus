import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SECTION: BOT_ENV
// PURPOSE: Railway uses real env vars; local development may read a root .env without bundling secrets.
const envPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match && process.env[match[1]] === undefined) {
            process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
        }
    }
}

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (admin.apps.length === 0) {
    if (serviceAccountJson) {
        try {
            // Replace newlines inside private key string
            const cleanedJson = serviceAccountJson.replace(/\\n/g, '\n');
            const serviceAccount = JSON.parse(cleanedJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('Discord Bot: Initialized Firebase Admin cert successfully');
        } catch (e: any) {
            console.warn('Discord Bot: Service account JSON parse failed, falling back to default:', e.message);
            admin.initializeApp();
        }
    } else {
        admin.initializeApp();
        console.log('Discord Bot: Initialized default Firebase Admin');
    }
}

export const db = admin.firestore();
export const botToken = process.env.DISCORD_BOT_TOKEN || '';
export const logChannelId = process.env.DISCORD_LOG_CHANNEL_ID || '';
export const guildId = '1223431616081166336';
