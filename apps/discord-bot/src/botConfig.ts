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
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

function initializeDefaultFirebaseAdmin() {
    if (firebaseProjectId) {
        admin.initializeApp({ projectId: firebaseProjectId });
        console.log('Discord Bot: Initialized default Firebase Admin with project ID');
        return;
    }

    admin.initializeApp();
    console.log('Discord Bot: Initialized default Firebase Admin');
}

// SECTION: FIREBASE_ADMIN_INIT
// PURPOSE: Initializes Firebase Admin from Railway env vars or local default credentials.
if (admin.apps.length === 0) {
    if (serviceAccountJson) {
        try {
            const cleanedJson = serviceAccountJson.replace(/\\n/g, '\n');
            const serviceAccount = JSON.parse(cleanedJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('Discord Bot: Initialized Firebase Admin cert successfully');
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.warn('Discord Bot: Service account JSON parse failed, falling back to split credentials:', message);
            if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: firebaseProjectId,
                        clientEmail: firebaseClientEmail,
                        privateKey: firebasePrivateKey
                    })
                });
                console.log('Discord Bot: Initialized Firebase Admin split credentials successfully');
            } else {
                initializeDefaultFirebaseAdmin();
            }
        }
    } else if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: firebaseProjectId,
                clientEmail: firebaseClientEmail,
                privateKey: firebasePrivateKey
            })
        });
        console.log('Discord Bot: Initialized Firebase Admin split credentials successfully');
    } else {
        initializeDefaultFirebaseAdmin();
    }
}

// SECTION: BOT_TOKENS
// PURPOSE: Exports credentials and configs for logging and API calls.
export const db = admin.firestore();
export const botToken = process.env.DISCORD_BOT_TOKEN || process.env.Discord_Bot_Token || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || '';
export const logChannelId = process.env.DISCORD_LOG_CHANNEL_ID || '';
export const guildId = process.env.DISCORD_GUILD_ID || '';
