require('dotenv').config(); // load .env (local dev); on hosts, use real env vars
const express = require('express');
const path = require('path');
const db = require('./db');

const requireAuth = require('./middleware/requireAuth');

const app = express();
const PORT = process.env.PORT || 4173;

// Behind Render/Fly's proxy, trust one hop so req.ip is the real client (for rate limiting)
// and the Secure cookie flag is set correctly in production.
app.set('trust proxy', 1);

app.use(require('./middleware/securityHeaders'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Cheap public health check — used by an uptime pinger to keep a free host awake.
app.get('/healthz', (req, res) => res.json({ ok: true }));

// Public, read-only shared reports (token in the URL) — no auth.
app.use('/share', require('./routes/publicShare'));

app.use('/api/auth', require('./routes/auth'));
app.use(requireAuth);

app.use('/uploads', require('./routes/uploads'));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/projects', require('./routes/projects'));
app.use('/api', require('./routes/findings'));
app.use('/api', require('./routes/report'));
app.use('/api/meta', require('./routes/meta'));
app.use('/api/export', require('./routes/export'));
app.use('/api/import', require('./routes/importScan'));
app.use('/api/admin', require('./routes/admin'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const { seedAdmins } = require('./utils/userAuth');

db.initDb()
  .then(() => seedAdmins())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`VAPT Report Builder running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
