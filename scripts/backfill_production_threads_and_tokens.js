const fs = require('fs');
const https = require('https');

const PROJECT_ID = 'afetnet-4a6b6';

function readFirebaseCliAccessToken() {
  try {
    const raw = fs.readFileSync(`${process.env.HOME}/.config/configstore/firebase-tools.json`, 'utf8');
    const config = JSON.parse(raw);
    const token = config?.tokens?.access_token;
    if (!token) throw new Error('access_token not found in firebase-tools.json');
    return token;
  } catch (error) {
    throw new Error(`Failed to read Firebase CLI token: ${error.message || error}`);
  }
}

const ACCESS_TOKEN = readFirebaseCliAccessToken();

function requestApi({ hostname, path, method = 'GET', body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    };

    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request({ hostname, path, method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch {
          return reject(new Error(`Non-JSON response: ${data}`));
        }

        if (res.statusCode >= 400) {
          const msg = parsed?.error?.message || `HTTP ${res.statusCode}`;
          const err = new Error(msg);
          err.statusCode = res.statusCode;
          err.payload = parsed;
          return reject(err);
        }

        resolve(parsed);
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };

  if (typeof value === 'string') return { stringValue: value };

  if (typeof value === 'boolean') return { booleanValue: value };

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { nullValue: null };
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => encodeValue(item)),
      },
    };
  }

  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = encodeValue(v);
    }
    return { mapValue: { fields } };
  }

  return { stringValue: String(value) };
}

function decodeString(value) {
  return value && typeof value.stringValue === 'string' ? value.stringValue : '';
}

function decodeNumber(value, fallback = 0) {
  if (!value) return fallback;
  if (typeof value.integerValue === 'string') {
    const n = Number(value.integerValue);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof value.doubleValue === 'number') {
    return Number.isFinite(value.doubleValue) ? value.doubleValue : fallback;
  }
  return fallback;
}

function decodeStringArray(value) {
  const raw = value?.arrayValue?.values;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => decodeString(item).trim())
    .filter((item) => item.length > 0);
}

function docIdFromName(name) {
  return String(name || '').split('/').pop() || '';
}

function hasNumberValue(value) {
  return !!value && (typeof value.integerValue === 'string' || typeof value.doubleValue === 'number');
}

function hasBooleanValue(value) {
  return !!value && typeof value.booleanValue === 'boolean';
}

async function listDocuments(collectionPath) {
  let pageToken = '';
  const docs = [];

  while (true) {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const path = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}?pageSize=200${tokenParam}`;
    const result = await requestApi({ hostname: 'firestore.googleapis.com', path });
    if (Array.isArray(result.documents)) {
      docs.push(...result.documents);
    }
    if (!result.nextPageToken) break;
    pageToken = result.nextPageToken;
  }

  return docs;
}

async function getDocument(docPath) {
  try {
    const path = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
    return await requestApi({ hostname: 'firestore.googleapis.com', path });
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

async function patchDocument(docPath, plainFields) {
  const fieldPaths = Object.keys(plainFields);
  const updateMask = fieldPaths
    .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');

  const path = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?${updateMask}`;
  const fields = {};
  for (const [k, v] of Object.entries(plainFields)) {
    fields[k] = encodeValue(v);
  }

  return requestApi({
    hostname: 'firestore.googleapis.com',
    path,
    method: 'PATCH',
    body: { fields },
  });
}

async function backfillInboxThreads() {
  const conversations = await listDocuments('conversations');
  let created = 0;
  let patched = 0;
  let scanned = 0;

  for (const conv of conversations) {
    scanned += 1;
    const convId = docIdFromName(conv.name);
    const fields = conv.fields || {};

    const participants = Array.from(new Set(decodeStringArray(fields.participants)));
    if (participants.length === 0) continue;

    const rawType = decodeString(fields.type).trim().toLowerCase();
    const isGroup = rawType === 'group' || convId.startsWith('grp_');
    const conversationType = isGroup ? 'group' : 'dm';
    const lastMessagePreview = decodeString(fields.lastMessagePreview) || decodeString(fields.lastMessage) || '';
    const lastMessageSenderName = decodeString(fields.lastMessageSenderName) || '';
    const lastMessageAt = decodeNumber(fields.lastMessageAt, Date.now());
    const now = Date.now();

    for (const uid of participants) {
      const threadPath = `user_inbox/${uid}/threads/${convId}`;
      const existing = await getDocument(threadPath);
      if (!existing) {
        await patchDocument(threadPath, {
          conversationId: convId,
          conversationType,
          isGroup,
          participants,
          lastMessagePreview,
          lastMessageSenderName,
          lastMessageAt,
          unreadCount: 0,
          updatedAt: now,
          schemaVersion: 3,
        });
        created += 1;
        continue;
      }

      const ef = existing.fields || {};
      const patch = {};

      const existingConversationId = decodeString(ef.conversationId);
      if (!existingConversationId) patch.conversationId = convId;

      const existingType = decodeString(ef.conversationType).trim().toLowerCase();
      if (!existingType) patch.conversationType = conversationType;

      if (!hasBooleanValue(ef.isGroup)) patch.isGroup = isGroup;

      const existingParticipants = decodeStringArray(ef.participants);
      if (existingParticipants.length === 0) patch.participants = participants;

      if (!hasNumberValue(ef.unreadCount)) patch.unreadCount = 0;
      if (!hasNumberValue(ef.lastMessageAt)) patch.lastMessageAt = lastMessageAt;

      if (!decodeString(ef.lastMessagePreview) && lastMessagePreview) {
        patch.lastMessagePreview = lastMessagePreview;
      }
      if (!decodeString(ef.lastMessageSenderName) && lastMessageSenderName) {
        patch.lastMessageSenderName = lastMessageSenderName;
      }

      if (!hasNumberValue(ef.schemaVersion)) patch.schemaVersion = 3;

      if (Object.keys(patch).length > 0) {
        patch.updatedAt = now;
        await patchDocument(threadPath, patch);
        patched += 1;
      }
    }
  }

  return { scanned, created, patched };
}

async function normalizePushTokenInstallationIds() {
  const userDocs = await listDocuments('users');
  const conversations = await listDocuments('conversations');
  const uidSet = new Set(
    userDocs
      .map((doc) => docIdFromName(doc.name))
      .filter((uid) => uid.length > 0),
  );
  for (const conv of conversations) {
    const participants = decodeStringArray(conv.fields?.participants);
    participants.forEach((uid) => uidSet.add(uid));
  }

  const rootPushDocs = await listDocuments('push_tokens');
  rootPushDocs
    .map((doc) => docIdFromName(doc.name))
    .filter((uid) => uid.length > 0)
    .forEach((uid) => uidSet.add(uid));

  let scanned = 0;
  let patched = 0;

  for (const uid of uidSet) {
    if (!uid) continue;

    const deviceDocs = await listDocuments(`push_tokens/${uid}/devices`);
    for (const deviceDoc of deviceDocs) {
      scanned += 1;
      const deviceId = docIdFromName(deviceDoc.name);
      if (!deviceId) continue;

      const installationId = decodeString(deviceDoc.fields?.installationId);
      if (installationId === deviceId) continue;

      await patchDocument(`push_tokens/${uid}/devices/${deviceId}`, {
        installationId: deviceId,
        updatedAt: Date.now(),
      });
      patched += 1;
    }
  }

  return { scanned, patched };
}

async function run() {
  console.log('=== BACKFILL START ===');

  const inbox = await backfillInboxThreads();
  console.log('Inbox backfill:', inbox);

  const tokens = await normalizePushTokenInstallationIds();
  console.log('Push token installationId normalization:', tokens);

  console.log('=== BACKFILL COMPLETE ===');
}

run().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
