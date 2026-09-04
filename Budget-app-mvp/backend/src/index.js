const express = require('express');
const cors = require('cors');
const { ready } = require('./db'); // ensures DB schema/seed is initialized
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Simple shared-secret gate: every /api request (except /api/health above)
// must send a matching X-API-Key header. Set API_SECRET as an env var in
// Render, and the same value as VITE_API_SECRET when building the frontend.
// If API_SECRET isn't set (e.g. local dev with no env vars), this is skipped.
app.use('/api', (req, res, next) => {
  const expected = process.env.API_SECRET;
  if (!expected) return next();
  if (req.get('X-API-Key') === expected) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

app.use('/api', routes);

// basic error handler so a rejected promise doesn't crash the process
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Budget app backend listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
