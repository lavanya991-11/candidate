const axios = require('axios');
const config = require('./index');

const { bc } = config;

let cachedToken = null;   // { value, expiresAt }
let inFlightToken = null; // de-duplicates concurrent token requests

function clearToken() {
  cachedToken = null;
  inFlightToken = null;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  // Several form submits can land at once; only one token request should go out.
  if (inFlightToken) return inFlightToken;

  inFlightToken = fetchToken().finally(() => { inFlightToken = null; });
  return inFlightToken;
}

async function fetchToken() {
  const url = `https://login.microsoftonline.com/${bc.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: bc.clientId,
    client_secret: bc.clientSecret,
    scope: bc.scope,
  });

  const { data } = await axios.post(url, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15_000,
  });

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

// On-premises uses the web service access key as a basic-auth password, so there is
// no client id / secret and no token round trip.
function basicAuthHeader() {
  const encoded = Buffer.from(`${bc.username}:${bc.webServiceKey}`).toString('base64');
  return `Basic ${encoded}`;
}

async function authorizationHeader() {
  if (bc.authMode === 'basic') return basicAuthHeader();
  return `Bearer ${await getAccessToken()}`;
}

function apiUrl(path = '') {
  const apiPath = [bc.apiPath, `companies(${bc.companyId})`, path];

  const segments = bc.deployment === 'onprem'
    ? [bc.baseUrl, ...apiPath]
    : [bc.baseUrl, 'v2.0', bc.tenantId, bc.environment, ...apiPath];

  return segments.filter(Boolean).join('/');
}

async function send(method, path, { data, params } = {}) {
  return axios({
    method,
    url: apiUrl(path),
    data,
    params,
    timeout: 30_000,
    headers: {
      Authorization: await authorizationHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

async function request(method, path, options = {}) {
  try {
    const response = await send(method, path, options);
    return response.data;
  } catch (err) {
    // A cached token can be revoked before it expires; drop it and try once more.
    if (err.response?.status === 401 && bc.authMode === 'oauth') {
      clearToken();
      const response = await send(method, path, options);
      return response.data;
    }
    throw err;
  }
}

module.exports = { request, apiUrl, getAccessToken, authorizationHeader };
