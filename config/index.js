require('dotenv').config();

// oauth  - Entra ID client credentials (BC SaaS; needs BC_CLIENT_ID + BC_CLIENT_SECRET)
// basic  - username + web service access key (BC on-premises only)
const authMode = (process.env.BC_AUTH_MODE || 'oauth').toLowerCase();

// cloud  - .../v2.0/{tenant}/{environment}/api/...
// onprem - {baseUrl}/api/...   (baseUrl already includes the server instance)
const deployment = (process.env.BC_DEPLOYMENT || (authMode === 'basic' ? 'onprem' : 'cloud')).toLowerCase();

// Origins allowed to call the API from a browser (the React dev server, mainly).
const allowedOrigins = (process.env.ALLOWED_ORIGINS ||
  'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const config = {
  port: Number(process.env.PORT) || 3000,
  allowedOrigins,
  bc: {
    authMode,
    deployment,
    // Trailing slashes and a trailing /v2.0 are stripped: apiUrl() adds the version
    // segment itself, and BC_BASE_URL is commonly copied with it already attached.
    baseUrl: (process.env.BC_BASE_URL || 'https://api.businesscentral.dynamics.com')
      .replace(/\/+$/, '')
      .replace(/\/v2\.0$/i, ''),
    tenantId: process.env.BC_TENANT_ID,
    environment: process.env.BC_ENVIRONMENT || 'Production',
    companyId: process.env.BC_COMPANY_ID,
    clientId: process.env.BC_CLIENT_ID,
    clientSecret: process.env.BC_CLIENT_SECRET,
    username: process.env.BC_USERNAME,
    webServiceKey: process.env.BC_WEB_SERVICE_KEY,
    scope: process.env.BC_SCOPE || 'https://api.businesscentral.dynamics.com/.default',
    publisher: process.env.BC_API_PUBLISHER || 'Novasoft',
    group: process.env.BC_API_GROUP || 'Novasoft',
    version: process.env.BC_API_VERSION || 'v2.0',
  },
};

// BC_API_PATH ("api/Novasoft/Novasoft/v2.0") wins over the three separate settings.
config.bc.apiPath = (
  process.env.BC_API_PATH ||
  `api/${config.bc.publisher}/${config.bc.group}/${config.bc.version}`
).replace(/^\/+|\/+$/g, '');

const { bc } = config;

// Until the settings for the chosen auth mode are all present, the app writes to a
// local JSON file instead, so the form stays usable while BC access is being arranged.
const hasCompany = Boolean(bc.companyId);
const hasCloudPath = bc.deployment === 'onprem' || Boolean(bc.tenantId);

bc.enabled = bc.authMode === 'basic'
  ? Boolean(hasCompany && bc.username && bc.webServiceKey)
  : Boolean(hasCompany && hasCloudPath && bc.clientId && bc.clientSecret);

bc.describeMode = () => {
  if (!bc.enabled) return 'local-file mode';
  return bc.authMode === 'basic'
    ? `Business Central on-premises (basic auth as ${bc.username})`
    : 'Business Central SaaS (OAuth client credentials)';
};

module.exports = config;
