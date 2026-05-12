#!/usr/bin/env node
 
const fs = require('fs');
const https = require('https');

const PROJECT_ID = 'afetnet-4a6b6';
const APPLY_MODE = process.argv.includes('--apply');
const PAGE_SIZE = 200;

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
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 30000;
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    let attempt = 0;

    const run = () => {
      attempt += 1;
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
          } catch (parseError) {
            if (attempt < MAX_RETRIES) {
              setTimeout(run, attempt * 500);
              return;
            }
            reject(new Error(`Non-JSON response: ${data}`));
            return;
          }

          if (res.statusCode >= 500 && attempt < MAX_RETRIES) {
            setTimeout(run, attempt * 500);
            return;
          }

          if (res.statusCode >= 400) {
            const msg = parsed?.error?.message || `HTTP ${res.statusCode}`;
            const err = new Error(msg);
            err.statusCode = res.statusCode;
            err.payload = parsed;
            reject(err);
            return;
          }

          resolve(parsed);
        });
      });

      req.setTimeout(TIMEOUT_MS, () => {
        req.destroy(new Error(`Request timeout after ${TIMEOUT_MS}ms`));
      });

      req.on('error', (error) => {
        if (attempt < MAX_RETRIES) {
          setTimeout(run, attempt * 500);
          return;
        }
        reject(error);
      });

      if (payload) req.write(payload);
      req.end();
    };

    run();
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

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return !!value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) {
    const n = Number(value.integerValue);
    return Number.isFinite(n) ? n : 0;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) {
    const n = Number(value.doubleValue);
    return Number.isFinite(n) ? n : 0;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) {
    const raw = value.arrayValue?.values;
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => decodeValue(item));
  }
  if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) {
    const out = {};
    const fields = value.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeValue(v);
    }
    return out;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;
  if (Object.prototype.hasOwnProperty.call(value, 'bytesValue')) return value.bytesValue;
  return null;
}

function decodeFields(fields) {
  const out = {};
  const input = fields || {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = decodeValue(v);
  }
  return out;
}

function docIdFromName(name) {
  return String(name || '').split('/').pop() || '';
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

async function listDocuments(collectionPath) {
  let pageToken = '';
  const docs = [];

  while (true) {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const path = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}?pageSize=${PAGE_SIZE}${tokenParam}`;
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
  if (fieldPaths.length === 0) return null;
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

async function deleteDocument(docPath) {
  const path = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
  return requestApi({ hostname: 'firestore.googleapis.com', path, method: 'DELETE' });
}

function summarizeConversation(doc) {
  const id = docIdFromName(doc.name);
  const fields = decodeFields(doc.fields);
  const type = typeof fields.type === 'string' ? fields.type : '';
  const participants = Array.isArray(fields.participants)
    ? fields.participants.filter((p) => typeof p === 'string' && p.trim().length > 0)
    : [];
  const pairKey = typeof fields.pairKey === 'string' ? fields.pairKey : '';
  const createdAt = isFiniteNumber(fields.createdAt) ? fields.createdAt : Number.MAX_SAFE_INTEGER;
  const updatedAt = isFiniteNumber(fields.updatedAt) ? fields.updatedAt : 0;
  const lastMessageAt = isFiniteNumber(fields.lastMessageAt) ? fields.lastMessageAt : 0;

  return {
    id,
    raw: doc,
    fields,
    type,
    participants,
    pairKey,
    createdAt,
    updatedAt,
    lastMessageAt,
  };
}

function pickCanonical(conversations) {
  const sorted = [...conversations].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id.localeCompare(b.id);
  });
  return sorted[0];
}

async function mergeDuplicateGroup(group, stats) {
  const canonical = pickCanonical(group);
  const duplicates = group.filter((c) => c.id !== canonical.id);
  if (duplicates.length === 0) return;

  const allConversations = [canonical, ...duplicates];
  const participants = Array.from(
    new Set(
      allConversations.flatMap((c) => c.participants).filter((uid) => typeof uid === 'string' && uid.length > 0),
    ),
  );

  let latestMeta = {
    lastMessageAt: 0,
    lastMessage: '',
    lastMessagePreview: '',
    lastMessageSenderName: '',
    updatedAt: 0,
  };

  for (const conv of allConversations) {
    const at = isFiniteNumber(conv.fields.lastMessageAt) ? conv.fields.lastMessageAt : 0;
    if (at >= latestMeta.lastMessageAt) {
      latestMeta = {
        lastMessageAt: at,
        lastMessage: typeof conv.fields.lastMessage === 'string' ? conv.fields.lastMessage : '',
        lastMessagePreview: typeof conv.fields.lastMessagePreview === 'string' ? conv.fields.lastMessagePreview : '',
        lastMessageSenderName: typeof conv.fields.lastMessageSenderName === 'string' ? conv.fields.lastMessageSenderName : '',
        updatedAt: isFiniteNumber(conv.fields.updatedAt) ? conv.fields.updatedAt : 0,
      };
    }
  }

  stats.groupsProcessed += 1;
  stats.duplicateConversations += duplicates.length;

  for (const duplicateConv of duplicates) {
    const duplicateMessages = await listDocuments(`conversations/${duplicateConv.id}/messages`);
    stats.messagesScanned += duplicateMessages.length;

    for (const messageDoc of duplicateMessages) {
      const messageId = docIdFromName(messageDoc.name);
      const messageFields = decodeFields(messageDoc.fields);
      const targetPath = `conversations/${canonical.id}/messages/${messageId}`;
      const existing = await getDocument(targetPath);
      if (!existing) {
        if (APPLY_MODE) {
          await patchDocument(targetPath, messageFields);
        }
        stats.messagesCopied += 1;
      } else {
        stats.messageIdCollisions += 1;
      }
    }

    for (const uid of participants) {
      const dupThreadPath = `user_inbox/${uid}/threads/${duplicateConv.id}`;
      const dupThread = await getDocument(dupThreadPath);
      const dupFields = decodeFields(dupThread?.fields);
      const canonicalThreadPath = `user_inbox/${uid}/threads/${canonical.id}`;
      const canonicalThread = await getDocument(canonicalThreadPath);
      const canonicalFields = decodeFields(canonicalThread?.fields);

      const unreadCount = (isFiniteNumber(canonicalFields.unreadCount) ? canonicalFields.unreadCount : 0)
        + (isFiniteNumber(dupFields.unreadCount) ? dupFields.unreadCount : 0);
      const lastMessageAt = Math.max(
        isFiniteNumber(canonicalFields.lastMessageAt) ? canonicalFields.lastMessageAt : 0,
        isFiniteNumber(dupFields.lastMessageAt) ? dupFields.lastMessageAt : 0,
        latestMeta.lastMessageAt,
      );

      const patchPayload = {
        conversationId: canonical.id,
        conversationType: 'dm',
        isGroup: false,
        participants,
        unreadCount,
        lastMessageAt,
        lastMessagePreview: canonicalFields.lastMessagePreview || dupFields.lastMessagePreview || latestMeta.lastMessagePreview || latestMeta.lastMessage || '',
        lastMessageSenderName: canonicalFields.lastMessageSenderName || dupFields.lastMessageSenderName || latestMeta.lastMessageSenderName || '',
        schemaVersion: 3,
        updatedAt: Date.now(),
      };

      if (APPLY_MODE) {
        await patchDocument(canonicalThreadPath, patchPayload);
      }
      stats.inboxPatched += 1;

      if (dupThread) {
        if (APPLY_MODE) {
          await deleteDocument(dupThreadPath);
        }
        stats.duplicateInboxDeleted += 1;
      }
    }

    if (APPLY_MODE) {
      for (const messageDoc of duplicateMessages) {
        const messageId = docIdFromName(messageDoc.name);
        await deleteDocument(`conversations/${duplicateConv.id}/messages/${messageId}`);
      }
      await deleteDocument(`conversations/${duplicateConv.id}`);
    }
    stats.duplicateConversationDeleted += 1;
  }

  const canonicalPatch = {
    type: 'dm',
    pairKey: canonical.pairKey,
    participants,
    lastMessageAt: latestMeta.lastMessageAt || canonical.lastMessageAt || Date.now(),
    lastMessage: latestMeta.lastMessage || canonical.fields.lastMessage || '',
    lastMessagePreview: latestMeta.lastMessagePreview || canonical.fields.lastMessagePreview || latestMeta.lastMessage || '',
    lastMessageSenderName: latestMeta.lastMessageSenderName || canonical.fields.lastMessageSenderName || '',
    updatedAt: Date.now(),
    schemaVersion: 3,
  };

  if (APPLY_MODE) {
    await patchDocument(`conversations/${canonical.id}`, canonicalPatch);
  }
  stats.canonicalConversationPatched += 1;
}

async function run() {
  console.log(`=== DUPLICATE DM MERGE START (${APPLY_MODE ? 'APPLY' : 'DRY-RUN'}) ===`);

  const conversationsRaw = await listDocuments('conversations');
  const conversations = conversationsRaw.map((doc) => summarizeConversation(doc));

  const dmConversations = conversations.filter((c) => {
    if (!c.pairKey) return false;
    if (c.type === 'group') return false;
    if (c.id.startsWith('grp_')) return false;
    return true;
  });

  const groupsByPairKey = new Map();
  for (const conv of dmConversations) {
    if (!groupsByPairKey.has(conv.pairKey)) groupsByPairKey.set(conv.pairKey, []);
    groupsByPairKey.get(conv.pairKey).push(conv);
  }

  const duplicateGroups = Array.from(groupsByPairKey.values()).filter((items) => items.length > 1);
  const stats = {
    conversationsTotal: conversations.length,
    dmConversationsTotal: dmConversations.length,
    duplicateGroupsFound: duplicateGroups.length,
    groupsProcessed: 0,
    duplicateConversations: 0,
    messagesScanned: 0,
    messagesCopied: 0,
    messageIdCollisions: 0,
    inboxPatched: 0,
    duplicateInboxDeleted: 0,
    canonicalConversationPatched: 0,
    duplicateConversationDeleted: 0,
  };

  console.log(`Found ${duplicateGroups.length} duplicate DM group(s).`);
  if (duplicateGroups.length === 0) {
    console.log(JSON.stringify(stats, null, 2));
    console.log('=== DUPLICATE DM MERGE COMPLETE ===');
    return;
  }

  for (const group of duplicateGroups) {
    const canonical = pickCanonical(group);
    const sampleIds = group.map((c) => c.id).slice(0, 10);
    console.log(`- pairKey=${canonical.pairKey} count=${group.length} canonical=${canonical.id}`);
    console.log(`  sampleIds=${sampleIds.join(',')}`);
  }

  for (const group of duplicateGroups) {
    const canonical = pickCanonical(group);
    console.log(`Processing pairKey=${canonical.pairKey} -> canonical=${canonical.id} (${group.length} convs)`);
    await mergeDuplicateGroup(group, stats);
  }

  const reportPath = `reports/dm-duplicate-merge-${Date.now()}.json`;
  try {
    fs.writeFileSync(reportPath, JSON.stringify({
      mode: APPLY_MODE ? 'apply' : 'dry-run',
      generatedAt: new Date().toISOString(),
      stats,
    }, null, 2));
    console.log(`Report written: ${reportPath}`);
  } catch (error) {
    console.warn(`Could not write report file: ${error.message || error}`);
  }

  console.log(JSON.stringify(stats, null, 2));
  console.log('=== DUPLICATE DM MERGE COMPLETE ===');
}

run().catch((error) => {
  console.error('Duplicate DM merge failed:', error);
  process.exit(1);
});
