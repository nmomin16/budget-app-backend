const express = require('express');
const cors = require('cors');
require('./db'); // ensures DB is initialized/seeded
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Budget app backend listening on http://localhost:${PORT}`);
});
