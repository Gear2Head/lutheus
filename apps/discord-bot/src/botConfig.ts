import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

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
