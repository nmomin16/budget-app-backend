const express = require('express');
const cors = require('cors');
const { ready } = require('./db'); // ensures DB schema/seed is initialized
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

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
