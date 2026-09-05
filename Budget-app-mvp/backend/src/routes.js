const express = require('express');
const { db, ready } = require('./db');

const router = express.Router();

// make sure schema/seed finished before handling any request
router.use((req, res, next) => {
  ready.then(() => next()).catch(next);
});

// ---------- helpers ----------
function num(x) {
  // libsql can return counts/ids as BigInt; normalize for JSON
  return typeof x === 'bigint' ? Number(x) : x;
}

function rowToPlain(row) {
  const out = {};
  for (const k of Object.keys(row)) out[k] = num(row[k]);
  return out;
}

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

async function q(sql, args = []) {
  const { rows } = await db.execute({ sql, args });
  return rows.map(rowToPlain);
}

async function qOne(sql, args = []) {
  const rows = await q(sql, args);
  return rows[0] || null;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// Make sure every active recurring template has a generated transaction for
// this year/month, as long as that month has already started (never
// pre-populate future months before they happen). Safe to call repeatedly —
// the unique index on (recurring_id, year, month) plus this existence check
// keeps it from ever creating duplicates.
async function ensureRecurringGenerated(year, month) {
  const y = Number(year);
  const m = Number(month);
  const now = new Date();
  const isPastOrCurrent = y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1);
  if (!isPastOrCurrent) return;

  const templates = await q(
    `SELECT * FROM recurring_transactions
     WHERE active = 1 AND (start_year < ? OR (start_year = ? AND start_month <= ?))`,
    [y, y, m]
  );

  for (const t of templates) {
    const existing = await qOne(
      'SELECT id FROM transactions WHERE recurring_id = ? AND year = ? AND month = ?',
      [t.id, y, m]
    );
    if (existing) continue;

    const day = Math.min(t.day_of_month, daysInMonth(y, m));
    const date = `${y}-${pad(m)}-${pad(day)}`;
    await db.execute({
      sql: `INSERT INTO transactions (date, year, month, amount, category_id, store, note, payment_method, source, recurring_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'recurring', ?)`,
      args: [date, y, m, t.amount, t.category_id, t.store, t.note, t.payment_method, t.id],
    });
  }
}

// ---------- years ----------
router.get('/years', async (req, res, next) => {
  try {
    const rows = await q(
      `SELECT DISTINCT year FROM (
        SELECT year FROM transactions
        UNION
        SELECT year FROM budgets
        UNION
        SELECT year FROM monthly_settings
      ) ORDER BY year DESC`
    );
    const years = rows.map((r) => r.year);
    const currentYear = new Date().getFullYear();
    if (!years.includes(currentYear)) years.unshift(currentYear);
    res.json(years.sort((a, b) => b - a));
  } catch (e) {
    next(e);
  }
});

// ---------- categories ----------
router.get('/categories', async (req, res, next) => {
  try {
    const rows = await q('SELECT * FROM categories WHERE archived = 0 ORDER BY type, sort_order, name');
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const { name, type, color, sort_order } = req.body;
    if (!name || !['necessary', 'discretionary', 'savings'].includes(type)) {
      return res.status(400).json({ error: 'name and valid type are required' });
    }
    const result = await db.execute({
      sql: 'INSERT INTO categories (name, type, color, sort_order) VALUES (?, ?, ?, ?)',
      args: [name, type, color || '#6366f1', sort_order || 0],
    });
    const row = await qOne('SELECT * FROM categories WHERE id = ?', [num(result.lastInsertRowid)]);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.put('/categories/:id', async (req, res, next) => {
  try {
    const { name, type, color, sort_order } = req.body;
    const existing = await qOne('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'not found' });
    await db.execute({
      sql: 'UPDATE categories SET name=?, type=?, color=?, sort_order=? WHERE id=?',
      args: [
        name ?? existing.name,
        type ?? existing.type,
        color ?? existing.color,
        sort_order ?? existing.sort_order,
        req.params.id,
      ],
    });
    const row = await qOne('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    await db.execute({ sql: 'UPDATE categories SET archived = 1 WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- stores ----------
router.get('/stores', async (req, res, next) => {
  try {
    const rows = await q('SELECT * FROM stores WHERE archived = 0 ORDER BY sort_order, name');
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/stores', async (req, res, next) => {
  try {
    const { name, default_category_id, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    try {
      const result = await db.execute({
        sql: 'INSERT INTO stores (name, default_category_id, is_preset, sort_order) VALUES (?, ?, 0, ?)',
        args: [name, default_category_id || null, sort_order || 99],
      });
      const row = await qOne('SELECT * FROM stores WHERE id = ?', [num(result.lastInsertRowid)]);
      res.json(row);
    } catch (e) {
      res.status(400).json({ error: 'store already exists' });
    }
  } catch (e) {
    next(e);
  }
});

router.put('/stores/:id', async (req, res, next) => {
  try {
    const existing = await qOne('SELECT * FROM stores WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const { name, default_category_id, sort_order } = req.body;
    await db.execute({
      sql: 'UPDATE stores SET name=?, default_category_id=?, sort_order=? WHERE id=?',
      args: [
        name ?? existing.name,
        default_category_id ?? existing.default_category_id,
        sort_order ?? existing.sort_order,
        req.params.id,
      ],
    });
    const row = await qOne('SELECT * FROM stores WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.delete('/stores/:id', async (req, res, next) => {
  try {
    await db.execute({ sql: 'UPDATE stores SET archived = 1 WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- monthly settings (income + savings goal) ----------
router.get('/settings/:year/:month', async (req, res, next) => {
  try {
    const { year, month } = req.params;
    let row = await qOne('SELECT * FROM monthly_settings WHERE year = ? AND month = ?', [year, month]);

    if (!row) {
      row = await qOne(
        `SELECT * FROM monthly_settings
         WHERE (year < ?) OR (year = ? AND month < ?)
         ORDER BY year DESC, month DESC LIMIT 1`,
        [year, year, month]
      );
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
  } catch (e) {
    next(e);
  }
});

router.post('/settings/:year/:month', async (req, res, next) => {
  try {
    const { year, month } = req.params;
    const { income_sources, savings_goal_type, savings_goal_value } = req.body;
    const existing = await qOne('SELECT * FROM monthly_settings WHERE year = ? AND month = ?', [year, month]);
    const sourcesJson = JSON.stringify(income_sources || []);
    if (existing) {
      await db.execute({
        sql: 'UPDATE monthly_settings SET income_sources=?, savings_goal_type=?, savings_goal_value=? WHERE id=?',
        args: [sourcesJson, savings_goal_type || 'fixed', savings_goal_value || 0, existing.id],
      });
    } else {
      await db.execute({
        sql: 'INSERT INTO monthly_settings (year, month, income_sources, savings_goal_type, savings_goal_value) VALUES (?, ?, ?, ?, ?)',
        args: [year, month, sourcesJson, savings_goal_type || 'fixed', savings_goal_value || 0],
      });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- budgets ----------
router.get('/budgets/:year/:month', async (req, res, next) => {
  try {
    const { year, month } = req.params;
    const categories = await q('SELECT * FROM categories WHERE archived = 0 ORDER BY type, sort_order, name');
    const budgetRows = await q('SELECT * FROM budgets WHERE year = ? AND month = ?', [year, month]);
    const byCategory = Object.fromEntries(budgetRows.map((b) => [b.category_id, b.amount]));

    let inherited = false;
    if (budgetRows.length === 0) {
      const prior = await q(
        `SELECT * FROM budgets b
         WHERE ((year < ?) OR (year = ? AND month < ?))
         AND year = (SELECT MAX(year) FROM budgets WHERE (year < ?) OR (year = ? AND month < ?))
         ORDER BY month DESC`,
        [year, year, month, year, year, month]
      );
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
  } catch (e) {
    next(e);
  }
});

router.post('/budgets/:year/:month', async (req, res, next) => {
  try {
    const { year, month } = req.params;
    const { budgets } = req.body; // [{category_id, amount}]
    if (!Array.isArray(budgets)) return res.status(400).json({ error: 'budgets array required' });
    const stmts = budgets.map((item) => ({
      sql: `INSERT INTO budgets (year, month, category_id, amount) VALUES (?, ?, ?, ?)
            ON CONFLICT(year, month, category_id) DO UPDATE SET amount = excluded.amount`,
      args: [year, month, item.category_id, item.amount],
    }));
    if (stmts.length) await db.batch(stmts, 'write');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- recurring transactions ----------
router.get('/recurring', async (req, res, next) => {
  try {
    const rows = await q(
      `SELECT r.*, c.name as category_name, c.color as category_color
       FROM recurring_transactions r LEFT JOIN categories c ON c.id = r.category_id
       ORDER BY r.active DESC, r.day_of_month, r.id`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/recurring', async (req, res, next) => {
  try {
    const { category_id, store, amount, note, payment_method, day_of_month, start_year, start_month } = req.body;
    if (amount === undefined || !start_year || !start_month) {
      return res.status(400).json({ error: 'amount, start_year, and start_month are required' });
    }
    const result = await db.execute({
      sql: `INSERT INTO recurring_transactions
            (category_id, store, amount, note, payment_method, day_of_month, start_year, start_month, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      args: [
        category_id || null,
        store || null,
        amount,
        note || null,
        payment_method || 'debit',
        day_of_month || 1,
        start_year,
        start_month,
      ],
    });
    const row = await qOne('SELECT * FROM recurring_transactions WHERE id = ?', [num(result.lastInsertRowid)]);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.put('/recurring/:id', async (req, res, next) => {
  try {
    const existing = await qOne('SELECT * FROM recurring_transactions WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const { category_id, store, amount, note, payment_method, day_of_month, active } = req.body;
    await db.execute({
      sql: `UPDATE recurring_transactions
            SET category_id=?, store=?, amount=?, note=?, payment_method=?, day_of_month=?, active=?
            WHERE id=?`,
      args: [
        category_id !== undefined ? category_id : existing.category_id,
        store !== undefined ? store : existing.store,
        amount !== undefined ? amount : existing.amount,
        note !== undefined ? note : existing.note,
        payment_method ?? existing.payment_method,
        day_of_month ?? existing.day_of_month,
        active !== undefined ? (active ? 1 : 0) : existing.active,
        req.params.id,
      ],
    });
    const row = await qOne('SELECT * FROM recurring_transactions WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.delete('/recurring/:id', async (req, res, next) => {
  try {
    await db.execute({ sql: 'DELETE FROM recurring_transactions WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- transactions ----------
router.get('/transactions', async (req, res, next) => {
  try {
    const { year, month } = req.query;
    if (year && month) await ensureRecurringGenerated(year, month);
    let rows;
    const base = `SELECT t.*, c.name as category_name, c.color as category_color, c.type as category_type
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id`;
    if (year && month) {
      rows = await q(`${base} WHERE t.year = ? AND t.month = ? ORDER BY t.date DESC, t.id DESC`, [year, month]);
    } else if (year) {
      rows = await q(`${base} WHERE t.year = ? ORDER BY t.date DESC, t.id DESC`, [year]);
    } else {
      rows = await q(`${base} ORDER BY t.date DESC, t.id DESC LIMIT 200`);
    }
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/transactions', async (req, res, next) => {
  try {
    const { date, amount, category_id, store, note, payment_method, make_recurring } = req.body;
    if (!date || amount === undefined) {
      return res.status(400).json({ error: 'date and amount are required' });
    }
    const [y, m, d] = date.split('-').map(Number);

    // Optionally spin up a recurring template at the same time, and link
    // this transaction to it as its first occurrence.
    let recurringId = null;
    if (make_recurring) {
      const recurring = await db.execute({
        sql: `INSERT INTO recurring_transactions
              (category_id, store, amount, note, payment_method, day_of_month, start_year, start_month, active)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        args: [category_id || null, store || null, amount, note || null, payment_method || 'debit', d, y, m],
      });
      recurringId = num(recurring.lastInsertRowid);
    }

    const result = await db.execute({
      sql: `INSERT INTO transactions (date, year, month, amount, category_id, store, note, payment_method, source, recurring_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
      args: [
        date,
        Number(y),
        Number(m),
        amount,
        category_id || null,
        store || null,
        note || null,
        payment_method || 'debit',
        recurringId,
      ],
    });
    const row = await qOne(
      `SELECT t.*, c.name as category_name, c.color as category_color, c.type as category_type
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.id = ?`,
      [num(result.lastInsertRowid)]
    );
    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.put('/transactions/:id', async (req, res, next) => {
  try {
    const existing = await qOne('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const { date, amount, category_id, store, note, payment_method } = req.body;
    const finalDate = date ?? existing.date;
    const [y, m] = finalDate.split('-');
    await db.execute({
      sql: `UPDATE transactions SET date=?, year=?, month=?, amount=?, category_id=?, store=?, note=?, payment_method=? WHERE id=?`,
      args: [
        finalDate,
        Number(y),
        Number(m),
        amount ?? existing.amount,
        category_id ?? existing.category_id,
        store ?? existing.store,
        note ?? existing.note,
        payment_method ?? existing.payment_method,
        req.params.id,
      ],
    });
    const row = await qOne(
      `SELECT t.*, c.name as category_name, c.color as category_color, c.type as category_type
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.id = ?`,
      [req.params.id]
    );
    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.delete('/transactions/:id', async (req, res, next) => {
  try {
    await db.execute({ sql: 'DELETE FROM transactions WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- dashboard ----------
router.get('/dashboard/:year/:month', async (req, res, next) => {
  try {
    const { year, month } = req.params;
    await ensureRecurringGenerated(year, month);

    let settingsRow = await qOne('SELECT * FROM monthly_settings WHERE year = ? AND month = ?', [year, month]);
    if (!settingsRow) {
      settingsRow = await qOne(
        `SELECT * FROM monthly_settings
         WHERE (year < ?) OR (year = ? AND month < ?)
         ORDER BY year DESC, month DESC LIMIT 1`,
        [year, year, month]
      );
    }
    const settings = parseSettings(settingsRow);
    const income = totalIncome(settings);
    const goalAmount = savingsGoalAmount(settings);

    const categories = await q('SELECT * FROM categories WHERE archived = 0 ORDER BY type, sort_order, name');
    let budgetRows = await q('SELECT * FROM budgets WHERE year = ? AND month = ?', [year, month]);
    if (budgetRows.length === 0) {
      const priorMonth = await qOne(
        `SELECT year, month FROM budgets
         WHERE (year < ?) OR (year = ? AND month < ?)
         ORDER BY year DESC, month DESC LIMIT 1`,
        [year, year, month]
      );
      if (priorMonth) {
        budgetRows = await q('SELECT * FROM budgets WHERE year = ? AND month = ?', [
          priorMonth.year,
          priorMonth.month,
        ]);
      }
    }
    const budgetByCategory = Object.fromEntries(budgetRows.map((b) => [b.category_id, b.amount]));

    const spendRows = await q(
      `SELECT category_id, SUM(amount) as total, COUNT(*) as count
       FROM transactions WHERE year = ? AND month = ? GROUP BY category_id`,
      [year, month]
    );
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

    const topTransactions = await q(
      `SELECT t.*, c.name as category_name FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.year = ? AND t.month = ? ORDER BY t.amount DESC LIMIT 5`,
      [year, month]
    );

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
  } catch (e) {
    next(e);
  }
});

module.exports = router;
