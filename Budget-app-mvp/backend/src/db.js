const { createClient } = require('@libsql/client');
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

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('necessary','discretionary','savings')),
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  default_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  is_preset INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount REAL NOT NULL DEFAULT 0,
  UNIQUE(year, month, category_id)
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
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monthly_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  income_sources TEXT NOT NULL DEFAULT '[]',
  savings_goal_type TEXT NOT NULL DEFAULT 'fixed',
  savings_goal_value REAL NOT NULL DEFAULT 0,
  UNIQUE(year, month)
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

async function init() {
  await db.executeMultiple(SCHEMA);

  const { rows: catRows } = await db.execute('SELECT COUNT(*) as c FROM categories');
  if (Number(catRows[0].c) === 0) {
    const stmts = DEFAULT_CATEGORIES.map((r) => ({
      sql: 'INSERT INTO categories (name, type, color, sort_order) VALUES (?, ?, ?, ?)',
      args: r,
    }));
    await db.batch(stmts, 'write');
  }

  const { rows: storeRows } = await db.execute('SELECT COUNT(*) as c FROM stores');
  if (Number(storeRows[0].c) === 0) {
    const catId = async (name) => {
      const { rows } = await db.execute({
        sql: 'SELECT id FROM categories WHERE name = ?',
        args: [name],
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
    const stmts = presets.map((r) => ({
      sql: 'INSERT INTO stores (name, default_category_id, is_preset, sort_order) VALUES (?, ?, 1, ?)',
      args: r,
    }));
    await db.batch(stmts, 'write');
  }
}

const ready = init();

module.exports = { db, ready };
