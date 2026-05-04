const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixUser() {
    const uid = 'discord:758769576778661989';
    try {
        await db.collection('roleCache').doc(uid).set({
            role: 'admin',
            discordId: '758769576778661989',
            updatedAt: new Date().toISOString(),
            updatedBy: 'system'
        }, { merge: true });

        await db.collection('users').doc(uid).set({
            role: 'admin',
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log('User fixed successfully.');
    } catch (e) {
        console.error('Error fixing user:', e);
    }
}

fixUser().then(() => process.exit());
