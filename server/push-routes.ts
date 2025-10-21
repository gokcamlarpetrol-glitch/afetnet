import express from 'express';
import http2 from 'node:http2';
import admin from 'firebase-admin';

type TokenType = 'ios' | 'fcm';

interface DeviceToken {
  token: string;
  type: TokenType;
  provinces: string[];
  createdAt: number;
}

const router = express.Router();

// In-memory registry (for production, persist in DB)
const registry = new Map<string, DeviceToken>();

// Middleware: org secret
router.use((req, res, next) => {
  const orgSecret = req.header('x-org-secret');
  if (!process.env.ORG_SECRET || orgSecret !== process.env.ORG_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
});

router.get('/health', (req, res) => {
  res.json({ ok: true, total: registry.size });
});

router.post('/register', (req, res) => {
  const { token, type, provinces } = req.body || {};
  if (!token || !type) {
    return res.status(400).json({ ok: false, error: 'token and type required' });
  }
  const entry: DeviceToken = {
    token,
    type: type === 'ios' ? 'ios' : 'fcm',
    provinces: Array.isArray(provinces) ? provinces : [],
    createdAt: Date.now(),
  };
  registry.set(token, entry);
  res.json({ ok: true });
});

router.post('/unregister', (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ ok: false, error: 'token required' });
  registry.delete(token);
  res.json({ ok: true });
});

router.get('/tick', async (req, res) => {
  const message = {
    title: 'AfetNet Test',
    body: 'Deprem bildirim sistemi çalışıyor',
  };
  let sent = 0;
  for (const entry of registry.values()) {
    try {
      if (entry.type === 'ios') {
        await sendApns(entry.token, message.title, message.body);
      } else {
        await sendFcm(entry.token, message.title, message.body);
      }
      sent++;
    } catch (e) {
      // continue
    }
  }
  res.json({ ok: true, sent, total: registry.size });
});

// Initialize Firebase Admin once
let adminInitialized = false;
function ensureAdmin() {
  if (adminInitialized) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) return; // allow iOS-only mode
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  adminInitialized = true;
}

async function sendFcm(token: string, title: string, body: string) {
  ensureAdmin();
  if (!adminInitialized) {
    console.warn('Firebase Admin not configured, skipping FCM send');
    return;
  }
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: { type: 'quake-test' },
      android: { priority: 'high' },
    });
    console.log('✅ FCM sent to', token.substring(0, 6));
  } catch (error) {
    console.error('❌ FCM send failed:', error);
    throw error;
  }
}

function nowJwt(): string {
  // Create APNs JWT using ES256
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: process.env.APNS_KEY_ID, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const crypto = require('node:crypto');
  const key = (process.env.APNS_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const sign = crypto.createSign('sha256');
  sign.update(unsigned);
  sign.end();
  const signature = sign.sign({ key, format: 'pem', dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${unsigned}.${signature}`;
}

async function sendApns(deviceToken: string, title: string, body: string) {
  if (!process.env.APNS_BUNDLE_ID || !process.env.APNS_KEY_ID || !process.env.APNS_TEAM_ID || !process.env.APNS_PRIVATE_KEY) {
    console.warn('APNs credentials not configured, skipping APNs send');
    return;
  }
  
  try {
    const host = 'api.push.apple.com';
    const client = http2.connect(`https://${host}`);
    const jwt = nowJwt();
    const path = `/3/device/${deviceToken}`;
    const req = client.request({
      ':method': 'POST',
      ':path': path,
      'authorization': `bearer ${jwt}`,
      'apns-topic': process.env.APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });
    const payload = JSON.stringify({
      aps: { alert: { title, body }, sound: 'default', badge: 1 },
      meta: { t: Date.now() }
    });
    req.end(payload);
    await new Promise<void>((resolve, reject) => {
      req.on('response', (headers) => {
        const status = headers[':status'];
        if (status === 200) {
          console.log('✅ APNs sent to', deviceToken.substring(0, 6));
        } else {
          console.error('❌ APNs failed with status:', status);
        }
        resolve();
      });
      req.on('error', (err) => {
        console.error('❌ APNs request error:', err);
        reject(err);
      });
    });
    client.close();
  } catch (error) {
    console.error('❌ APNs send failed:', error);
    throw error;
  }
}

export default router;


