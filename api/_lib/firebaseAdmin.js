const admin = require('firebase-admin');

function parseServiceAccount() {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            let jsonStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
            if (jsonStr.startsWith("'") && jsonStr.endsWith("'")) {
                jsonStr = jsonStr.slice(1, -1);
            }
            if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
                jsonStr = jsonStr.slice(1, -1);
            }
            const parsed = JSON.parse(jsonStr);
            if (parsed.private_key) {
                parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
            }
            return parsed;
        }

        if (
            process.env.FIREBASE_CLIENT_EMAIL &&
            process.env.FIREBASE_PRIVATE_KEY &&
            process.env.FIREBASE_PROJECT_ID
        ) {
            return {
                project_id: process.env.FIREBASE_PROJECT_ID,
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            };
        }

        throw new Error('FIREBASE_SERVICE_ACCOUNT_MISSING');
    } catch (error) {
        throw new Error(`FIREBASE_ADMIN_CONFIG_INVALID:${error.message}`);
    }
}

function getAdminApp() {
    if (admin.apps.length) return admin.app();

    const serviceAccount = parseServiceAccount();

    try {
        return admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID
        });
    } catch (error) {
        throw new Error(`FIREBASE_ADMIN_INIT_FAILED:${error.message}`);
    }
}

function getAuth() {
    return getAdminApp().auth();
}

function getDb() {
    return getAdminApp().firestore();
}

module.exports = { admin, getAuth, getDb };
