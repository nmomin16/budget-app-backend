const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, ready, createUser, seedDefaultsForUser, num } = require('./db');

const router = express.Router();

router.use((req, res, next) => {
  ready.then(() => next()).catch(next);
});

function cleanUsername(raw) {
  return String(raw || '').trim().toLowerCase();
}

router.post('/signup', async (req, res, next) => {
  try {
    const username = cleanUsername(req.body.username);
    const password = String(req.body.password || '');
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'password must be at least 4 characters' });
    }
    const { rows } = await db.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] });
    if (rows.length) {
      return res.status(400).json({ error: 'that username is already taken' });
    }
    const userId = await createUser(username, password);
    await seedDefaultsForUser(userId);

    const token = crypto.randomBytes(24).toString('hex');
    await db.execute({ sql: 'INSERT INTO sessions (token, user_id) VALUES (?, ?)', args: [token, userId] });
    res.json({ token, user: { id: userId, username } });
  } catch (e) {
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const username = cleanUsername(req.body.username);
    const password = String(req.body.password || '');
    const { rows } = await db.execute({
      sql: 'SELECT * FROM users WHERE username = ?',
      args: [username],
    });
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'invalid username or password' });
    }
    const userId = num(user.id);
    const token = crypto.randomBytes(24).toString('hex');
    await db.execute({ sql: 'INSERT INTO sessions (token, user_id) VALUES (?, ?)', args: [token, userId] });
    res.json({ token, user: { id: userId, username: user.username } });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const authHeader = req.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token) await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Middleware for every other /api route: resolves the session token into
// req.userId, or rejects with 401. Mount this after the /auth routes above
// so signup/login/logout don't require a token themselves.
async function requireAuth(req, res, next) {
  try {
    await ready;
    const authHeader = req.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'not logged in' });
    const { rows } = await db.execute({
      sql: 'SELECT user_id FROM sessions WHERE token = ?',
      args: [token],
    });
    if (!rows.length) return res.status(401).json({ error: 'session expired, please log in again' });
    req.userId = num(rows[0].user_id);
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { router, requireAuth };
