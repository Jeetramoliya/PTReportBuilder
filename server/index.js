const express = require('express');
const path = require('path');
require('./db'); // ensures schema is created
const { UPLOADS_DIR } = require('./paths');

const requireAuth = require('./middleware/requireAuth');

const app = express();
const PORT = process.env.PORT || 4173;

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./routes/auth'));
app.use(requireAuth);

app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/projects', require('./routes/projects'));
app.use('/api', require('./routes/findings'));
app.use('/api', require('./routes/report'));
app.use('/api/meta', require('./routes/meta'));
app.use('/api/export', require('./routes/export'));
app.use('/api/import', require('./routes/importScan'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`VAPT Report Builder running at http://localhost:${PORT}`);
});
