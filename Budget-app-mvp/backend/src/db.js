const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'budget.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
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
  date TEXT NOT NULL, -- YYYY-MM-DD
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount REAL NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  store TEXT,
  note TEXT,
  payment_method TEXT DEFAULT 'debit', -- cash | debit | credit
  source TEXT DEFAULT 'manual', -- manual | statement_import
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monthly_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  income_sources TEXT NOT NULL DEFAULT '[]', -- JSON array of {name, amount}
  savings_goal_type TEXT NOT NULL DEFAULT 'fixed', -- fixed | percent
  savings_goal_value REAL NOT NULL DEFAULT 0,
  UNIQUE(year, month)
);

CREATE INDEX IF NOT EXISTS idx_transactions_year_month ON transactions(year, month);
CREATE INDEX IF NOT EXISTS idx_budgets_year_month ON budgets(year, month);
`);

// Seed default categories if empty
const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
if (catCount === 0) {
  const insertCat = db.prepare(
    'INSERT INTO categories (name, type, color, sort_order) VALUES (?, ?, ?, ?)'
  );
  const defaults = [
    // Necessary
    ['Mortgage / Rent', 'necessary', '#ef4444', 1],
    ['Electricity', 'necessary', '#f97316', 2],
    ['Water / Gas', 'necessary', '#f59e0b', 3],
    ['Car Payment', 'necessary', '#eab308', 4],
    ['Insurance', 'necessary', '#84cc16', 5],
    ['Phone / Internet', 'necessary', '#22c55e', 6],
    ['Minimum Debt Payments', 'necessary', '#10b981', 7],
    ['Subscriptions', 'necessary', '#14b8a6', 8],
    // Discretionary
    ['Groceries', 'discretionary', '#06b6d4', 10],
    ['Restaurants / Dining', 'discretionary', '#0ea5e9', 11],
    ['Entertainment', 'discretionary', '#3b82f6', 12],
    ['Transportation', 'discretionary', '#6366f1', 13],
    ['Personal Care', 'discretionary', '#8b5cf6', 14],
    ['Travel', 'discretionary', '#a855f7', 15],
    ['Gifts / Miscellaneous', 'discretionary', '#d946ef', 16],
    // Savings
    ['Savings', 'savings', '#ec4899', 20],
  ];
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insertCat.run(...r);
  });
  insertMany(defaults);
}

// Seed preset stores if empty
const storeCount = db.prepare('SELECT COUNT(*) as c FROM stores').get().c;
if (storeCount === 0) {
  const groceries = db.prepare("SELECT id FROM categories WHERE name = 'Groceries'").get();
  const misc = db.prepare("SELECT id FROM categories WHERE name = 'Gifts / Miscellaneous'").get();
  const entertainment = db.prepare("SELECT id FROM categories WHERE name = 'Entertainment'").get();
  const transportation = db.prepare("SELECT id FROM categories WHERE name = 'Transportation'").get();
  const dining = db.prepare("SELECT id FROM categories WHERE name = 'Restaurants / Dining'").get();

  const insertStore = db.prepare(
    'INSERT INTO stores (name, default_category_id, is_preset, sort_order) VALUES (?, ?, 1, ?)'
  );
  const presets = [
    ['Costco', groceries?.id, 1],
    ['Walmart', groceries?.id, 2],
    ['Target', misc?.id, 3],
    ['Kroger', groceries?.id, 4],
    ['Amazon', misc?.id, 5],
    ['Whole Foods', groceries?.id, 6],
    ['Starbucks', dining?.id, 7],
    ['Chipotle', dining?.id, 8],
    ['Uber / Lyft', transportation?.id, 9],
    ['Gas Station', transportation?.id, 10],
    ['Netflix', entertainment?.id, 11],
  ];
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insertStore.run(...r);
  });
  insertMany(presets);
}

module.exports = db;
