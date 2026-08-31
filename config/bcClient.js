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

async function send(method, path, { data, params, contentType, headers } = {}) {
  return axios({
    method,
    url: apiUrl(path),
    data,
    params,
    // A file goes up in one request, so it gets longer than the JSON calls do.
    timeout: contentType ? 120_000 : 30_000,
    maxBodyLength: Infinity,
    headers: {
      Authorization: await authorizationHeader(),
      'Content-Type': contentType || 'application/json',
      Accept: 'application/json',
      ...headers,
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

// A Blob on an API page is published as an OData stream property, so its content is
// written as raw bytes to the property's own URL rather than as a JSON value. BC
// requires a concurrency header on that write; the line was just created here, so
// there is no other version to lose and "*" is the honest match.
//
// The connection is closed afterwards rather than returned to the keep-alive pool.
// Node reuses sockets by default, and after this upload the next request on the same
// socket fails to parse the response it reads back.
function putStream(path, buffer, mimeType) {
  return request('patch', path, {
    data: buffer,
    contentType: mimeType || 'application/octet-stream',
    headers: { 'If-Match': '*', Connection: 'close' },
  });
}

module.exports = {
  request, putStream, apiUrl, getAccessToken, authorizationHeader,
};
