const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const candidateRoutes = require('./routes/candidateRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// The React app runs on its own origin in development (Vite on :5173), so it needs
// an explicit CORS allowance. Same-origin requests carry no Origin header and pass.
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} is not allowed`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
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
