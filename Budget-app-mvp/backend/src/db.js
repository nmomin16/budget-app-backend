const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// In production (Render), set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN as env vars
// and data lives in your free Turso database (survives restarts/redeploys).
// Locally, with no env vars set, this falls back to a plain file on disk.
let url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  url = `file:${path.join(dataDir, 'budget.db')}`;
}

const db = createClient(url.startsWith('file:') ? { url } : { url, authToken });

// The username/password created (once) for whoever already had data in this
// database before accounts existed, so their existing budget isn't lost.
const DEFAULT_OWNER_USERNAME = 'nabeel';
const DEFAULT_OWNER_PASSWORD = 'budget123';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('necessary','discretionary','savings')),
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  user_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  default_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  is_preset INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  user_id INTEGER REFERENCES users(id),
  UNIQUE(name, user_id)
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount REAL NOT NULL DEFAULT 0,
  user_id INTEGER REFERENCES users(id),
  UNIQUE(year, month, category_id)
);

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  store TEXT,
  amount REAL NOT NULL,
  note TEXT,
  payment_method TEXT DEFAULT 'debit',
  day_of_month INTEGER NOT NULL DEFAULT 1,
  start_year INTEGER NOT NULL,
  start_month INTEGER NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount REAL NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  store TEXT,
  note TEXT,
  payment_method TEXT DEFAULT 'debit',
  source TEXT DEFAULT 'manual',
  recurring_id INTEGER REFERENCES recurring_transactions(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS monthly_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  income_sources TEXT NOT NULL DEFAULT '[]',
  savings_goal_type TEXT NOT NULL DEFAULT 'fixed',
  savings_goal_value REAL NOT NULL DEFAULT 0,
  user_id INTEGER REFERENCES users(id),
  UNIQUE(year, month, user_id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_year_month ON transactions(year, month);
CREATE INDEX IF NOT EXISTS idx_budgets_year_month ON budgets(year, month);
`;

const DEFAULT_CATEGORIES = [
  ['Mortgage / Rent', 'necessary', '#ef4444', 1],
  ['Electricity', 'necessary', '#f97316', 2],
  ['Water / Gas', 'necessary', '#f59e0b', 3],
  ['Car Payment', 'necessary', '#eab308', 4],
  ['Insurance', 'necessary', '#84cc16', 5],
  ['Phone / Internet', 'necessary', '#22c55e', 6],
  ['Minimum Debt Payments', 'necessary', '#10b981', 7],
  ['Subscriptions', 'necessary', '#14b8a6', 8],
  ['Groceries', 'discretionary', '#06b6d4', 10],
  ['Restaurants / Dining', 'discretionary', '#0ea5e9', 11],
  ['Entertainment', 'discretionary', '#3b82f6', 12],
  ['Transportation', 'discretionary', '#6366f1', 13],
  ['Personal Care', 'discretionary', '#8b5cf6', 14],
  ['Travel', 'discretionary', '#a855f7', 15],
  ['Gifts / Miscellaneous', 'discretionary', '#d946ef', 16],
  ['Savings', 'savings', '#ec4899', 20],
];

function num(x) {
  return typeof x === 'bigint' ? Number(x) : x;
}

async function ensureColumn(table, column, ddl) {
  const { rows } = await db.execute(`PRAGMA table_info(${table})`);
  const exists = rows.some((r) => r.name === column);
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

// SQLite can't drop/alter a UNIQUE constraint in place, so a table that had a
// too-narrow UNIQUE before multi-user support (stores.name, or
// monthly_settings(year, month)) needs to be rebuilt with the wider
// constraint. Safe to call every startup — it checks the live schema text
// and does nothing once already migrated.
async function rebuildTableWithNewSchema(table, createSql, columns) {
  const { rows } = await db.execute({
    sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
    args: [table],
  });
  const liveSql = rows[0]?.sql || '';
  if (liveSql.includes('user_id') && /UNIQUE\([^)]*user_id[^)]*\)/.test(liveSql)) return;

  await db.executeMultiple(`
    ${createSql.replace(new RegExp(`\\b${table}\\b`), `${table}_new`)}
    INSERT INTO ${table}_new (${columns.join(', ')})
      SELECT ${columns.join(', ')} FROM ${table};
    DROP TABLE ${table};
    ALTER TABLE ${table}_new RENAME TO ${table};
  `);
}

async function seedDefaultsForUser(userId) {
  const stmts = DEFAULT_CATEGORIES.map((r) => ({
    sql: 'INSERT INTO categories (name, type, color, sort_order, user_id) VALUES (?, ?, ?, ?, ?)',
    args: [...r, userId],
  }));
  await db.batch(stmts, 'write');

  const catId = async (name) => {
    const { rows } = await db.execute({
      sql: 'SELECT id FROM categories WHERE name = ? AND user_id = ?',
      args: [name, userId],
    });
    return rows[0]?.id ?? null;
  };
  const groceries = await catId('Groceries');
  const misc = await catId('Gifts / Miscellaneous');
  const entertainment = await catId('Entertainment');
  const transportation = await catId('Transportation');
  const dining = await catId('Restaurants / Dining');

  const presets = [
    ['Costco', groceries, 1],
    ['Walmart', groceries, 2],
    ['Target', misc, 3],
    ['Kroger', groceries, 4],
    ['Amazon', misc, 5],
    ['Whole Foods', groceries, 6],
    ['Starbucks', dining, 7],
    ['Chipotle', dining, 8],
    ['Uber / Lyft', transportation, 9],
    ['Gas Station', transportation, 10],
    ['Netflix', entertainment, 11],
  ];
  const storeStmts = presets.map((r) => ({
    sql: 'INSERT INTO stores (name, default_category_id, is_preset, sort_order, user_id) VALUES (?, ?, 1, ?, ?)',
    args: [r[0], r[1], r[2], userId],
  }));
  await db.batch(storeStmts, 'write');
}

async function createUser(username, password) {
  const hash = bcrypt.hashSync(password, 8);
  const result = await db.execute({
    sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?)',
    args: [username, hash],
  });
  return num(result.lastInsertRowid);
}

async function init() {
  await db.executeMultiple(SCHEMA);

  // Migrations for databases created before multi-user support existed.
  for (const t of ['categories', 'stores', 'budgets', 'recurring_transactions', 'transactions', 'monthly_settings']) {
    await ensureColumn(t, 'user_id', 'user_id INTEGER REFERENCES users(id)');
  }
  await ensureColumn(
    'transactions',
    'recurring_id',
    'recurring_id INTEGER REFERENCES recurring_transactions(id) ON DELETE SET NULL'
  );
  await db.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_month ON transactions(recurring_id, year, month) WHERE recurring_id IS NOT NULL'
  );

  await rebuildTableWithNewSchema(
    'stores',
    `CREATE TABLE stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      default_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      is_preset INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      user_id INTEGER REFERENCES users(id),
      UNIQUE(name, user_id)
    );`,
    ['id', 'name', 'default_category_id', 'is_preset', 'sort_order', 'archived', 'user_id']
  );

  await rebuildTableWithNewSchema(
    'monthly_settings',
    `CREATE TABLE monthly_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      income_sources TEXT NOT NULL DEFAULT '[]',
      savings_goal_type TEXT NOT NULL DEFAULT 'fixed',
      savings_goal_value REAL NOT NULL DEFAULT 0,
      user_id INTEGER REFERENCES users(id),
      UNIQUE(year, month, user_id)
    );`,
    ['id', 'year', 'month', 'income_sources', 'savings_goal_type', 'savings_goal_value', 'user_id']
  );

  // If no accounts exist yet, this database predates logins. Create the
  // original owner's account and hand them everything that was already in
  // here (rows with no user_id), so nothing is lost.
  const { rows: userRows } = await db.execute('SELECT COUNT(*) as c FROM users');
  if (Number(userRows[0].c) === 0) {
    const ownerId = await createUser(DEFAULT_OWNER_USERNAME, DEFAULT_OWNER_PASSWORD);
    for (const t of ['categories', 'stores', 'budgets', 'recurring_transactions', 'transactions', 'monthly_settings']) {
      await db.execute({ sql: `UPDATE ${t} SET user_id = ? WHERE user_id IS NULL`, args: [ownerId] });
    }
    const { rows: catRows } = await db.execute({
      sql: 'SELECT COUNT(*) as c FROM categories WHERE user_id = ?',
      args: [ownerId],
    });
    if (Number(catRows[0].c) === 0) {
      await seedDefaultsForUser(ownerId);
    }
  }
}

const ready = init();

module.exports = { db, ready, seedDefaultsForUser, createUser, num };
