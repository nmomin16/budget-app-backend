const express = require('express');
const db = require('./db');

const router = express.Router();

// ---------- helpers ----------
function parseSettings(row) {
  if (!row) return null;
  return {
    ...row,
    income_sources: JSON.parse(row.income_sources || '[]'),
  };
}

function totalIncome(settings) {
  if (!settings) return 0;
  return settings.income_sources.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
}

function savingsGoalAmount(settings) {
  if (!settings) return 0;
  const income = totalIncome(settings);
  if (settings.savings_goal_type === 'percent') {
    return Math.round(((income * settings.savings_goal_value) / 100) * 100) / 100;
  }
  return settings.savings_goal_value;
}

// ---------- years ----------
router.get('/years', (req, res) => {
  const rows = db
    .prepare(
      `SELECT DISTINCT year FROM (
        SELECT year FROM transactions
        UNION
        SELECT year FROM budgets
        UNION
        SELECT year FROM monthly_settings
      ) ORDER BY year DESC`
    )
    .all();
  const years = rows.map((r) => r.year);
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) years.unshift(currentYear);
  res.json(years.sort((a, b) => b - a));
});

// ---------- categories ----------
router.get('/categories', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM categories WHERE archived = 0 ORDER BY type, sort_order, name')
    .all();
  res.json(rows);
});

router.post('/categories', (req, res) => {
  const { name, type, color, sort_order } = req.body;
  if (!name || !['necessary', 'discretionary', 'savings'].includes(type)) {
    return res.status(400).json({ error: 'name and valid type are required' });
  }
  const info = db
    .prepare('INSERT INTO categories (name, type, color, sort_order) VALUES (?, ?, ?, ?)')
    .run(name, type, color || '#6366f1', sort_order || 0);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/categories/:id', (req, res) => {
  const { name, type, color, sort_order } = req.body;
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE categories SET name=?, type=?, color=?, sort_order=? WHERE id=?').run(
    name ?? existing.name,
    type ?? existing.type,
    color ?? existing.color,
    sort_order ?? existing.sort_order,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

router.delete('/categories/:id', (req, res) => {
  db.prepare('UPDATE categories SET archived = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- stores ----------
router.get('/stores', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM stores WHERE archived = 0 ORDER BY sort_order, name')
    .all();
  res.json(rows);
});

router.post('/stores', (req, res) => {
  const { name, default_category_id, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const info = db
      .prepare(
        'INSERT INTO stores (name, default_category_id, is_preset, sort_order) VALUES (?, ?, 0, ?)'
      )
      .run(name, default_category_id || null, sort_order || 99);
    res.json(db.prepare('SELECT * FROM stores WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: 'store already exists' });
  }
});

router.put('/stores/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const { name, default_category_id, sort_order } = req.body;
  db.prepare(
    'UPDATE stores SET name=?, default_category_id=?, sort_order=? WHERE id=?'
  ).run(
    name ?? existing.name,
    default_category_id ?? existing.default_category_id,
    sort_order ?? existing.sort_order,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id));
});

router.delete('/stores/:id', (req, res) => {
  db.prepare('UPDATE stores SET archived = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- monthly settings (income + savings goal) ----------
router.get('/settings/:year/:month', (req, res) => {
  const { year, month } = req.params;
  let row = db
    .prepare('SELECT * FROM monthly_settings WHERE year = ? AND month = ?')
    .get(year, month);

  if (!row) {
    // fall back to most recent prior month's settings, if any, as a starting point
    row = db
      .prepare(
        `SELECT * FROM monthly_settings
         WHERE (year < ?) OR (year = ? AND month < ?)
         ORDER BY year DESC, month DESC LIMIT 1`
      )
      .get(year, year, month);
  }
  const settings = parseSettings(row);
  res.json({
    year: Number(year),
    month: Number(month),
    income_sources: settings?.income_sources || [],
    savings_goal_type: settings?.savings_goal_type || 'fixed',
    savings_goal_value: settings?.savings_goal_value || 0,
    is_inherited: !!row && (row.year != year || row.month != month),
  });
});

router.post('/settings/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const { income_sources, savings_goal_type, savings_goal_value } = req.body;
  const existing = db
    .prepare('SELECT * FROM monthly_settings WHERE year = ? AND month = ?')
    .get(year, month);
  const sourcesJson = JSON.stringify(income_sources || []);
  if (existing) {
    db.prepare(
      'UPDATE monthly_settings SET income_sources=?, savings_goal_type=?, savings_goal_value=? WHERE id=?'
    ).run(sourcesJson, savings_goal_type || 'fixed', savings_goal_value || 0, existing.id);
  } else {
    db.prepare(
      'INSERT INTO monthly_settings (year, month, income_sources, savings_goal_type, savings_goal_value) VALUES (?, ?, ?, ?, ?)'
    ).run(year, month, sourcesJson, savings_goal_type || 'fixed', savings_goal_value || 0);
  }
  res.json({ ok: true });
});

// ---------- budgets ----------
router.get('/budgets/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const categories = db
    .prepare('SELECT * FROM categories WHERE archived = 0 ORDER BY type, sort_order, name')
    .all();
  const budgetRows = db
    .prepare('SELECT * FROM budgets WHERE year = ? AND month = ?')
    .all(year, month);
  const byCategory = Object.fromEntries(budgetRows.map((b) => [b.category_id, b.amount]));

  let inherited = false;
  if (budgetRows.length === 0) {
    const prior = db
      .prepare(
        `SELECT * FROM budgets b
         WHERE (year < ?) OR (year = ? AND month < ?)
         AND year = (SELECT MAX(year) FROM budgets WHERE (year < ?) OR (year = ? AND month < ?))
         ORDER BY month DESC`
      )
      .all(year, year, month, year, year, month);
    if (prior.length) {
      inherited = true;
      for (const b of prior) byCategory[b.category_id] = b.amount;
    }
  }

  const result = categories.map((c) => ({
    ...c,
    budgeted_amount: byCategory[c.id] ?? 0,
  }));
  res.json({ categories: result, is_inherited: inherited });
});

router.post('/budgets/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const { budgets } = req.body; // [{category_id, amount}]
  if (!Array.isArray(budgets)) return res.status(400).json({ error: 'budgets array required' });
  const upsert = db.prepare(
    `INSERT INTO budgets (year, month, category_id, amount) VALUES (?, ?, ?, ?)
     ON CONFLICT(year, month, category_id) DO UPDATE SET amount = excluded.amount`
  );
  const tx = db.transaction((items) => {
    for (const item of items) upsert.run(year, month, item.category_id, item.amount);
  });
  tx(budgets);
  res.json({ ok: true });
});

// ---------- transactions ----------
router.get('/transactions', (req, res) => {
  const { year, month } = req.query;
  let rows;
  if (year && month) {
    rows = db
      .prepare(
        `SELECT t.*, c.name as category_name, c.color as category_color, c.type as category_type
         FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.year = ? AND t.month = ? ORDER BY t.date DESC, t.id DESC`
      )
      .all(year, month);
  } else if (year) {
    rows = db
      .prepare(
        `SELECT t.*, c.name as category_name, c.color as category_color, c.type as category_type
         FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.year = ? ORDER BY t.date DESC, t.id DESC`
      )
      .all(year);
  } else {
    rows = db
      .prepare(
        `SELECT t.*, c.name as category_name, c.color as category_color, c.type as category_type
         FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
         ORDER BY t.date DESC, t.id DESC LIMIT 200`
      )
      .all();
  }
  res.json(rows);
});

router.post('/transactions', (req, res) => {
  const { date, amount, category_id, store, note, payment_method } = req.body;
  if (!date || amount === undefined) {
    return res.status(400).json({ error: 'date and amount are required' });
  }
  const [y, m] = date.split('-');
  const info = db
    .prepare(
      `INSERT INTO transactions (date, year, month, amount, category_id, store, note, payment_method, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')`
    )
    .run(
      date,
      Number(y),
      Number(m),
      amount,
      category_id || null,
      store || null,
      note || null,
      payment_method || 'debit'
    );
  const row = db
    .prepare(
      `SELECT t.*, c.name as category_name, c.color as category_color, c.type as category_type
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.id = ?`
    )
    .get(info.lastInsertRowid);
  res.json(row);
});

router.put('/transactions/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const { date, amount, category_id, store, note, payment_method } = req.body;
  const finalDate = date ?? existing.date;
  const [y, m] = finalDate.split('-');
  db.prepare(
    `UPDATE transactions SET date=?, year=?, month=?, amount=?, category_id=?, store=?, note=?, payment_method=? WHERE id=?`
  ).run(
    finalDate,
    Number(y),
    Number(m),
    amount ?? existing.amount,
    category_id ?? existing.category_id,
    store ?? existing.store,
    note ?? existing.note,
    payment_method ?? existing.payment_method,
    req.params.id
  );
  const row = db
    .prepare(
      `SELECT t.*, c.name as category_name, c.color as category_color, c.type as category_type
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.id = ?`
    )
    .get(req.params.id);
  res.json(row);
});

router.delete('/transactions/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- dashboard ----------
router.get('/dashboard/:year/:month', (req, res) => {
  const { year, month } = req.params;

  // settings (income + savings goal), with inheritance fallback
  let settingsRow = db
    .prepare('SELECT * FROM monthly_settings WHERE year = ? AND month = ?')
    .get(year, month);
  if (!settingsRow) {
    settingsRow = db
      .prepare(
        `SELECT * FROM monthly_settings
         WHERE (year < ?) OR (year = ? AND month < ?)
         ORDER BY year DESC, month DESC LIMIT 1`
      )
      .get(year, year, month);
  }
  const settings = parseSettings(settingsRow);
  const income = totalIncome(settings);
  const goalAmount = savingsGoalAmount(settings);

  // budgets (with inheritance)
  const categories = db
    .prepare('SELECT * FROM categories WHERE archived = 0 ORDER BY type, sort_order, name')
    .all();
  let budgetRows = db.prepare('SELECT * FROM budgets WHERE year = ? AND month = ?').all(year, month);
  if (budgetRows.length === 0) {
    const priorMonth = db
      .prepare(
        `SELECT year, month FROM budgets
         WHERE (year < ?) OR (year = ? AND month < ?)
         ORDER BY year DESC, month DESC LIMIT 1`
      )
      .get(year, year, month);
    if (priorMonth) {
      budgetRows = db
        .prepare('SELECT * FROM budgets WHERE year = ? AND month = ?')
        .all(priorMonth.year, priorMonth.month);
    }
  }
  const budgetByCategory = Object.fromEntries(budgetRows.map((b) => [b.category_id, b.amount]));

  // spending by category
  const spendRows = db
    .prepare(
      `SELECT category_id, SUM(amount) as total, COUNT(*) as count
       FROM transactions WHERE year = ? AND month = ? GROUP BY category_id`
    )
    .all(year, month);
  const spendByCategory = Object.fromEntries(spendRows.map((s) => [s.category_id, s.total]));

  const categoryBreakdown = categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    color: c.color,
    budgeted: budgetByCategory[c.id] || 0,
    spent: spendByCategory[c.id] || 0,
  }));

  const totalBudgeted = categoryBreakdown.reduce((s, c) => s + c.budgeted, 0);
  const totalSpent = categoryBreakdown.reduce((s, c) => s + c.spent, 0);
  const necessaryTotal = categoryBreakdown
    .filter((c) => c.type === 'necessary')
    .reduce((s, c) => s + c.budgeted, 0);
  const discretionarySpent = categoryBreakdown
    .filter((c) => c.type === 'discretionary')
    .reduce((s, c) => s + c.spent, 0);
  const discretionaryBudgeted = categoryBreakdown
    .filter((c) => c.type === 'discretionary')
    .reduce((s, c) => s + c.budgeted, 0);
  const savingsSpent = categoryBreakdown
    .filter((c) => c.type === 'savings')
    .reduce((s, c) => s + c.spent, 0);

  const availableToSpend = income - necessaryTotal - goalAmount;

  // top transactions
  const topTransactions = db
    .prepare(
      `SELECT t.*, c.name as category_name FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.year = ? AND t.month = ? ORDER BY t.amount DESC LIMIT 5`
    )
    .all(year, month);

  // days left in month
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === Number(year) && now.getMonth() + 1 === Number(month);
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  const daysLeft = isCurrentMonth ? daysInMonth - now.getDate() : null;

  res.json({
    year: Number(year),
    month: Number(month),
    income,
    savings_goal_amount: goalAmount,
    savings_actual: savingsSpent,
    necessary_total: necessaryTotal,
    discretionary_budgeted: discretionaryBudgeted,
    discretionary_spent: discretionarySpent,
    available_to_spend: availableToSpend,
    total_budgeted: totalBudgeted,
    total_spent: totalSpent,
    category_breakdown: categoryBreakdown,
    top_transactions: topTransactions,
    days_left_in_month: daysLeft,
  });
});

module.exports = router;
