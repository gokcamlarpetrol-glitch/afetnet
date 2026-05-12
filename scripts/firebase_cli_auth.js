const fs = require('fs');
const path = require('path');

const FIREBASE_CLIENT_ID =
  process.env.FIREBASE_CLIENT_ID ||
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLIENT_SECRET =
  process.env.FIREBASE_CLIENT_SECRET ||
  'j9iVZfS8kkCEFUPaAeJV0sAi';
const FIREBASE_TOOLS_CONFIG = path.join(
  process.env.HOME || '',
  '.config',
  'configstore',
  'firebase-tools.json',
);
const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

function readFirebaseToolsConfig() {
  if (!process.env.HOME) {
    throw new Error('[firebase_cli_auth] HOME env is missing.');
  }
  if (!fs.existsSync(FIREBASE_TOOLS_CONFIG)) {
    throw new Error(
      `[firebase_cli_auth] firebase-tools config not found: ${FIREBASE_TOOLS_CONFIG}`,
    );
  }
  const raw = fs.readFileSync(FIREBASE_TOOLS_CONFIG, 'utf8');
  return JSON.parse(raw);
}

function writeFirebaseToolsConfig(config) {
  fs.writeFileSync(FIREBASE_TOOLS_CONFIG, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function isAccessTokenExpired(tokens) {
  const expiresAt = Number(tokens?.expires_at || 0);
  if (!tokens?.access_token) {
    return true;
  }
  if (!expiresAt || Number.isNaN(expiresAt)) {
    return false;
  }
  return Date.now() + TOKEN_REFRESH_SKEW_MS >= expiresAt;
}

async function refreshAccessToken(config) {
  const refreshToken = config?.tokens?.refresh_token;
  if (!refreshToken) {
    throw new Error(
      '[firebase_cli_auth] refresh_token is missing. Run `firebase login` again.',
    );
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: FIREBASE_CLIENT_ID,
    client_secret: FIREBASE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  }).toString();

  const response = await fetch('https://www.googleapis.com/oauth2/v3/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const details =
      payload?.error_description ||
      payload?.error ||
      payload?.message ||
      'unknown_error';
    throw new Error(
      `[firebase_cli_auth] OAuth refresh failed (${response.status}): ${details}`,
    );
  }

  const expiresInSec = Number(payload.expires_in || 3600);
  config.tokens = {
    ...(config.tokens || {}),
    ...payload,
    expires_at: Date.now() + Math.max(60, expiresInSec) * 1000,
  };
  writeFirebaseToolsConfig(config);

  return config.tokens.access_token;
}

async function getFirebaseCliAccessToken(options = {}) {
  const { forceRefresh = false } = options;
  const config = readFirebaseToolsConfig();
  const tokens = config.tokens || {};

  if (forceRefresh || isAccessTokenExpired(tokens)) {
    return refreshAccessToken(config);
  }

  return tokens.access_token;
}

async function fireRequestWithToken(url, init, token) {
  const headers = {
    ...(init?.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  return fetch(url, { ...(init || {}), headers });
}

async function fetchFirestoreJson(projectId, documentPath, init = {}) {
  const normalizedPath = String(documentPath || '').replace(/^\/+/, '');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${normalizedPath}`;

  let token = await getFirebaseCliAccessToken();
  let response = await fireRequestWithToken(url, init, token);

  if (response.status === 401) {
    token = await getFirebaseCliAccessToken({ forceRefresh: true });
    response = await fireRequestWithToken(url, init, token);
  }

  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    throw new Error(
      '[firebase_cli_auth] Firestore request is still unauthorized after token refresh. Run `firebase login`.',
    );
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

module.exports = {
  FIREBASE_TOOLS_CONFIG,
  fetchFirestoreJson,
  getFirebaseCliAccessToken,
};
