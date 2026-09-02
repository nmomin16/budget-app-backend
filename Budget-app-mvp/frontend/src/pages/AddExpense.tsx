import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCategories, getStores, createTransaction, createStore } from '../api';
import type { Category, Store } from '../types';

function todayStr() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

export default function AddExpense() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [storeId, setStoreId] = useState<string>('');
  const [customStore, setCustomStore] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'debit' | 'credit'>('credit');
  const [saveNewStore, setSaveNewStore] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories);
    getStores().then(setStores);
  }, []);

  const isOther = storeId === 'other';

  function handleStoreChange(id: string) {
    setStoreId(id);
    if (id && id !== 'other') {
      const s = stores.find((st) => String(st.id) === id);
      if (s?.default_category_id && !categoryId) {
        setCategoryId(String(s.default_category_id));
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setSubmitting(true);
    try {
      let storeName: string | null = null;
      if (isOther) {
        storeName = customStore.trim() || null;
        if (storeName && saveNewStore) {
          const created = await createStore({
            name: storeName,
            default_category_id: categoryId ? Number(categoryId) : null,
          });
          setStores((prev) => [...prev, created]);
        }
      } else if (storeId) {
        storeName = stores.find((s) => String(s.id) === storeId)?.name || null;
      }

      await createTransaction({
        date,
        amount: Number(amount),
        category_id: categoryId ? Number(categoryId) : null,
        store: storeName,
        note: note.trim() || null,
        payment_method: paymentMethod,
      });

      setJustSaved(true);
      setAmount('');
      setNote('');
      setCustomStore('');
      setTimeout(() => setJustSaved(false), 1800);
    } finally {
      setSubmitting(false);
    }
  }

  const necessary = categories.filter((c) => c.type === 'necessary');
  const discretionary = categories.filter((c) => c.type === 'discretionary');
  const savings = categories.filter((c) => c.type === 'savings');

  return (
    <div className="max-w-md mx-auto p-4 pb-24">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Add Expense</h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              autoFocus
              inputMode="decimal"
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-7 pr-3 py-3 text-lg rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Store</label>
          <select
            value={storeId}
            onChange={(e) => handleStoreChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            <option value="">Select a store…</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="other">Other / type manually</option>
          </select>
          {isOther && (
            <div className="mt-2 space-y-1">
              <input
                type="text"
                value={customStore}
                onChange={(e) => setCustomStore(e.target.value)}
                placeholder="Store name"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input type="checkbox" checked={saveNewStore} onChange={(e) => setSaveNewStore(e.target.checked)} />
                Save to my store list for next time
              </label>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            <option value="">Uncategorized</option>
            <optgroup label="Discretionary">
              {discretionary.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
            <optgroup label="Necessary">
              {necessary.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
            <optgroup label="Savings">
              {savings.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Payment</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <option value="credit">Credit Card</option>
              <option value="debit">Debit Card</option>
              <option value="cash">Cash</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. birthday gift for mom"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !amount}
          className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold"
        >
          {submitting ? 'Saving…' : 'Save Expense'}
        </button>
        {justSaved && (
          <p className="text-center text-sm text-green-600 dark:text-green-400">
            Saved! Add another, or{' '}
            <button type="button" className="underline" onClick={() => navigate('/')}>
              go to dashboard
            </button>
            .
          </p>
        )}
      </form>
    </div>
  );
}
