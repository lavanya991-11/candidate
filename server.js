const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const candidateRoutes = require('./routes/candidateRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1); // Render terminates TLS in front of the app.

// A browser sends an Origin header on every POST, including same-origin ones, so the
// page this server itself serves must be recognised as its own origin - otherwise the
// built-in form is blocked wherever it is deployed. ALLOWED_ORIGINS is only needed for
// a React app served from somewhere else (Vite on :5173 in development).
function isSameOrigin(req, origin) {
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

app.use(cors((req, callback) => {
  const origin = req.headers.origin;
  const allowed = !origin || isSameOrigin(req, origin) || config.allowedOrigins.includes(origin);

  if (!allowed) {
    return callback(new Error(`Origin ${origin} is not allowed`));
  }
  callback(null, { origin: true, methods: ['GET', 'POST', 'OPTIONS'] });
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', businessCentral: config.bc.describeMode() });
});

app.use('/api', candidateRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}`, code: 'NOT_FOUND' });
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Candidate form running at http://localhost:${config.port}`);
  console.log('Mode:', config.bc.describeMode());
  if (!config.bc.enabled) {
    console.log('Submissions go to data/candidates.json until Business Central is configured.');
  }
  console.log('CORS origins:', config.allowedOrigins.join(', '));
});
