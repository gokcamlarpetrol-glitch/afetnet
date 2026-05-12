const admin = require('firebase-admin');
const path = require('path');

// Try to load service account
let serviceAccount;
try {
  serviceAccount = require(path.join(__dirname, '../functions/serviceAccountKey.json'));
} catch {
  try {
    serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
  } catch {
    console.error('No service account key found. Trying default credentials...');
  }
}

if (admin.apps.length === 0) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'afetnet-4a6b6',
    });
  } else {
    admin.initializeApp({ projectId: 'afetnet-4a6b6' });
  }
}

const db = admin.firestore();

async function check() {
  // 1. List all conversations with message counts
  const convsSnap = await db.collection('conversations').get();
  console.log('=== CONVERSATIONS (' + convsSnap.size + ') ===\n');

  const convsByPairKey = {};

  for (const doc of convsSnap.docs) {
    const data = doc.data();
    const pk = data.pairKey || '(no pairKey)';
    if (!convsByPairKey[pk]) convsByPairKey[pk] = [];

    // Count messages
    const msgsSnap = await db.collection('conversations').doc(doc.id).collection('messages').get();
    convsByPairKey[pk].push({
      id: doc.id,
      type: data.type,
      participants: data.participants,
      pairKey: pk,
      createdAt: data.createdAt,
      msgCount: msgsSnap.size,
    });

    console.log(`Conv: ${doc.id} | type=${data.type} | pairKey=${pk} | participants=${JSON.stringify(data.participants)} | msgs=${msgsSnap.size}`);
  }

  // 2. Show duplicates
  console.log('\n=== DUPLICATE PAIR KEYS ===\n');
  let hasDuplicates = false;
  for (const [pk, convs] of Object.entries(convsByPairKey)) {
    if (convs.length > 1) {
      hasDuplicates = true;
      console.log(`DUPLICATE pairKey: "${pk}" → ${convs.length} conversations:`);
      convs.forEach(c => console.log(`  - ${c.id} (msgs=${c.msgCount}, created=${c.createdAt ? new Date(c.createdAt).toISOString() : 'N/A'})`));
    }
  }
  if (!hasDuplicates) {
    console.log('No duplicates found.');
  }

  // 3. Check push tokens
  const tokensSnap = await db.collection('push_tokens').get();
  console.log('\n=== PUSH TOKENS (' + tokensSnap.size + ' users) ===\n');
  for (const userDoc of tokensSnap.docs) {
    const devicesSnap = await db.collection('push_tokens').doc(userDoc.id).collection('devices').get();
    console.log(`User ${userDoc.id}: ${devicesSnap.size} device(s)`);
    for (const devDoc of devicesSnap.docs) {
      const d = devDoc.data();
      const tokenPrefix = d.token ? d.token.substring(0, 25) + '...' : '(no token)';
      console.log(`  - ${devDoc.id}: platform=${d.platform || 'unknown'} token=${tokenPrefix}`);
    }
  }

  // 4. Check legacy FCM tokens
  const legacySnap = await db.collection('fcm_tokens').get();
  console.log('\n=== LEGACY FCM TOKENS (' + legacySnap.size + ' users) ===\n');
  for (const doc of legacySnap.docs) {
    const data = doc.data();
    const tokenPrefix = data.token ? data.token.substring(0, 25) + '...' : '(no token)';
    console.log(`User ${doc.id}: token=${tokenPrefix} platform=${data.platform || 'unknown'}`);
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
