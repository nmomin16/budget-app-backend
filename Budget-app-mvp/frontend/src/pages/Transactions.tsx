import { useEffect, useState } from 'react';
import { usePeriod } from '../context/PeriodContext';
import { getTransactions, deleteTransaction, updateTransaction, getCategories } from '../api';
import type { Transaction, Category } from '../types';

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function Transactions() {
  const { year, month } = usePeriod();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);

  function reload() {
    setLoading(true);
    getTransactions(year, month)
      .then(setTransactions)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    getCategories().then(setCategories);
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id: number) {
    if (!confirm('Delete this transaction?')) return;
    await deleteTransaction(id);
    reload();
  }

  async function handleRecategorize(id: number, category_id: string) {
    await updateTransaction(id, { category_id: category_id ? Number(category_id) : null });
    reload();
  }

  const total = transactions.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Transactions</h1>
        <span className="text-sm text-gray-500">{transactions.length} entries · {money(total)} total</span>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-10">Loading…</p>
      ) : transactions.length === 0 ? (
        <p className="text-center text-gray-500 py-10">No expenses logged for this month yet.</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <div
              key={t.id}
              className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: t.category_color || '#9ca3af' }}
                />
                <div className="min-w-0">
                  <div className="font-medium text-gray-800 dark:text-gray-100 truncate">
                    {t.store || 'Uncategorized purchase'}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {t.date} · {t.payment_method}
                    {t.note ? ` · ${t.note}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {editingId === t.id ? (
                  <select
                    autoFocus
                    value={t.category_id ?? ''}
                    onChange={(e) => {
                      handleRecategorize(t.id, e.target.value);
                      setEditingId(null);
                    }}
                    onBlur={() => setEditingId(null)}
                    className="text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-1"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => setEditingId(t.id)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    {t.category_name || 'Categorize'}
                  </button>
                )}
                <span className="font-semibold text-gray-800 dark:text-gray-100 w-20 text-right">
                  {money(t.amount)}
                </span>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-gray-400 hover:text-red-500 text-lg leading-none px-1"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
