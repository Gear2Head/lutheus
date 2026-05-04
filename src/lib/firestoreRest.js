import { FIREBASE_CONFIG, FIRESTORE_DATABASE } from '../config/appConfig.js';
import { getStoredSession, isSessionExpired } from '../auth/sessionStore.js';

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/${encodeURIComponent(FIRESTORE_DATABASE)}/documents`;

function encodePath(path) {
    return path.split('/').map((part) => encodeURIComponent(part)).join('/');
}

export function toFirestoreValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') {
        if (Number.isInteger(value)) return { integerValue: String(value) };
        return { doubleValue: value };
    }
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    if (Array.isArray(value)) {
        return { arrayValue: { values: value.map((item) => toFirestoreValue(item)) } };
    }
    if (typeof value === 'object') {
        return {
            mapValue: {
                fields: Object.fromEntries(
                    Object.entries(value).map(([key, nested]) => [key, toFirestoreValue(nested)])
                )
            }
        };
    }
    return { stringValue: String(value) };
}

export function fromFirestoreValue(value) {
    if (!value || value.nullValue !== undefined) return null;
    if (value.stringValue !== undefined) return value.stringValue;
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.integerValue !== undefined) return Number(value.integerValue);
    if (value.doubleValue !== undefined) return Number(value.doubleValue);
    if (value.timestampValue !== undefined) return value.timestampValue;
    if (value.arrayValue !== undefined) {
        return (value.arrayValue.values || []).map((item) => fromFirestoreValue(item));
    }
    if (value.mapValue !== undefined) {
        return fromFirestoreFields(value.mapValue.fields || {});
    }
    return null;
}

export function toFirestoreFields(data) {
    return Object.fromEntries(
        Object.entries(data || {}).map(([key, value]) => [key, toFirestoreValue(value)])
    );
}

export function fromFirestoreFields(fields) {
    return Object.fromEntries(
        Object.entries(fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)])
    );
}

function documentIdFromName(name) {
    return String(name || '').split('/').pop();
}

async function getIdToken() {
    const session = await getStoredSession();
    if (!session?.idToken || isSessionExpired(session)) {
        throw new Error('AUTH_REQUIRED');
    }
    return session.idToken;
}

async function request(path, options = {}) {
    const token = options.token || (options.public ? null : await getIdToken());
    const response = await fetch(`${BASE_URL}/${encodePath(path)}${options.query || ''}`, {
        method: options.method || 'GET',
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.body ? { 'Content-Type': 'application/json' } : {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (response.status === 404) return null;

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = payload?.error?.message || `Firestore request failed: ${response.status}`;
        throw new Error(message);
    }
    return payload;
}

export const FirestoreRest = {
    async getDocument(path, token = null) {
        const doc = await request(path, { token });
        if (!doc) return null;
        return { id: documentIdFromName(doc.name), ...fromFirestoreFields(doc.fields || {}) };
    },

    async setDocument(path, data) {
        const doc = await request(path, {
            method: 'PATCH',
            body: { fields: toFirestoreFields(data) }
        });
        return { id: documentIdFromName(doc.name), ...fromFirestoreFields(doc.fields || {}) };
    },

    async listDocuments(collectionPath, options = {}) {
        const query = new URLSearchParams();
        if (options.pageSize) query.set('pageSize', String(options.pageSize));
        if (options.orderBy) query.set('orderBy', options.orderBy);
        const payload = await request(collectionPath, {
            query: query.toString() ? `?${query}` : ''
        });
        return (payload?.documents || []).map((doc) => ({
            id: documentIdFromName(doc.name),
            ...fromFirestoreFields(doc.fields || {})
        }));
    },

    async createDocument(collectionPath, data, documentId = null) {
        const query = documentId ? `?documentId=${encodeURIComponent(documentId)}` : '';
        const doc = await request(collectionPath, {
            method: 'POST',
            query,
            body: { fields: toFirestoreFields(data) }
        });
        return { id: documentIdFromName(doc.name), ...fromFirestoreFields(doc.fields || {}) };
    },
    async deleteDocument(path) {
        return request(path, { method: 'DELETE' });
    }
};

// ... existing code below if any, but this is the end of FirestoreRest ...
