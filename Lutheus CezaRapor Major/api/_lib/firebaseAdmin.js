const admin = require('firebase-admin');

function parseServiceAccount() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        if (parsed.private_key) {
            parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        return parsed;
    }

    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) {
        return {
            project_id: process.env.FIREBASE_PROJECT_ID,
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        };
    }

    return null;
}

function getAdminApp() {
    if (admin.apps.length) return admin.app();

    const serviceAccount = parseServiceAccount();
    if (serviceAccount) {
        return admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || 'lutheus-project'
        });
    }

    return admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'lutheus-project'
    });
}

function getAuth() {
    return getAdminApp().auth();
}

function getDb() {
    return getAdminApp().firestore();
}

module.exports = { admin, getAuth, getDb };
